import { useState, useEffect, Fragment } from 'react'
import LogoutButton from '../auth/LogoutButton.jsx'
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore'
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
        {active !== 'documentos' && active !== 'mis-tutorias' && (
          <div className="content-header">{sections.find((x) => x.key === active)?.label}</div>
        )}
        {active === 'mis-tutorias' ? (
          <MisTutoriasView ciclo={profile?.aula?.ciclo} seccion={profile?.aula?.seccion} docenteId={user?.email || user?.uid} docenteEmail={user?.email || ''} docenteNombre={name} />
        ) : (
          <div className="content-card">
            {active === 'documentos' ? (
              <DocumentosView uid={user?.uid} name={name} />
            ) : active === 'historial-derivaciones' ? (
              <DerivacionesHistorialView docenteId={user?.email || user?.uid} />
            ) : (
              <div className="placeholder">Contenido por implementar</div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function DerivacionesHistorialView({ docenteId }) {
  const [items, setItems] = useState([])
  const [usingFallback, setUsingFallback] = useState(false)
  useEffect(() => {
    if (!db) return
    const clauses = []
    if (docenteId) clauses.push(where('docenteId', '==', docenteId))
    let q = clauses.length ? query(collection(db, 'derivaciones'), ...clauses) : query(collection(db, 'derivaciones'))
    let unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
      setItems(list)
      if (list.length === 0 && !usingFallback && docenteId) {
        setUsingFallback(true)
        unsub()
        const fb = query(collection(db, 'derivaciones'), where('docenteEmail', '==', docenteId))
        unsub = onSnapshot(fb, (snap2) => {
          const list2 = []
          snap2.forEach((d2) => list2.push({ id: d2.id, ...(d2.data() || {}) }))
          setItems(list2)
        }, (err) => console.error('Error derivaciones fallback:', err?.code || err?.name, err?.message || String(err)))
      }
    }, (err) => console.error('Error derivaciones:', err?.code || err?.name, err?.message || String(err)))
    return () => unsub()
  }, [docenteId, usingFallback])

  return (
    <div>
      <div className="content-header">Historial de derivaciones</div>
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
                <td>{x?.aula?.ciclo || ''}</td>
                <td>{x?.aula?.seccion || ''}</td>
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
                        aula: { ciclo: ciclo || '', seccion: seccion || '' },
                        curso: alumnos[derivarMenu.idx]?.curso || '',
                        dia: alumnos[derivarMenu.idx]?.dia || '',
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

      {derivarToast && (
        <div className="tooltip-toast">
          <div className="tooltip-card">{derivarToast}</div>
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
