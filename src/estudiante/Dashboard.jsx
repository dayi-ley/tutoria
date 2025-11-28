import { useState } from 'react'
import LogoutButton from '../auth/LogoutButton.jsx'
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth'

export default function EstudianteDashboard({ user }) {
  const name = user?.displayName || user?.email || 'Estudiante'
  const sections = [
    { key: 'tutorias', label: 'Tutorías programadas' },
    { key: 'ficha', label: 'Mi ficha' },
    { key: 'notas', label: 'Notas' },
    { key: 'asistencias', label: 'Asistencias' },
    { key: 'materiales', label: 'Materiales de apoyo' },
    { key: 'foro', label: 'Foro' },
    { key: 'denuncias', label: 'Denuncias' },
  ]
  const [active, setActive] = useState('tutorias')
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [linkOk, setLinkOk] = useState('')
  const [pwdToast, setPwdToast] = useState('')

  return (
    <div className="docente-layout">
      <aside className="sidebar sidebar-estudiante">
        <div className="user-panel">
          <div className="avatar" onClick={() => setShowPwdModal(true)} style={{ cursor: 'pointer' }}>🎓</div>
          <div className="user-info">
            <div className="user-name">{name}</div>
            <div className="online">
              <span className="online-dot" />
              <span>Online</span>
            </div>
          </div>
        </div>
        {pwdToast && (
          <div className="info-card" style={{ marginBottom: '0.5rem' }}>{pwdToast}</div>
        )}
        {showPwdModal && (
          <>
            <div onClick={() => { setShowPwdModal(false); setLinkError(''); setLinkOk(''); }} style={{ position: 'absolute', inset: 0, zIndex: 9 }} />
            <div className="content-card" style={{ position: 'absolute', top: '64px', left: '12px', right: '12px', zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>Crear contraseña</div>
                <button onClick={() => { setShowPwdModal(false); setLinkError(''); setLinkOk(''); }} className="menu-item">Cerrar</button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setLinkError('')
                  setLinkOk('')
                  if (!user?.email) { setLinkError('No hay correo disponible'); return }
                  if (!pw || pw.length < 6) { setLinkError('La contraseña debe tener al menos 6 caracteres'); return }
                  if (pw !== pw2) { setLinkError('Las contraseñas no coinciden'); return }
                  try {
                    setLinkLoading(true)
                    const cred = EmailAuthProvider.credential(user.email, pw)
                    await linkWithCredential(user, cred)
                    setLinkOk('Contraseña creada. Ya puedes ingresar con correo y contraseña.')
                    setPwdToast('Contraseña creada correctamente')
                    setPw('')
                    setPw2('')
                    setTimeout(() => { setShowPwdModal(false); setLinkError(''); setLinkOk('') }, 800)
                  } catch (err) {
                    setLinkError(err?.message || String(err))
                  } finally {
                    setLinkLoading(false)
                  }
                }}
                className="login-form"
                style={{ marginTop: '0.5rem' }}
              >
                <div className="form-group">
                  <label htmlFor="newpwd-est">Nueva contraseña</label>
                  <input id="newpwd-est" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="newpwd2-est">Confirmar contraseña</label>
                  <input id="newpwd2-est" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
                </div>
                <div className="actions" style={{ marginTop: '0.5rem' }}>
                  <button type="submit" disabled={linkLoading}>Crear contraseña</button>
                </div>
                {linkError && <p className="error-text" style={{ marginTop: '0.25rem' }}>{linkError}</p>}
                {linkOk && <p style={{ marginTop: '0.25rem' }}>{linkOk}</p>}
              </form>
            </div>
          </>
        )}
        <nav className="menu">
          {sections.map((s) => (
            <button
              key={s.key}
              className={`menu-item ${active === s.key ? 'active' : ''}`}
              onClick={() => setActive(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <LogoutButton />
        </div>
      </aside>

      <main className="content-area">
        <div className="content-card">
          {active === 'tutorias' && (
            <div>
              <h2>Tutorías programadas</h2>
              <p>Visualización de próximas tutorías.</p>
            </div>
          )}
          {active === 'ficha' && (
            <div>
              <h2>Mi ficha</h2>
              <p>Datos personales y socioeconómicos en modo lectura.</p>
            </div>
          )}
          {active === 'notas' && (
            <div>
              <h2>Notas</h2>
              <p>Información proveniente del sistema académico.</p>
            </div>
          )}
          {active === 'asistencias' && (
            <div>
              <h2>Asistencias</h2>
              <p>Porcentajes y historial de asistencia.</p>
            </div>
          )}
          {active === 'materiales' && (
            <div>
              <h2>Materiales de apoyo</h2>
              <p>Documentos y enlaces compartidos por tutoría.</p>
            </div>
          )}
          {active === 'foro' && (
            <div>
              <h2>Foro</h2>
              <p>Acceso de lectura y participación moderada.</p>
            </div>
          )}
          {active === 'denuncias' && (
            <div>
              <h2>Denuncias</h2>
              <p>Formulario para presentar denuncias institucionales.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
