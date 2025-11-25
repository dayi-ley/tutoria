import { useState } from 'react'
import LogoutButton from '../auth/LogoutButton.jsx'

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

  return (
    <div className="docente-layout">
      <aside className="sidebar sidebar-estudiante">
        <div className="user-panel">
          <div className="avatar">🎓</div>
          <div className="user-info">
            <div className="user-name">{name}</div>
            <div className="online">
              <span className="online-dot" />
              <span>Online</span>
            </div>
          </div>
        </div>
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
