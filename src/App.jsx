import './App.css'
import { useEffect, useState } from 'react'
import './App.css'
import Login from './auth/Login.jsx'
import LogoutButton from './auth/LogoutButton.jsx'
import useAuth from './hooks/useAuth.js'
import { firebaseReady } from './firebase'
import useUserProfile from './hooks/useUserProfile.js'
import { updateUserRole, provisionDocente, ensureUserProfile } from './services/users.js'
import { isDomainAllowed, isDocenteAllowed, isOficinaAllowed } from './services/access.js'
import { signOut, EmailAuthProvider, linkWithCredential } from 'firebase/auth'
import { auth } from './firebase'
import DocenteDashboard from './docente/Dashboard.jsx'
import EstudianteDashboard from './estudiante/Dashboard.jsx'
import OficinaDashboard from './oficina/Dashboard.jsx'

function App() {
  const { user, loading } = useAuth()
  const { profile, loading: loadingProfile } = useUserProfile(user?.uid)
  const [authError, setAuthError] = useState('')
  const [docenteAllowed, setDocenteAllowed] = useState(null)
  const [roleHint, setRoleHint] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkOk, setLinkOk] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [hiddenLogin, setHiddenLogin] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      setAuthError('')
      setDocenteAllowed(null)
      setRoleHint('')
      if (!user) return
      const email = user.email || ''
      // Validación de dominio antes de continuar
      const domainOk = isDomainAllowed(email)
      if (!domainOk) {
        setAuthError('Acceso denegado: usa tu correo institucional')
        await signOut(auth)
        return
      }
      // Garantizar que exista el documento del perfil tras validar dominio
      try {
        await ensureUserProfile(user)
      } catch (e) {
        console.warn(e?.message || String(e))
      }
      // Detección de rol por allowlist (solo sugiere rol; no baja a estudiante)
      let allowlisted = false
      try {
        allowlisted = await isDocenteAllowed(email)
      } catch {
        allowlisted = false
      }
      if (allowlisted) {
        setRoleHint('docente')
        if (profile?.rol !== 'docente') await updateUserRole(user.uid, 'docente')
      } else {
        let office = false
        try { office = await isOficinaAllowed(email) } catch { office = false }
        if (office) {
          setRoleHint('oficina')
          if (profile?.rol !== 'oficina') await updateUserRole(user.uid, 'oficina')
        } else {
          setRoleHint('')
        }
      }
      if (loadingProfile || !profile) return
      try {
        if (allowlisted && profile.rol !== 'docente') {
          await updateUserRole(user.uid, 'docente')
          return
        }
      } catch (e) {
        console.warn(e?.message || String(e))
      }
      if (profile.rol === 'docente' || (!profile && roleHint === 'docente')) {
        const ok = await isDocenteAllowed(email)
        setDocenteAllowed(ok)
        if (!ok) {
          setAuthError('Acceso denegado: docente no habilitado')
        }
        if (ok) {
          try {
            await provisionDocente(user.uid, profile)
          } catch (e) {
            console.warn(e?.message || String(e))
          }
        }
      } else if (profile.rol === 'oficina' || (!profile && roleHint === 'oficina')) {
        // oficina: acceso directo
      } else if (profile.rol === 'estudiante') {
        // estudiante: acceso directo
      } else {
        setAuthError('Acceso denegado: rol no permitido')
        await signOut(auth)
      }
    }
    checkAccess()
  }, [user, loadingProfile, profile, roleHint])

  useEffect(() => {
    const onKey = (e) => {
      const key = String(e.key || '').toLowerCase()
      if ((e.ctrlKey && e.shiftKey && key === 'l') || (e.altKey && key === 'l')) {
        setHiddenLogin((v) => !v)
      }
    }
    window.__openHiddenLogin = () => setHiddenLogin(true)
    window.__closeHiddenLogin = () => setHiddenLogin(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('hiddenLogin') === '1' || String(url.hash || '').toLowerCase().includes('hidden-login')) {
        setTimeout(() => setHiddenLogin(true), 0)
      }
    } catch (e) {
      console.warn(e?.message || String(e))
    }
  }, [])

  return (
    <>
      {!firebaseReady && <p>Configura Firebase en `.env` antes de continuar.</p>}
      {firebaseReady && (
        <>
          {loading && <p>Cargando...</p>}
          {!loading && !user && (
            <div className="page-bg">
              <Login />
            </div>
          )}
          {hiddenLogin && (
            <div className="page-bg" style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
              <div className="content-card" style={{ maxWidth: '420px', margin: '4rem auto' }}>
                <div className="content-header-row">
                  <div className="header-title">Acceso oculto</div>
                  <div className="header-actions">
                    <button className="menu-item" onClick={() => setHiddenLogin(false)}>Cerrar</button>
                  </div>
                </div>
                <Login />
              </div>
            </div>
          )}
          {!loading && user && (
            <>
              {authError && <p className="error-text">{authError}</p>}
              {loadingProfile && <p>Cargando perfil...</p>}
              {!loadingProfile && user && !user.providerData?.some((p) => p.providerId === 'password') && (
                <div className="info-card" style={{ marginBottom: '0.75rem' }}>
                  <p>Crea una contraseña para acceder también con correo y contraseña.</p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setLinkError('')
                      setLinkOk('')
                      if (!pw || pw.length < 6) { setLinkError('La contraseña debe tener al menos 6 caracteres'); return }
                      if (pw !== pw2) { setLinkError('Las contraseñas no coinciden'); return }
                      try {
                        setLinkLoading(true)
                        const cred = EmailAuthProvider.credential(user.email, pw)
                        await linkWithCredential(user, cred)
                        setLinkOk('Contraseña creada. Ya puedes ingresar con correo y contraseña.')
                        setPw('')
                        setPw2('')
                      } catch (err) {
                        setLinkError(err?.message || String(err))
                      } finally {
                        setLinkLoading(false)
                      }
                    }}
                    className="login-form"
                  >
                    <div className="form-group">
                      <label htmlFor="newpwd">Nueva contraseña</label>
                      <input id="newpwd" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label htmlFor="newpwd2">Confirmar contraseña</label>
                      <input id="newpwd2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
                    </div>
                    <div className="actions" style={{ marginTop: '0.5rem' }}>
                      <button type="submit" disabled={linkLoading}>Crear contraseña</button>
                    </div>
                    {linkError && <p className="error-text" style={{ marginTop: '0.25rem' }}>{linkError}</p>}
                    {linkOk && <p style={{ marginTop: '0.25rem' }}>{linkOk}</p>}
                  </form>
                </div>
              )}
              {!loadingProfile && profile && (
                ((profile?.rol) === 'docente' || roleHint === 'docente') ? (
                  docenteAllowed === false ? (
                    <div className="info-card">
                      <p>{authError}</p>
                      <div className="actions" style={{ marginTop: '0.5rem' }}>
                        <LogoutButton />
                      </div>
                    </div>
                  ) : (
                    <div className="full-viewport">
                      <DocenteDashboard user={user} profile={profile} />
                    </div>
                  )
                ) : ((profile?.rol) === 'oficina' || roleHint === 'oficina') ? (
                  <div className="full-viewport">
                    <OficinaDashboard user={user} profile={profile} />
                  </div>
                ) : ((profile?.rol) === 'estudiante') ? (
                  <div className="full-viewport">
                    <EstudianteDashboard user={user} profile={profile} />
                  </div>
                ) : (
                  <div className="info-card">
                    <p>Acceso denegado: rol no permitido</p>
                    <div className="actions" style={{ marginTop: '0.5rem' }}>
                      <LogoutButton />
                    </div>
                  </div>
                )
              )}
              {!loadingProfile && !profile && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
                  <div className="loader" aria-label="Cargando" />
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

export default App
