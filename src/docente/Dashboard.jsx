import { useState, useEffect } from 'react'
import LogoutButton from '../auth/LogoutButton.jsx'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { storage, db, supabase, storageProvider } from '../firebase'

const sections = [
  { key: 'documentos', label: 'Gestión de documentos' },
  { key: 'mis-tutorias', label: 'Mis tutorías' },
  { key: 'horario', label: 'Gestionar horario' },
  { key: 'historial-sesiones', label: 'Historial de sesiones' },
  { key: 'historial-derivaciones', label: 'Historial de derivaciones' },
  { key: 'material-apoyo', label: 'Material de apoyo' },
  { key: 'foro', label: 'Foro' },
  { key: 'manuales', label: 'Manual-tutoriales' },
]

export default function Dashboard({ user, profile }) {
  const [active, setActive] = useState('documentos')
  const name = profile?.displayName || user?.email || 'Docente'

  return (
    <div className="docente-layout">
      <aside className="sidebar">
        <div className="user-panel">
          <div className="avatar">👤</div>
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
        {active !== 'documentos' && active !== 'mis-tutorias' && (
          <div className="content-header">{sections.find((x) => x.key === active)?.label}</div>
        )}
        {active === 'mis-tutorias' ? (
          <MisTutoriasView ciclo={profile?.aula?.ciclo} />
        ) : (
          <div className="content-card">
            {active === 'documentos' ? (
              <DocumentosView uid={user?.uid} name={name} />
            ) : (
              <div className="placeholder">Contenido por implementar</div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function DocumentosView({ uid, name }) {
  const [periodo, setPeriodo] = useState('')
  const [planFile, setPlanFile] = useState(null)
  const [informeMensualFile, setInformeMensualFile] = useState(null)
  const [informeFinalFile, setInformeFinalFile] = useState(null)
  const [sesionesMes, setSesionesMes] = useState('')
  const [status, setStatus] = useState({ planCount: 0, finalCount: 0, informes: {}, sesiones: {}, aula: { ciclo: '2025-II', seccion: 'A' } })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [openPlan, setOpenPlan] = useState(false)
  const [openMensual, setOpenMensual] = useState(false)
  const [openFinal, setOpenFinal] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (!uid || !db) return
      const refDoc = doc(db, 'cumplimientos_status', uid)
      const snap = await getDoc(refDoc)
      if (snap.exists()) setStatus((prev) => ({ ...prev, ...snap.data() }))
    }
    run()
  }, [uid])

  const validatePdf = (f) => f && f.type === 'application/pdf' && f.size <= 12 * 1024 * 1024

  const uploadFile = async (path, file) => {
    if (storageProvider === 'supabase' && supabase) {
      const supaPath = path.replace(/^cumplimientos\//, '')
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('cumplimientos').getPublicUrl(supaPath)
      return data.publicUrl
    }
    if (storage) {
      const r = ref(storage, path)
      const up = await uploadBytes(r, file)
      return await getDownloadURL(up.ref)
    }
    if (supabase) {
      const supaPath = path.replace(/^cumplimientos\//, '')
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('cumplimientos').getPublicUrl(supaPath)
      return data.publicUrl
    }
    throw new Error('No hay storage configurado')
  }

  const uploadPlan = async () => {
    if (!uid || !storage) return
    if (!validatePdf(planFile)) { setError('PDF de plan hasta 12MB'); return }
    setError(''); setOkMsg(''); setLoading(true)
    try {
      const path = `cumplimientos/${uid}/plan/plan_${Date.now()}.pdf`
      const url = await uploadFile(path, planFile)
      const next = { ...status, planCount: (status.planCount || 0) + 1, lastPlanUrl: url, updatedAt: serverTimestamp() }
      await setDoc(doc(db, 'cumplimientos_status', uid), next, { merge: true })
      setStatus(next)
      setPlanFile(null)
      setOkMsg('Plan registrado')
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const uploadInformeMensual = async () => {
    if (!uid || !storage) return
    if (!periodo) { setError('Selecciona periodo'); return }
    if (!validatePdf(informeMensualFile)) { setError('PDF mensual hasta 12MB'); return }
    setError(''); setOkMsg(''); setLoading(true)
    try {
      const path = `cumplimientos/${uid}/informes_mensuales/${periodo}/informe.pdf`
      const url = await uploadFile(path, informeMensualFile)
      const informes = { ...(status.informes || {}) }
      informes[periodo] = true
      const next = { ...status, informes, updatedAt: serverTimestamp(), [`lastInforme_${periodo}`]: url }
      await setDoc(doc(db, 'cumplimientos_status', uid), next, { merge: true })
      setStatus(next)
      setInformeMensualFile(null)
      setOkMsg('Informe mensual registrado')
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const uploadInformeFinal = async () => {
    if (!uid || !storage) return
    if (!validatePdf(informeFinalFile)) { setError('PDF final hasta 12MB'); return }
    setError(''); setOkMsg(''); setLoading(true)
    try {
      const path = `cumplimientos/${uid}/informe_final/final_${Date.now()}.pdf`
      const url = await uploadFile(path, informeFinalFile)
      const next = { ...status, finalCount: (status.finalCount || 0) + 1, lastFinalUrl: url, updatedAt: serverTimestamp() }
      await setDoc(doc(db, 'cumplimientos_status', uid), next, { merge: true })
      setStatus(next)
      setInformeFinalFile(null)
      setOkMsg('Informe final registrado')
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const saveSesionesMes = async () => {
    if (!uid || !periodo) { setError('Selecciona periodo'); return }
    const n = parseInt(sesionesMes, 10)
    if (Number.isNaN(n) || n < 0) { setError('Número de sesiones inválido'); return }
    setError(''); setOkMsg(''); setLoading(true)
    try {
      const sesiones = { ...(status.sesiones || {}) }
      sesiones[periodo] = n
      const next = { ...status, sesiones, updatedAt: serverTimestamp() }
      await setDoc(doc(db, 'cumplimientos_status', uid), next, { merge: true })
      setStatus(next)
      setOkMsg('Sesiones del mes guardadas')
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const mesesCiclo = ['2025-09', '2025-10', '2025-11', '2025-12']
  const etiquetasMes = ['Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const hasPlan = (status.planCount || 0) > 0
  const informeSubido = periodo ? Boolean((status.informes || {})[periodo]) : false

  

  return (
    <div>
      <div className="info-card" style={{ marginBottom: '0.75rem' }}>
        <p>Docente: {name}</p>
      </div>

      <div className="content-card" style={{ marginBottom: '0.75rem' }}>
        <h3 className="cumplimiento-title">Tabla de cumplimiento</h3>
        <table className="cumplimiento-grid">
          <thead>
            <tr>
              <th>PLAN</th>
              {mesesCiclo.map((m, idx) => (
                <>
                  <th key={`ses-${m}`}>{`N° SESIONES ${etiquetasMes[idx].toUpperCase()}`}</th>
                  <th key={`inf-${m}`}>{`INFORME ${etiquetasMes[idx].toUpperCase()}`}</th>
                </>
              ))}
              <th>INFORME FINAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className={`badge ${hasPlan ? 'ok' : 'no'}`}>{hasPlan ? 'SI' : 'NO'}</span>
              </td>
              {mesesCiclo.map((m) => (
                <>
                  <td key={`sesv-${m}`}>
                    <span className={`badge ${((status.sesiones || {})[m] || 0) > 0 ? 'ok' : 'no'}`}>{(status.sesiones || {})[m] || 0}</span>
                  </td>
                  <td key={`infv-${m}`}>
                    <span className={`badge ${((status.informes || {})[m]) ? 'ok' : 'no'}`}>{((status.informes || {})[m]) ? 'SI' : 'NO'}</span>
                  </td>
                </>
              ))}
              <td>
                <span className={`badge ${(status.finalCount || 0) > 0 ? 'ok' : 'no'}`}>{(status.finalCount || 0) > 0 ? 'SI' : 'NO'}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="content-card" style={{ marginBottom: '0.75rem' }}>
        <h3>Aula tutorada</h3>
        <p>Ciclo: {status?.aula?.ciclo} · Sección: {status?.aula?.seccion}</p>
        <div className="action-buttons">
          <button className="action-btn" onClick={() => setOpenPlan(true)} disabled={hasPlan}>📄 Plan de tutoría</button>
          <button className="action-btn" onClick={() => setOpenMensual(true)}>🗓️ Informe mensual</button>
          <button className="action-btn" onClick={() => setOpenFinal(true)}>📘 Informe final</button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {okMsg && <p className="ok-text">{okMsg}</p>}
      </div>

      {openPlan && (
        <div className="modal-backdrop" onClick={() => setOpenPlan(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>Subir plan de tutoría</h4>
            <input type="file" accept="application/pdf" onChange={(e) => setPlanFile(e.target.files?.[0] || null)} disabled={hasPlan} />
            <div className="modal-actions">
              <button onClick={() => setOpenPlan(false)}>Cancelar</button>
              <button onClick={uploadPlan} disabled={loading || hasPlan}>Subir</button>
            </div>
          </div>
        </div>
      )}

      {openMensual && (
        <div className="modal-backdrop" onClick={() => setOpenMensual(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>Informe mensual</h4>
            <label>Periodo</label>
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            <label>Sesiones del mes</label>
            <input type="number" min="0" value={sesionesMes} onChange={(e) => setSesionesMes(e.target.value)} />
            <div className="modal-actions">
              <button onClick={saveSesionesMes} disabled={loading || !periodo}>Guardar sesiones</button>
            </div>
            <label>Informe mensual (PDF)</label>
            <input type="file" accept="application/pdf" onChange={(e) => setInformeMensualFile(e.target.files?.[0] || null)} disabled={informeSubido || !periodo} />
            <div className="modal-actions">
              <button onClick={() => setOpenMensual(false)}>Cancelar</button>
              <button onClick={uploadInformeMensual} disabled={loading || !periodo || informeSubido}>Subir informe</button>
            </div>
          </div>
        </div>
      )}

      {openFinal && (
        <div className="modal-backdrop" onClick={() => setOpenFinal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>Subir informe final</h4>
            <input type="file" accept="application/pdf" onChange={(e) => setInformeFinalFile(e.target.files?.[0] || null)} />
            <div className="modal-actions">
              <button onClick={() => setOpenFinal(false)}>Cancelar</button>
              <button onClick={uploadInformeFinal} disabled={loading}>Subir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MisTutoriasView({ ciclo }) {
  const [alumnos] = useState(() => generarAlumnos(20))
  const [detalle, setDetalle] = useState(null)
  const [seleccionados, setSeleccionados] = useState(() => new Set())
  const [tipoPorIdx, setTipoPorIdx] = useState(() => alumnos.map(() => 'Grupal'))
  const [derivados, setDerivados] = useState(() => new Set())

  const tutorados = alumnos.length
  const semestre = ciclo || '2025-II'
  const grupalCount = tipoPorIdx.filter((t) => t === 'Grupal').length
  const individualCount = tipoPorIdx.filter((t) => t === 'Individual').length
  const derivadoCount = derivados.size
  const neeCount = alumnos.filter((a) => a.nee).length
  const repitentesCount = alumnos.filter((a) => a.repitente).length

  const toggleSelect = (i) => {
    const next = new Set(seleccionados)
    if (next.has(i)) next.delete(i); else next.add(i)
    setSeleccionados(next)
  }
  const isAllSelected = seleccionados.size === alumnos.length
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSeleccionados(new Set())
      return
    }
    const next = new Set()
    for (let i = 0; i < alumnos.length; i++) next.add(i)
    setSeleccionados(next)
  }
  const onTipoChange = (i, v) => {
    const next = [...tipoPorIdx]
    next[i] = v
    setTipoPorIdx(next)
  }
  const toggleDerivar = (i) => {
    const next = new Set(derivados)
    if (next.has(i)) next.delete(i); else next.add(i)
    setDerivados(next)
  }

  return (
    <div>
      <div className="content-header-row small">
        <div className="header-actions left">
          <button className="btn-new small">+ Nueva tutoría</button>
          <button className="btn-select-all small" onClick={toggleSelectAll}>{isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}</button>
        </div>
        <div className="stats-list right">
          <div className="stat-item"><span className="stat-icon">👥</span><span className="stat-label">Tutorados</span><span className="stat-value">{tutorados}</span></div>
          <div className="stat-item"><span className="stat-icon">🗓️</span><span className="stat-label">Semestre</span><span className="stat-value">{semestre}</span></div>
          <div className="stat-item"><span className="stat-icon">🧑‍🤝‍🧑</span><span className="stat-label">Grupal</span><span className="stat-value">{grupalCount}</span></div>
          <div className="stat-item"><span className="stat-icon">👤</span><span className="stat-label">Individual</span><span className="stat-value">{individualCount}</span></div>
          <div className="stat-item"><span className="stat-icon">🔗</span><span className="stat-label">Derivado</span><span className="stat-value">{derivadoCount}</span></div>
          <div className="stat-item"><span className="stat-icon">♿</span><span className="stat-label">Estudiantes NEE</span><span className="stat-value">{neeCount}</span></div>
          <div className="stat-item"><span className="stat-icon">🔁</span><span className="stat-label">Repitentes</span><span className="stat-value">{repitentesCount}</span></div>
        </div>
      </div>
      <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th></th>
            <th>Alumno</th>
            <th>Teléfono</th>
            <th>Correo institucional</th>
            <th>Rendimiento</th>
            <th>Faltas (%)</th>
            <th>Tipo</th>
            <th>Información</th>
            <th>Derivar</th>
          </tr>
        </thead>
        <tbody>
          {alumnos.map((a, i) => (
            <tr key={i} className={seleccionados.has(i) ? 'row-selected' : ''}>
              <td><input type="checkbox" checked={seleccionados.has(i)} onChange={() => toggleSelect(i)} /></td>
              <td>{a.nombre}</td>
              <td>{a.telefono}</td>
              <td>{a.email}</td>
              <td style={{ color: colorRendimiento(a.riesgoCursos) }}>{textoRendimiento(a.riesgoCursos)}</td>
              <td style={{ color: colorFaltas(a.promedioFaltas) }}>{a.promedioFaltas}%</td>
              <td>
                <select className="select-tipo" value={tipoPorIdx[i]} onChange={(e) => onTipoChange(i, e.target.value)}>
                  <option value="Grupal">Grupal</option>
                  <option value="Individual">Individual</option>
                </select>
              </td>
              <td>
                <button className="btn-info btn-notas" onClick={() => setDetalle({ tipo: 'notas', data: a.cursos })}>Notas</button>{' '}
                <button className="btn-info btn-asist" onClick={() => setDetalle({ tipo: 'asistencias', data: a.cursos })}>Asistencias</button>{' '}
                <button className="btn-info btn-ficha" onClick={() => setDetalle({ tipo: 'ficha', data: a.ficha })}>Ficha social</button>
              </td>
              <td>
                <button className={`btn-derivar ${derivados.has(i) ? 'active' : ''}`} onClick={() => toggleDerivar(i)}>
                  <span className="icon-derive" aria-hidden="true">➡︎</span>
                  {derivados.has(i) ? 'Derivado' : 'Derivar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {detalle && (
        <div className="content-card" style={{ marginTop: '0.75rem' }}>
          <h3>{detalle.tipo === 'notas' ? 'Notas' : detalle.tipo === 'asistencias' ? 'Asistencias' : 'Ficha social'}</h3>
          {detalle.tipo === 'ficha' ? (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{detalle.data}</pre>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Nota</th>
                  <th>Faltas (%)</th>
                </tr>
              </thead>
              <tbody>
                {detalle.data.map((c, idx) => (
                  <tr key={idx}>
                    <td>{c.curso}</td>
                    <td>{c.nota}</td>
                    <td>{c.faltas}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function generarAlumnos(n) {
  const cursosBase = ['Matemática I', 'Física I', 'Química', 'Programación', 'Estadística']
  const fakeFicha = 'Situación socioeconómica referencial, vivienda alquilada, apoyo familiar parcial.'
  const list = []
  for (let i = 0; i < n; i++) {
    const cursos = cursosBase.map((nombre) => ({
      curso: nombre,
      nota: Math.floor(8 + Math.random() * 12),
      faltas: Math.floor(Math.random() * 30),
    }))
    const riesgoCursos = cursos.filter((c) => c.nota < 11).length
    const promedioFaltas = Math.round(cursos.reduce((a, b) => a + b.faltas, 0) / cursos.length)
    list.push({
      nombre: `Alumno ${i + 1}`,
      telefono: `9${Math.floor(10000000 + Math.random() * 8999999)}`,
      email: `alumno${i + 1}@unfv.edu.pe`,
      cursos,
      riesgoCursos,
      promedioFaltas,
      ficha: fakeFicha,
      nee: Math.random() < 0.15,
      repitente: Math.random() < 0.1,
    })
  }
  return list
}

function textoRendimiento(riesgoCursos) {
  if (riesgoCursos >= 4) return 'Bajo'
  if (riesgoCursos >= 2) return 'Regular'
  return 'Alto'
}

function colorRendimiento(riesgoCursos) {
  if (riesgoCursos >= 4) return '#d64545'
  if (riesgoCursos >= 2) return '#e0a52b'
  return '#1f8f4b'
}

function colorFaltas(p) {
  if (p > 25) return '#d64545'
  if (p >= 18) return '#e0a52b'
  return '#1f8f4b'
}
