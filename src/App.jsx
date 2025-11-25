import './App.css'
import { useEffect, useState } from 'react'
import './App.css'
import Login from './auth/Login.jsx'
import LogoutButton from './auth/LogoutButton.jsx'
import useAuth from './hooks/useAuth.js'
import { firebaseReady } from './firebase'
import useUserProfile from './hooks/useUserProfile.js'
import { updateUserRole } from './services/users.js'
import { isDomainAllowed, isDocenteAllowed } from './services/access.js'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import DocenteDashboard from './docente/Dashboard.jsx'
import EstudianteDashboard from './estudiante/Dashboard.jsx'

function App() {
  const { user, loading } = useAuth()
  const { profile, loading: loadingProfile } = useUserProfile(user?.uid)
  const [authError, setAuthError] = useState('')
  const [docenteAllowed, setDocenteAllowed] = useState(null)

  useEffect(() => {
    const checkAccess = async () => {
      setAuthError('')
      setDocenteAllowed(null)
      if (!user || loadingProfile) return
      if (!profile) return
      const email = user.email || ''
      try {
        const allowlisted = await isDocenteAllowed(email)
        if (allowlisted && profile.rol !== 'docente') {
          await updateUserRole(user.uid, 'docente')
          return
        }
      } catch {
        // noop
      }
      if (profile.rol === 'docente') {
        const ok = await isDocenteAllowed(email)
        setDocenteAllowed(ok)
        if (!ok) {
          setAuthError('Acceso denegado: docente no habilitado')
        }
      } else if (profile.rol === 'estudiante') {
        const ok = isDomainAllowed(email)
        if (!ok) {
          setAuthError('Acceso denegado: usa tu correo institucional')
          await signOut(auth)
        }
      } else {
        setAuthError('Acceso denegado: rol no permitido')
        await signOut(auth)
      }
    }
    checkAccess()
  }, [user, loadingProfile, profile])

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
          {!loading && user && (
            <>
              {authError && <p className="error-text">{authError}</p>}
              {loadingProfile && <p>Cargando perfil...</p>}
              {!loadingProfile && profile && (
                profile.rol === 'docente' ? (
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
                ) : profile.rol === 'estudiante' ? (
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
            </>
          )}
        </>
      )}
    </>
  )
}

export default App
