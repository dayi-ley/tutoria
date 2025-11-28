import { useEffect, useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, OAuthProvider, signOut } from 'firebase/auth'
import { auth, allowedDomain, allowedEmailSubstring } from '../firebase'
import { ensureUserProfile } from '../services/users.js'
import isologo from '../assets/images/tutoria_isologo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hiddenOpen, setHiddenOpen] = useState(false)
  const [hiddenEmail, setHiddenEmail] = useState('')
  const [hiddenPassword, setHiddenPassword] = useState('')
  const [hiddenError, setHiddenError] = useState('')
  const [hiddenLoading, setHiddenLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!auth) {
      setError('Firebase no está configurado')
      return
    }
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      await enforceDomain(cred.user)
      await ensureUserProfile(cred.user)
      
    } catch (err) {
      const code = String(err?.code || '')
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setError('Correo o contraseña incorrectos')
      } else if (code.includes('too-many-requests')) {
        setError('Demasiados intentos. Intenta más tarde')
      } else if (code.includes('network-request-failed')) {
        setError('Problema de conexión. Revisa tu red')
      } else {
        setError('No se pudo iniciar sesión. Verifica tus datos')
      }
      setLoading(false)
    }
  }

  const loginMicrosoft = async () => {
    if (!auth) {
      setError('Firebase no está configurado')
      return
    }
    setError('')
    setLoading(true)
    try {
      const provider = new OAuthProvider('microsoft.com')
      provider.setCustomParameters({ prompt: 'select_account' })
      const cred = await signInWithPopup(auth, provider)
      await enforceDomain(cred.user)
      await ensureUserProfile(cred.user)
    } catch (err) {
      const msg = String(err?.code || err?.message || err)
      if (msg.includes('auth/popup-blocked') || msg.includes('auth/popup-closed-by-user') || msg.includes('auth/invalid-credential')) {
        try {
          const provider = new OAuthProvider('microsoft.com')
          provider.setCustomParameters({ prompt: 'select_account' })
          await signInWithRedirect(auth, provider)
          return
        } catch (e2) {
          const code2 = String(e2?.code || '')
          if (code2.includes('invalid-credential')) {
            setError('No se pudo iniciar sesión con Outlook')
          } else if (code2.includes('network-request-failed')) {
            setError('Problema de conexión. Revisa tu red')
          } else {
            setError('No se pudo iniciar sesión. Intenta nuevamente')
          }
          setLoading(false)
          return
        }
      }
      const code = String(err?.code || '')
      if (code.includes('network-request-failed')) {
        setError('Problema de conexión. Revisa tu red')
      } else {
        setError('No se pudo iniciar sesión con Outlook')
      }
      setLoading(false)
    }
  }

  const enforceDomain = async (u) => {
    const email = u?.email?.toLowerCase()
    if (!email) return
    const dom = allowedDomain ? String(allowedDomain).toLowerCase() : ''
    const sub = allowedEmailSubstring ? String(allowedEmailSubstring).toLowerCase() : ''
    const at = email.lastIndexOf('@')
    const domain = at >= 0 ? email.slice(at + 1) : ''
    const okExact = dom ? domain === dom : false
    const okSub = sub ? domain.includes(sub) : false
    if (dom || sub) {
      if (!(okExact || okSub)) {
        await signOut(auth)
        setError(dom ? `Debes usar correo @${allowedDomain}` : `Debes usar correo institucional`)
        setLoading(false)
      }
    }
  }

  const hiddenSubmit = async (e) => {
    e.preventDefault()
    if (!auth) {
      setHiddenError('Firebase no está configurado')
      return
    }
    setHiddenError('')
    setHiddenLoading(true)
    try {
      await signInWithEmailAndPassword(auth, hiddenEmail, hiddenPassword)
      setHiddenLoading(false)
      setHiddenOpen(false)
    } catch (err) {
      const code = String(err?.code || '')
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setHiddenError('Correo o contraseña incorrectos')
      } else if (code.includes('too-many-requests')) {
        setHiddenError('Demasiados intentos. Intenta más tarde')
      } else if (code.includes('network-request-failed')) {
        setHiddenError('Problema de conexión. Revisa tu red')
      } else {
        setHiddenError('No se pudo iniciar sesión. Verifica tus datos')
      }
      setHiddenLoading(false)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      const key = String(e.key || '').toLowerCase()
      if ((e.ctrlKey && e.shiftKey && key === 'l') || (e.altKey && key === 'l')) {
        setHiddenOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    try {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('hiddenLogin')
      const h = String(window.location.hash || '').toLowerCase()
      if (q === '1' || h.includes('hidden-login')) setTimeout(() => setHiddenOpen(true), 0)
    } catch (e) {
      console.warn(e?.message || String(e))
    }
    try {
      window.__openHiddenLogin = () => setHiddenOpen(true)
      window.__toggleHiddenLogin = () => setHiddenOpen((v) => !v)
    } catch (e) {
      console.warn(e?.message || String(e))
    }
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])


  return (
    <div className="login-container">
      <div className="login-card">
        <img src={isologo} alt="Tutorías" className="login-logo" />
        <form onSubmit={submit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Correo institucional</label>
            <input
              id="email"
              type="email"
              placeholder="nombre@institucion.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="input-with-icon">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="toggle-pwd"
                onClick={() => setShowPwd((v) => !v)}
              >
                {showPwd ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M2.1 4.93 3.52 3.5 20.5 20.48 19.07 21.9l-3.26-3.26A11.66 11.66 0 0 1 12 19.5c-5.2 0-9.64-3.35-11.5-8 1.02-2.57 2.94-4.72 5.29-6.06l-.69-.51ZM12 7.5c3.31 0 6 2.69 6 6 0 .86-.18 1.68-.5 2.42l-2.12-2.12A3.5 3.5 0 0 0 12 8.5c-.74 0-1.43.22-2 .6L8.48 7.58c1.08-.52 2.3-.83 3.52-.83Zm0 9a3.48 3.48 0 0 1-2.42-.97l4.89-4.89c.63.63 1.03 1.5 1.03 2.46 0 1.93-1.57 3.5-3.5 3.5Z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 5c-5 0-9 3.27-10.83 8 1.83 4.73 5.83 8 10.83 8s9-3.27 10.83-8C21 8.27 17 5 12 5Zm0 13c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6Zm0-10a4 4 0 1 0 .001 8.001A4 4 0 0 0 12 8Z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="actions">
            <button type="submit" disabled={loading}>Ingresar</button>
          </div>
        </form>
        <div className="oauth">
          <button onClick={loginMicrosoft} disabled={loading} className="btn-outlook">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3h7a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2h-7V3z"/>
              <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H12v16H5.5A2.5 2.5 0 0 1 3 17.5v-11z"/>
              <path d="M20.5 8H12v8h7a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 20.5 8z"/>
            </svg>
            Ingresar con correo institucional
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
      <div className="info-card">
        <h3>Consultas y observaciones del sistema</h3>
        <p><span className="phone">929 486 812</span> - Equipo Dev FIEI</p>
        <h3>Soporte del Sistema</h3>
        <p>contacto: equipoDevFiei@gmail.com</p>
      </div>
      {hiddenOpen && (
        <div className="modal-backdrop" onClick={() => setHiddenOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>Acceso oculto</h4>
            <form onSubmit={hiddenSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="hidden-email">Correo</label>
                <input id="hidden-email" type="email" value={hiddenEmail} onChange={(e) => setHiddenEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="hidden-password">Contraseña</label>
                <input id="hidden-password" type="password" value={hiddenPassword} onChange={(e) => setHiddenPassword(e.target.value)} required />
              </div>
              <div className="actions">
                <button type="submit" disabled={hiddenLoading}>Ingresar</button>
                <button type="button" onClick={() => setHiddenOpen(false)}>Cerrar</button>
              </div>
              {hiddenError && <p className="error-text">{hiddenError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
