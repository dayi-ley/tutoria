import { useState, useEffect, Fragment } from 'react'
import LogoutButton from '../auth/LogoutButton.jsx'
import HorarioCalendarioView from './HorarioCalendario.jsx'
import HistorialSesionesView from './HistorialSesiones.jsx'
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, setDoc, getDoc, getDocs, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore'
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
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [linkOk, setLinkOk] = useState('')
  const [pwdToast, setPwdToast] = useState('')

  return (
    <div className="docente-layout">
      <aside className="sidebar">
        <div className="user-panel">
          <div className="avatar" onClick={() => setShowPwdModal(true)} style={{ cursor: 'pointer' }}>👤</div>
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
                  <label htmlFor="newpwd-doc">Nueva contraseña</label>
                  <input id="newpwd-doc" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="newpwd2-doc">Confirmar contraseña</label>
                  <input id="newpwd2-doc" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
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
        {active !== 'documentos' && active !== 'mis-tutorias' && active !== 'horario' && (
          <div className="content-header">{sections.find((x) => x.key === active)?.label}</div>
        )}
        {active === 'mis-tutorias' ? (
          <MisTutoriasView ciclo={profile?.aula?.ciclo} seccion={profile?.aula?.seccion} docenteId={user?.email || user?.uid} docenteEmail={user?.email || ''} docenteNombre={name} />
        ) : (
          <div className="content-card">
            {active === 'documentos' ? (
              <DocumentosView uid={user?.uid} name={name} />
            ) : active === 'horario' ? (
              <HorarioCalendarioView docenteId={user?.uid} docenteEmail={user?.email || ''} />
            ) : active === 'historial-sesiones' ? (
              <HistorialSesionesView />
            ) : active === 'historial-derivaciones' ? (
              <DerivacionesHistorialView docenteId={user?.uid} docenteEmail={user?.email || ''} />
            ) : (
              <div className="placeholder">Contenido por implementar</div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function DerivacionesHistorialView({ docenteId, docenteEmail }) {
  const [items, setItems] = useState([])
  const [salonDoc, setSalonDoc] = useState({ ciclo: '', seccion: '' })
  const [aulaByAlumno, setAulaByAlumno] = useState({})
  useEffect(() => {
    if (!db) return
    const byIdValues = []
    if (docenteId) byIdValues.push(docenteId)
    if (docenteEmail) byIdValues.push(docenteEmail)
    const listeners = []
    const map = new Map()

    if (byIdValues.length === 1) {
      const q1 = query(collection(db, 'derivaciones'), where('docenteId', '==', byIdValues[0]))
      listeners.push(onSnapshot(q1, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        setItems(Array.from(map.values()).sort((a,b) => (b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0)))
      }, (err) => console.error('Error derivaciones by docenteId:', err?.code || err?.name, err?.message || String(err))))
    } else if (byIdValues.length > 1) {
      const qIn = query(collection(db, 'derivaciones'), where('docenteId', 'in', byIdValues))
      listeners.push(onSnapshot(qIn, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        setItems(Array.from(map.values()).sort((a,b) => (b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0)))
      }, (err) => console.error('Error derivaciones docenteId in:', err?.code || err?.name, err?.message || String(err))))
    }

    if (docenteEmail) {
      const q2 = query(collection(db, 'derivaciones'), where('docenteEmail', '==', docenteEmail))
      listeners.push(onSnapshot(q2, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        setItems(Array.from(map.values()).sort((a,b) => (b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0)))
      }, (err) => console.error('Error derivaciones by docenteEmail:', err?.code || err?.name, err?.message || String(err))))
    }

    return () => listeners.forEach((unsub) => { try { unsub() } catch (e) { void e } })
  }, [docenteId, docenteEmail])

  useEffect(() => {
    if (!db) return
    const key = docenteEmail || docenteId
    if (!key) return
    const q = query(collection(db, 'salones'), where('docenteTutor_id', '==', key))
    const unsub = onSnapshot(q, (snap) => {
      const first = snap.docs[0]?.data() || null
      if (first) setSalonDoc({ ciclo: String(first.ciclo || ''), seccion: String(first.seccion || '') })
    })
    return () => unsub()
  }, [docenteId, docenteEmail])

  useEffect(() => {
    if (!db) return
    const missing = items.filter((x) => (!x?.aula?.ciclo || !x?.aula?.seccion) && x?.alumnoId)
    if (!missing.length) return
    ;(async () => {
      const next = { ...aulaByAlumno }
      for (const it of missing) {
        try {
          const snap = await getDoc(doc(db, 'alumnos', it.alumnoId))
          const data = snap.exists() ? (snap.data() || {}) : {}
          if (data?.aula?.ciclo || data?.aula?.seccion) next[it.alumnoId] = data.aula
        } catch (e) { void e }
      }
      setAulaByAlumno(next)
    })()
  }, [items, aulaByAlumno])

  return (
    <div>
      <div className="table-responsive">
        <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Correo</th>
              <th>Destino</th>
              <th>Ciclo</th>
              <th>Sección</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td>{x.alumnoNombre || ''}</td>
                <td>{x.alumnoEmail || ''}</td>
                <td>{x.destino || ''}</td>
                <td>{x?.aula?.ciclo || aulaByAlumno[x.alumnoId]?.ciclo || salonDoc?.ciclo || ''}</td>
                <td>{x?.aula?.seccion || aulaByAlumno[x.alumnoId]?.seccion || salonDoc?.seccion || ''}</td>
                <td>{x.createdAt ? (x.createdAt.toDate ? x.createdAt.toDate().toLocaleString() : '') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        <div className="table-responsive">
        <table className="cumplimiento-grid">
          <thead>
            <tr>
              <th>PLAN</th>
              {mesesCiclo.map((m, idx) => (
                <Fragment key={m}>
                  <th>{`N° SESIONES ${etiquetasMes[idx].toUpperCase()}`}</th>
                  <th>{`INFORME ${etiquetasMes[idx].toUpperCase()}`}</th>
                </Fragment>
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
                <Fragment key={m}>
                  <td>
                    <span className={`badge ${((status.sesiones || {})[m] || 0) > 0 ? 'ok' : 'no'}`}>{(status.sesiones || {})[m] || 0}</span>
                  </td>
                  <td>
                    <span className={`badge ${((status.informes || {})[m]) ? 'ok' : 'no'}`}>{((status.informes || {})[m]) ? 'SI' : 'NO'}</span>
                  </td>
                </Fragment>
              ))}
              <td>
                <span className={`badge ${(status.finalCount || 0) > 0 ? 'ok' : 'no'}`}>{(status.finalCount || 0) > 0 ? 'SI' : 'NO'}</span>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
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

function MisTutoriasView({ ciclo, seccion, docenteId, docenteEmail, docenteNombre }) {
  const [alumnos, setAlumnos] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [seleccionados, setSeleccionados] = useState(() => new Set())
  const [tipoPorIdx, setTipoPorIdx] = useState([])
  const [derivados, setDerivados] = useState(() => new Set())
  const [usingFallback, setUsingFallback] = useState(false)
  const [derivarMenu, setDerivarMenu] = useState({ open: false, idx: null, nombre: '' })
  const [derivarToast, setDerivarToast] = useState('')
  const [salonDocente, setSalonDocente] = useState({ ciclo: ciclo || '', seccion: seccion || '', curso: '', dia: '' })
  const [derivacionesCount, setDerivacionesCount] = useState(0)
  const [newTutOpen, setNewTutOpen] = useState(false)
  const [newTutTema, setNewTutTema] = useState('')
  const [newTutTipo, setNewTutTipo] = useState('Presencial')
  const [newTutFecha, setNewTutFecha] = useState('')
  const [newTutInicio, setNewTutInicio] = useState('')
  const [newTutFin, setNewTutFin] = useState('')
  const [newTutSel, setNewTutSel] = useState([])
  const [newTutErr, setNewTutErr] = useState('')
  const [newTutOk, setNewTutOk] = useState('')
  const [newTutToast, setNewTutToast] = useState('')
  const todayStr = (() => { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${da}` })()

  useEffect(() => {
    if (!db) return
    const baseClauses = []
    if (docenteId) baseClauses.push(where('docenteTutorId', '==', docenteId))
    if (seccion) baseClauses.push(where('aula.seccion', '==', seccion))
    let q = baseClauses.length ? query(collection(db, 'alumnos'), ...baseClauses) : query(collection(db, 'alumnos'))
    let unsub = onSnapshot(q, (snap) => {
      const list = []
      let missingNombre = 0
      let missingEmail = 0
      let missingTelefono = 0
      let missingAula = 0
      snap.forEach((d) => {
        const x = d.data() || {}
        const cursos = Array.isArray(x.cursos) ? x.cursos : []
        const nombreComp = x.nombre || `${x.nombres || ''} ${x.apellidos || ''}`.trim()
        const totalCursos = cursos.length ? cursos.length : (x.notaPromedio != null ? 1 : 0)
        const aprobados = cursos.length ? cursos.filter((c) => (c.nota ?? 0) >= 11).length : (x.notaPromedio != null ? ((x.notaPromedio >= 11) ? 1 : 0) : 0)
        const rendimiento = totalCursos ? Math.round((aprobados / totalCursos) * 100) : 0
        const faltasPct = cursos.length ? Math.round((cursos.reduce((a, b) => a + (b.faltas ?? 0), 0)) / (cursos.length || 1)) : (x.faltasCantidad != null ? Math.round((Number(x.faltasCantidad) / 16) * 100) : 0)
        if (!nombreComp) { missingNombre++; console.warn('Alumno sin nombre:', d.id) }
        if (!x.email) { missingEmail++; console.warn('Alumno sin email:', d.id) }
        if (!x.telefono) { missingTelefono++; console.warn('Alumno sin teléfono:', d.id) }
        const aulaOk = x.aula && typeof x.aula === 'object' && x.aula.ciclo && x.aula.seccion
        if (!aulaOk) { missingAula++; console.warn('Alumno sin aula válida:', d.id, x.aula) }
        list.push({
          id: d.id,
          nombre: nombreComp || d.id,
          telefono: x.telefono || '',
          email: x.email || '',
          cursos,
          aula: x.aula || {},
          curso: x.curso || '',
          dia: x.dia || '',
          rendimiento,
          faltasPct,
          ficha: x.ficha || '',
          nee: !!x.nee,
          repitente: !!x.repitente,
        })
      })
      setAlumnos(list)
      setTipoPorIdx(list.map(() => 'Grupal'))
      console.log('Alumnos cargados:', list.length, {
        missingNombre,
        missingEmail,
        missingTelefono,
        missingAula,
        filtros: { docenteId: Boolean(docenteId), seccion: seccion || null, ciclo: ciclo || null, fallback: usingFallback }
      })
      if (!salonDocente.ciclo || !salonDocente.seccion) {
        const cand = list.find((a) => a?.aula?.ciclo && a?.aula?.seccion)
        if (cand) setSalonDocente({ ciclo: String(cand.aula.ciclo), seccion: String(cand.aula.seccion), curso: salonDocente.curso, dia: salonDocente.dia })
      }
      if (list.length === 0 && !usingFallback && seccion) {
        console.warn('Sin alumnos por docenteId. Probando fallback por aula (sección/ciclo).')
        setUsingFallback(true)
        unsub()
        const fallbackClauses = [where('aula.seccion', '==', seccion)]
        if (ciclo) fallbackClauses.push(where('aula.ciclo', '==', ciclo))
        q = query(collection(db, 'alumnos'), ...fallbackClauses)
        unsub = onSnapshot(q, (snap2) => {
          const list2 = []
          snap2.forEach((d2) => {
            const x = d2.data() || {}
            const cursos = Array.isArray(x.cursos) ? x.cursos : []
            const nombreComp = x.nombre || `${x.nombres || ''} ${x.apellidos || ''}`.trim()
            const totalCursos = cursos.length ? cursos.length : (x.notaPromedio != null ? 1 : 0)
            const aprobados = cursos.length ? cursos.filter((c) => (c.nota ?? 0) >= 11).length : (x.notaPromedio != null ? ((x.notaPromedio >= 11) ? 1 : 0) : 0)
            const rendimiento = totalCursos ? Math.round((aprobados / totalCursos) * 100) : 0
            const faltasPct = cursos.length ? Math.round((cursos.reduce((a, b) => a + (b.faltas ?? 0), 0)) / (cursos.length || 1)) : (x.faltasCantidad != null ? Math.round((Number(x.faltasCantidad) / 16) * 100) : 0)
            list2.push({
              id: d2.id,
              nombre: nombreComp || d2.id,
              telefono: x.telefono || '',
              email: x.email || '',
              cursos,
              aula: x.aula || {},
              curso: x.curso || '',
              dia: x.dia || '',
              rendimiento,
              faltasPct,
              ficha: x.ficha || '',
              nee: !!x.nee,
              repitente: !!x.repitente,
            })
          })
          setAlumnos(list2)
          setTipoPorIdx(list2.map(() => 'Grupal'))
          console.log('Alumnos cargados (fallback aula):', list2.length)
          if (list2.length === 0) console.warn('Sin alumnos para aula. Revisa datos en Firestore.')
        }, (err) => {
          console.error('Error en fallback aula:', err?.code || err?.name, err?.message || String(err))
        })
      }
    }, (err) => {
      console.error('Error escuchando alumnos:', err?.code || err?.name, err?.message || String(err))
    })
    return () => unsub()
  }, [docenteId, ciclo, seccion, usingFallback])

  useEffect(() => {
    if (!db || !docenteId) return
    const q = query(collection(db, 'salones'), where('docenteTutor_id', '==', docenteId))
    const unsub = onSnapshot(q, (snap) => {
      const first = snap.docs[0]?.data() || null
      if (first) {
        setSalonDocente({
          ciclo: String(first.ciclo || ciclo || ''),
          seccion: String(first.seccion || seccion || ''),
          curso: String(first.curso || ''),
          dia: String(first.dia || ''),
        })
      }
    }, (err) => console.error('Error cargando salón del docente:', err?.code || err?.name, err?.message || String(err)))
    return () => unsub()
  }, [docenteId, ciclo, seccion])

  useEffect(() => {
    if (!db) return
    const ids = []
    if (docenteId) ids.push(docenteId)
    if (docenteEmail) ids.push(docenteEmail)
    const listeners = []
    const map = new Map()
    if (ids.length === 1) {
      const q1 = query(collection(db, 'derivaciones'), where('docenteId', '==', ids[0]))
      listeners.push(onSnapshot(q1, (snap) => {
        snap.forEach((d) => map.set(d.id, 1))
        setDerivacionesCount(map.size)
      }))
    } else if (ids.length > 1) {
      const qIn = query(collection(db, 'derivaciones'), where('docenteId', 'in', ids))
      listeners.push(onSnapshot(qIn, (snap) => {
        snap.forEach((d) => map.set(d.id, 1))
        setDerivacionesCount(map.size)
      }))
      const q2 = query(collection(db, 'derivaciones'), where('docenteEmail', '==', docenteEmail))
      listeners.push(onSnapshot(q2, (snap) => {
        snap.forEach((d) => map.set(d.id, 1))
        setDerivacionesCount(map.size)
      }))
    }
    return () => listeners.forEach((u) => { try { u() } catch (e) { void e } })
  }, [docenteId, docenteEmail])


  const tutorados = alumnos.length
  const cicloLabel = (salonDocente?.ciclo || ciclo || '-')
  const seccionLabel = (salonDocente?.seccion || seccion || '-')
  const grupalCount = tipoPorIdx.filter((t) => t === 'Grupal').length
  const individualCount = tipoPorIdx.filter((t) => t === 'Individual').length
  
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

  const openNuevaTutoria = () => {
    setNewTutErr('')
    setNewTutOk('')
    if (seleccionados.size === 0) {
      setDerivarToast('Selecciona al menos un alumno')
      setTimeout(() => setDerivarToast(''), 2000)
      return
    }
    const arr = Array.from(seleccionados)
    setNewTutSel(arr)
    setNewTutTema('')
    setNewTutTipo('Presencial')
    setNewTutFecha('')
    setNewTutInicio('')
    setNewTutFin('')
    setNewTutOpen(true)
  }

  const removeSelIdx = (idx) => {
    const filtered = newTutSel.filter((v) => v !== idx)
    setNewTutSel(filtered)
  }

  const saveNuevaTutoria = async () => {
    setNewTutErr('')
    setNewTutOk('')
    if (!newTutTema.trim()) { setNewTutErr('Ingresa el tema a tratar'); setNewTutToast('Ingresa el tema a tratar'); setTimeout(() => setNewTutToast(''), 2500); return }
    if (newTutTema.trim().length > 120) { setNewTutErr('El tema no debe exceder 120 caracteres'); setNewTutToast('El tema no debe exceder 120 caracteres'); setTimeout(() => setNewTutToast(''), 2500); return }
    if (!newTutTipo) { setNewTutErr('Selecciona el tipo de sesión'); setNewTutToast('Selecciona el tipo de sesión'); setTimeout(() => setNewTutToast(''), 2500); return }
    if (!newTutFecha) { setNewTutErr('Selecciona la fecha'); setNewTutToast('Selecciona la fecha'); setTimeout(() => setNewTutToast(''), 2500); return }
    if (newTutFecha < todayStr) { setNewTutErr('No se permiten fechas anteriores a hoy'); setNewTutToast('No se permiten fechas anteriores a hoy'); setTimeout(() => setNewTutToast(''), 2500); return }
    if (!newTutInicio || !newTutFin) { setNewTutErr('Selecciona hora inicial y final'); setNewTutToast('Selecciona hora inicial y final'); setTimeout(() => setNewTutToast(''), 2500); return }
    if (newTutSel.length === 0) { setNewTutErr('Debes tener al menos un alumno'); setNewTutToast('Debes tener al menos un alumno'); setTimeout(() => setNewTutToast(''), 2500); return }
    const allowed = String(salonDocente.dia || '').toLowerCase()
    if (allowed) {
      const d = new Date(newTutFecha)
      const dn = d.getDay()
      const map = { 'domingo':0, 'lunes':1, 'martes':2, 'miercoles':3, 'miércoles':3, 'jueves':4, 'viernes':5, 'sabado':6, 'sábado':6 }
      const want = map[allowed] ?? null
      if (want != null && dn !== want) { setNewTutErr(`La fecha debe ser ${salonDocente.dia}`); setNewTutToast(`La fecha debe ser ${salonDocente.dia}`); setTimeout(() => setNewTutToast(''), 2500); return }
    }
    if (newTutInicio >= newTutFin) { setNewTutErr('La hora inicial debe ser menor que la final'); setNewTutToast('La hora inicial debe ser menor que la final'); setTimeout(() => setNewTutToast(''), 2500); return }
    try {
      const toMin = (t) => { const parts = String(t).split(':'); const h = parseInt(parts[0] || '0', 10); const m = parseInt(parts[1] || '0', 10); return (h * 60) + m }
      const qOverlap = query(collection(db, 'tutorias'), where('docenteId', '==', docenteId || ''), where('fecha', '==', newTutFecha))
      const snapOv = await getDocs(qOverlap)
      const sNew = toMin(newTutInicio)
      const eNew = toMin(newTutFin)
      let conflict = false
      snapOv.forEach((d) => {
        const x = d.data() || {}
        const sOld = toMin(x.horaInicio || '')
        const eOld = toMin(x.horaFin || '')
        if (sNew < eOld && sOld < eNew) conflict = true
      })
      if (conflict) { setNewTutErr('Existe una tutoría registrada en ese horario'); setNewTutToast('Existe una tutoría registrada en ese horario'); setTimeout(() => setNewTutToast(''), 2500); return }
      const alumnosIds = newTutSel.map((i) => alumnos[i]?.id).filter(Boolean)
      const aula = { ciclo: salonDocente.ciclo || ciclo || '', seccion: salonDocente.seccion || seccion || '' }
      const payload = {
        tema: newTutTema.trim(),
        tipoSesion: newTutTipo,
        alumnosIds,
        alumnosNombres: alumnosIds.map((id) => (alumnos.find((a) => a.id === id)?.nombre || '')),
        aula,
        curso: salonDocente.curso || '',
        dia: salonDocente.dia || '',
        fecha: newTutFecha,
        horaInicio: newTutInicio,
        horaFin: newTutFin,
        realizada: false,
        docenteId: docenteId || '',
        docenteEmail: docenteEmail || '',
        docenteNombre: docenteNombre || '',
        createdAt: serverTimestamp(),
      }
      const id = `${docenteId || 'docente'}-${Date.now()}`
      await setDoc(doc(db, 'tutorias', id), payload)
      setNewTutOpen(false)
      setNewTutOk('Tutoría registrada')
      setTimeout(() => setNewTutOk(''), 2000)
    } catch (e) {
      const msg = e?.message || String(e)
      setNewTutErr(msg)
      setNewTutToast(msg)
      setTimeout(() => setNewTutToast(''), 2500)
    }
  }

  return (
    <div>
      <div className="content-header-row small">
        <div className="header-actions left">
          <button className="btn-new small" onClick={openNuevaTutoria}>+ Nueva tutoría</button>
          <button className="btn-select-all small" onClick={toggleSelectAll}>{isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}</button>
          
        </div>
        <div className="stats-list right">
          <div className="stat-item"><span className="stat-icon">👥</span><span className="stat-label">Tutorados</span><span className="stat-value">{tutorados}</span></div>
          <div className="stat-item"><span className="stat-icon">🏷️</span><span className="stat-label">Ciclo</span><span className="stat-value">{cicloLabel}</span></div>
          <div className="stat-item"><span className="stat-icon">🔖</span><span className="stat-label">Sección</span><span className="stat-value">{seccionLabel}</span></div>
          <div className="stat-item"><span className="stat-icon">🧑‍🤝‍🧑</span><span className="stat-label">Grupal</span><span className="stat-value">{grupalCount}</span></div>
          <div className="stat-item"><span className="stat-icon">👤</span><span className="stat-label">Individual</span><span className="stat-value">{individualCount}</span></div>
          <div className="stat-item"><span className="stat-icon">🔗</span><span className="stat-label">Derivaciones</span><span className="stat-value">{derivacionesCount}</span></div>
          <div className="stat-item"><span className="stat-icon">♿</span><span className="stat-label">Estudiantes NEE</span><span className="stat-value">{neeCount}</span></div>
          <div className="stat-item"><span className="stat-icon">🔁</span><span className="stat-label">Repitentes</span><span className="stat-value">{repitentesCount}</span></div>
        </div>
      </div>
      <div className="table-responsive">
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
              <td style={{ color: colorRendimiento(a.rendimiento) }}>{textoRendimiento(a.rendimiento)}</td>
              <td style={{ color: colorFaltas(a.faltasPct) }}>{a.faltasPct}%</td>
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
                <button className={`btn-derivar ${derivados.has(i) ? 'active' : ''}`} onClick={() => setDerivarMenu({ open: true, idx: i, nombre: a.nombre })}>
                  <span className="icon-derive" aria-hidden="true">➡︎</span>
                  {derivados.has(i) ? 'Derivado' : 'Derivar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      
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

      {derivarMenu.open && (
        <div className="modal-backdrop" onClick={() => setDerivarMenu({ open: false, idx: null, nombre: '' })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>Derivar a: {derivarMenu.nombre || (alumnos[derivarMenu.idx]?.nombre || '')}</h4>
            <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.4rem' }}>
              {[
                'Servicios de Psicopedadogia | Direccion de bienestar universitario (Lic. Gina Talledo Herrada)',
                'Direccion de Bienestar universitario',
                'Servicios Medicos | Direccion de bienestar univesitario',
                'Servicios social | Direccion de bienestar universitario',
                'Oficina de defensoria universitaria',
              ].map((op) => (
                <button
                  key={op}
                  className="btn-save"
                  onClick={async () => {
                    try {
                      const next = new Set(derivados)
                      if (derivarMenu.idx != null) next.add(derivarMenu.idx)
                      setDerivados(next)
                      const nombre = alumnos[derivarMenu.idx]?.nombre || derivarMenu.nombre || 'Alumno'
                      const alumnoEmail = alumnos[derivarMenu.idx]?.email || ''
                      const alumnoId = alumnos[derivarMenu.idx]?.id || ''
                      const docId = `${docenteId || 'docente'}-${Date.now()}`
                      await setDoc(doc(db, 'derivaciones', docId), {
                        alumnoId,
                        alumnoNombre: nombre,
                        alumnoEmail,
                        docenteId: docenteId || '',
                        docenteEmail: docenteEmail || '',
                        docenteNombre: docenteNombre || '',
                        destino: op,
                        aula: {
                          ciclo: (salonDocente.ciclo || alumnos[derivarMenu.idx]?.aula?.ciclo || ciclo || ''),
                          seccion: (salonDocente.seccion || alumnos[derivarMenu.idx]?.aula?.seccion || seccion || ''),
                        },
                        curso: salonDocente.curso || alumnos[derivarMenu.idx]?.curso || '',
                        dia: salonDocente.dia || alumnos[derivarMenu.idx]?.dia || '',
                        createdAt: serverTimestamp(),
                      })
                      setDerivarMenu({ open: false, idx: null, nombre: '' })
                      setDerivarToast(`Alumno ${nombre}, derivado a ${op} con éxito`)
                      setTimeout(() => setDerivarToast(''), 2200)
                    } catch (err) {
                      console.error('Error guardando derivación:', err?.code || err?.name, err?.message || String(err))
                      setDerivarMenu({ open: false, idx: null, nombre: '' })
                      setDerivarToast('No se pudo guardar la derivación. Revisa permisos de Firestore')
                      setTimeout(() => setDerivarToast(''), 3000)
                    }
                  }}
                >{op}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {newTutOpen && (
        <div className="modal-backdrop" onClick={() => setNewTutOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(820px, 92vw)', margin: '2vh auto', boxSizing: 'border-box' }}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label htmlFor="tema">Tema a tratar</label>
              <input id="tema" type="text" value={newTutTema} onChange={(e) => setNewTutTema(e.target.value)} maxLength={120} />
            </div>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label htmlFor="tipoSesion">Tipo de sesión</label>
              <select id="tipoSesion" className="select-modal" value={newTutTipo} onChange={(e) => setNewTutTipo(e.target.value)}>
                <option>Presencial</option>
                <option>Virtual</option>
                <option>Otra</option>
              </select>
            </div>
            <div className="content-header" style={{ marginTop: '0.5rem', textAlign: 'left', color: '#000' }}>Alumnos seleccionados</div>
            <div style={{ display: 'grid', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '0.5rem', background: '#fff', color: '#222' }}>
              {newTutSel.map((idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{alumnos[idx]?.nombre || ''}</span>
                  <button className="btn-info" onClick={() => removeSelIdx(idx)}>Quitar</button>
                </div>
              ))}
              {newTutSel.length === 0 && <p>No hay alumnos seleccionados</p>}
            </div>
            <div className="content-header" style={{ marginTop: '1rem', textAlign: 'left' }}>Programación</div>
            <div style={{ display: 'block', width: '100%', maxWidth: '640px', background: '#fff', color: '#222', border: '1px solid #eee', borderRadius: '8px', padding: '0.6rem', boxSizing: 'border-box', overflowX: 'hidden' }}>
              <div style={{ textAlign: 'left', marginBottom: '0.6rem' }}>
                <label htmlFor="fechaTut">Fecha</label>
                <input id="fechaTut" type="date" min={todayStr} value={newTutFecha} onChange={(e) => setNewTutFecha(e.target.value)} />
                <small> dd/mm/aaaa</small>
                {salonDocente?.dia && <small> · Solo día: {salonDocente.dia}</small>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.6rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <label htmlFor="horaIni">Hora inicial</label>
                  <input id="horaIni" type="time" value={newTutInicio} onChange={(e) => setNewTutInicio(e.target.value)} />
                  <small> --:--</small>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <label htmlFor="horaFin">Hora final</label>
                  <input id="horaFin" type="time" value={newTutFin} onChange={(e) => setNewTutFin(e.target.value)} />
                  <small> --:--</small>
                </div>
              </div>
            </div>
            {newTutErr && <p className="error-text" style={{ marginTop: '0.25rem' }}>{newTutErr}</p>}
            {newTutOk && <p className="ok-text" style={{ marginTop: '0.25rem' }}>{newTutOk}</p>}
            <div className="actions" style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-confirm" onClick={saveNuevaTutoria}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {derivarToast && (
        <div className="tooltip-toast">
          <div className="tooltip-card">{derivarToast}</div>
        </div>
      )}
      {newTutToast && (
        <div className="tooltip-toast">
          <div className="tooltip-card">{newTutToast}</div>
        </div>
      )}
    </div>
  )
}

 

function textoRendimiento(pct) {
  if (pct < 50) return 'Bajo'
  if (pct < 80) return 'Regular'
  return 'Alto'
}

function colorRendimiento(pct) {
  if (pct < 50) return '#d64545'
  if (pct < 80) return '#e0a52b'
  return '#1f8f4b'
}

function colorFaltas(pct) {
  if (pct >= 30) return '#d64545'
  if (pct >= 20) return '#e0a52b'
  return '#1f8f4b'
}
