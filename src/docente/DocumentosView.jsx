import { useState, useEffect, Fragment } from 'react'
import { jsPDF } from 'jspdf'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, setDoc, getDoc, getDocs, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore'
import { storage, db, supabase, storageProvider } from '../firebase'

export default function DocumentosView({ uid, name, email }) {
  const [periodo, setPeriodo] = useState('')
  const [planFile, setPlanFile] = useState(null)
  const [sesionesMes, setSesionesMes] = useState('')
  const [status, setStatus] = useState({ planCount: 0, informes: {}, sesiones: {}, aula: { ciclo: '2025-II', seccion: 'A' }, informeFinal: false, lastInformeFinalUrl: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [openPlan, setOpenPlan] = useState(false)
  const [openMensual, setOpenMensual] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (!uid || !db) return
      const refDoc = doc(db, 'cumplimientos_status', uid)
      const snap = await getDoc(refDoc)
      if (snap.exists()) {
        setStatus((prev) => ({ ...prev, ...snap.data() }))
        await setDoc(refDoc, { docente: { uid, nombre: name, email } }, { merge: true })
      } else {
        await setDoc(refDoc, { docente: { uid, nombre: name, email }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })
      }
    }
    run()
  }, [uid])

  useEffect(() => {
    const run = async () => {
      if (!uid || !db) return
      try {
        let aula = null
        const refDocente = doc(db, 'docentes', uid)
        const snapDoc = await getDoc(refDocente)
        if (snapDoc.exists()) aula = snapDoc.data()?.aula || null
        if (!aula) {
          const q1 = query(collection(db, 'tutorias'), where('docenteId', '==', uid), where('realizada', '==', true))
          const q2 = email ? query(collection(db, 'tutorias'), where('docenteEmail', '==', email), where('realizada', '==', true)) : null
          const acc = []
          const s1 = await getDocs(q1); s1.forEach((d) => acc.push(d.data()?.aula))
          if (q2) { const s2 = await getDocs(q2); s2.forEach((d) => acc.push(d.data()?.aula)) }
          aula = acc.find((a) => a && (a.ciclo || a.seccion)) || null
        }
        if (aula && (aula.ciclo || aula.seccion)) {
          setStatus((prev) => ({ ...prev, aula }))
          await setDoc(doc(db, 'cumplimientos_status', uid), { aula, docente: { uid, nombre: name, email }, updatedAt: serverTimestamp() }, { merge: true })
        }
      } catch (e) { void e }
    }
    run()
  }, [uid, email])

  const validatePdf = (f) => f && f.type === 'application/pdf' && f.size <= 12 * 1024 * 1024

  const uploadFile = async (path, file) => {
    if (storageProvider === 'supabase' && supabase) {
      const supaPath = path.replace(/^cumplimientos\//, '')
      const contentType = String(file?.type || '') || undefined
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true, contentType })
      if (error) throw error
      const { data } = supabase.storage.from('cumplimientos').getPublicUrl(supaPath)
      return data.publicUrl
    }
    if (storage) {
      const r = ref(storage, path)
      const metadata = { contentType: String(file?.type || '') || undefined }
      const up = await uploadBytes(r, file, metadata)
      return await getDownloadURL(up.ref)
    }
    if (supabase) {
      const supaPath = path.replace(/^cumplimientos\//, '')
      const contentType = String(file?.type || '') || undefined
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true, contentType })
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
      const next = { ...status, planCount: (status.planCount || 0) + 1, lastPlanUrl: url, docente: { uid, nombre: name, email }, updatedAt: serverTimestamp() }
      await setDoc(doc(db, 'cumplimientos_status', uid), next, { merge: true })
      setStatus(next)
      setPlanFile(null)
      setOkMsg('Plan registrado')
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const generateInformeFinal = async () => {
    if (!uid || !db) return
    setError(''); setOkMsg(''); setLoading(true)
    try {
      const sesiones = []
      const qId = query(collection(db, 'tutorias'), where('docenteId', '==', uid), where('realizada', '==', true))
      const sId = await getDocs(qId)
      const seen = new Set()
      sId.forEach((d) => { if (!seen.has(d.id)) { sesiones.push({ id: d.id, ...(d.data() || {}) }); seen.add(d.id) } })
      if (email) {
        const qEm = query(collection(db, 'tutorias'), where('docenteEmail', '==', email), where('realizada', '==', true))
        const sEm = await getDocs(qEm)
        sEm.forEach((d) => { if (!seen.has(d.id)) { sesiones.push({ id: d.id, ...(d.data() || {}) }); seen.add(d.id) } })
      }
      const sesionesCiclo = sesiones.filter((s) => mesesCiclo.some((m) => String(s.fecha || '').startsWith(m)))
      if (sesionesCiclo.length < 1) throw new Error('No hay sesiones en el ciclo')

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const margin = 40
      let y = margin
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text('Informe final de tutorías', pageW / 2, y, { align: 'center' })
      y += 28
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text(`Docente: ${name}`, margin, y)
      y += 18
      pdf.text(`Total de sesiones del ciclo: ${sesionesCiclo.length}`, margin, y)
      y += 22
      pdf.setFont('helvetica', 'bold')
      pdf.text('Resumen por mes', margin, y)
      y += 16
      pdf.setFont('helvetica', 'normal')
      const rowH = 16
      mesesCiclo.forEach((m, idx) => {
        const count = sesionesCiclo.filter((s) => String(s.fecha || '').startsWith(m)).length
        const label = etiquetasMes[idx]
        if (y + rowH > pdf.internal.pageSize.getHeight() - margin) { pdf.addPage(); y = margin }
        pdf.text(`${label}: ${count}`, margin, y)
        y += rowH
      })
      y += 10
      pdf.setFont('helvetica', 'bold')
      pdf.text('Detalle de sesiones del ciclo', margin, y)
      y += 16
      pdf.setFont('helvetica', 'normal')
      sesionesCiclo.sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))
      sesionesCiclo.forEach((s) => {
        if (y + rowH > pdf.internal.pageSize.getHeight() - margin) { pdf.addPage(); y = margin }
        const aulaStr = `${String(s?.aula?.ciclo || '')} · ${String(s?.aula?.seccion || '')}`
        pdf.text(`${s.fecha || ''} ${s.horaInicio || ''}-${s.horaFin || ''} · ${s.tipoSesion || ''} · ${s.tema || ''} · ${aulaStr}`, margin, y)
        y += rowH
      })
      const blob = pdf.output('blob')
      const file = new File([blob], `informe_final.pdf`, { type: 'application/pdf' })
      const path = `cumplimientos/${uid}/informe_final/informe_final.pdf`
      const url = await uploadFile(path, file)
      const next = { ...status, informeFinal: true, lastInformeFinalUrl: url, docente: { uid, nombre: name, email }, updatedAt: serverTimestamp() }
      await setDoc(doc(db, 'cumplimientos_status', uid), next, { merge: true })
      setStatus(next)
      setOkMsg('Informe final generado')
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

  useEffect(() => {
    if (!db || !uid) return
    const listeners = []
    const ids = []
    if (uid) ids.push(uid)
    if (email) ids.push(email)
    const map = new Map()
    const apply = () => {
      const arr = Array.from(map.values()).filter((x) => Boolean(x.realizada))
      const nextSes = {}
      for (const m of mesesCiclo) {
        nextSes[m] = arr.filter((x) => String(x.fecha || '').startsWith(m)).length
      }
      setStatus((prev) => ({ ...prev, sesiones: nextSes }))
      setDoc(doc(db, 'cumplimientos_status', uid), { sesiones: nextSes, docente: { uid, nombre: name, email }, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})
    }
    if (ids.length === 1) {
      const q1 = query(collection(db, 'tutorias'), where('docenteId', '==', ids[0]))
      listeners.push(onSnapshot(q1, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        apply()
      }))
    } else if (ids.length > 1) {
      const qIn = query(collection(db, 'tutorias'), where('docenteId', 'in', ids))
      listeners.push(onSnapshot(qIn, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        apply()
      }))
    }
    if (email) {
      const q2 = query(collection(db, 'tutorias'), where('docenteEmail', '==', email))
      listeners.push(onSnapshot(q2, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        apply()
      }))
    }
    return () => listeners.forEach((u) => { try { u() } catch (e) { void e } })
  }, [uid, email])

  const contarSesionesPeriodo = async (per) => {
    if (!uid || !db || !per) return 0
    const start = `${per}-01`
    const end = `${per}-31`
    const inMonth = (f) => {
      const s = String(f || '')
      return s >= start && s <= end
    }
    const qId = query(collection(db, 'tutorias'), where('docenteId', '==', uid))
    const snapId = await getDocs(qId)
    const ids = new Set()
    snapId.forEach((d) => {
      const data = d.data() || {}
      if (data.realizada && inMonth(data.fecha)) ids.add(d.id)
    })
    if (email) {
      const qEm = query(collection(db, 'tutorias'), where('docenteEmail', '==', email))
      const snapEm = await getDocs(qEm)
      snapEm.forEach((d) => {
        const data = d.data() || {}
        if (data.realizada && inMonth(data.fecha)) ids.add(d.id)
      })
    }
    return ids.size
  }

  useEffect(() => {
    const run = async () => {
      if (!uid || !db || !periodo) return
      const n = await contarSesionesPeriodo(periodo)
      setSesionesMes(String(n))
      setStatus((prev) => ({ ...prev, sesiones: { ...(prev.sesiones || {}), [periodo]: n } }))
    }
    run()
  }, [uid, periodo])

  useEffect(() => {
    const run = async () => {
      if (!uid || !db) return
      const nextSes = { ...(status.sesiones || {}) }
      for (const m of mesesCiclo) {
        nextSes[m] = await contarSesionesPeriodo(m)
      }
      setStatus((prev) => ({ ...prev, sesiones: nextSes }))
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const getPeriodoActual = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }

  const generateInformeMensual = async (perOverride) => {
    if (!uid || !db) return
    const per = perOverride || periodo || getPeriodoActual()
    if (!per) { setError('Selecciona periodo'); return }
    setPeriodo(per)
    setError(''); setOkMsg(''); setLoading(true)
    try {
      const start = `${per}-01`
      const end = `${per}-31`
      const sesiones = []
      const qId = query(collection(db, 'tutorias'), where('docenteId', '==', uid))
      const sId = await getDocs(qId)
      const seen = new Set()
      sId.forEach((d) => {
        const data = d.data() || {}
        if (data.realizada && String(data.fecha || '') >= start && String(data.fecha || '') <= end) {
          if (!seen.has(d.id)) { sesiones.push({ id: d.id, ...data }); seen.add(d.id) }
        }
      })
      if (email) {
        const qEm = query(collection(db, 'tutorias'), where('docenteEmail', '==', email))
        const sEm = await getDocs(qEm)
        sEm.forEach((d) => {
          const data = d.data() || {}
          if (data.realizada && String(data.fecha || '') >= start && String(data.fecha || '') <= end) {
            if (!seen.has(d.id)) { sesiones.push({ id: d.id, ...data }); seen.add(d.id) }
          }
        })
      }

      const minSes = 1
      if (sesiones.length < minSes) {
        throw new Error(`Se requieren al menos ${minSes} sesiones en el mes`)
      }

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const margin = 40
      let y = margin
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text('Informe mensual de tutorías', pageW / 2, y, { align: 'center' })
      y += 28
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      const periodoLabel = new Date(`${per}-01`).toLocaleString(undefined, { month: 'long', year: 'numeric' })
      pdf.text(`Periodo: ${periodoLabel}`, margin, y)
      y += 18
      pdf.text(`Docente: ${name}`, margin, y)
      y += 18
      pdf.text(`Total de sesiones realizadas: ${sesiones.length}`, margin, y)
      y += 22
      pdf.setFont('helvetica', 'bold')
      pdf.text('Detalle de sesiones', margin, y)
      y += 16
      pdf.setFont('helvetica', 'normal')
      const rowH = 16
      sesiones.sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))
      sesiones.forEach((s) => {
        if (y + rowH > pdf.internal.pageSize.getHeight() - margin) { pdf.addPage(); y = margin }
        const aulaStr = `${String(s?.aula?.ciclo || '')} · ${String(s?.aula?.seccion || '')}`
        const presentCount = Array.isArray(s?.asistencia) ? s.asistencia.filter((x) => Boolean(x?.presente)).length : (typeof s?.asistenciaMarcados === 'number' ? s.asistenciaMarcados : 0)
        const evidCount = Number(s?.evidenciaCount || (Array.isArray(s?.evidenciaUrls) ? s.evidenciaUrls.length : 0) || 0)
        const compTxt = String(s?.compromiso || '')
        const compStr = compTxt ? `Comp:${compTxt.slice(0, 40)}${compTxt.length > 40 ? '…' : ''}` : ''
        pdf.text(`${s.fecha || ''} ${s.horaInicio || ''}-${s.horaFin || ''} · ${s.tipoSesion || ''} · ${s.tema || ''} · ${aulaStr} · Asist:${presentCount} · Evid:${evidCount} ${compStr}`, margin, y)
        y += rowH
      })
      const blob = pdf.output('blob')
      const file = new File([blob], `informe_${per}.pdf`, { type: 'application/pdf' })
      const path = `cumplimientos/${uid}/informes_mensuales/${per}/informe.pdf`
      const url = await uploadFile(path, file)
      const informes = { ...(status.informes || {}) }
      informes[per] = true
      const nextSes = { ...(status.sesiones || {}), [per]: sesiones.length }
      const next = { ...status, informes, sesiones: nextSes, docente: { uid, nombre: name, email }, updatedAt: serverTimestamp(), [`lastInforme_${per}`]: url }
      await setDoc(doc(db, 'cumplimientos_status', uid), next, { merge: true })
      setStatus(next)
      setOkMsg('Informe mensual generado')
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

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
                    {((status.informes || {})[m]) ? (
                      <a className="badge ok" href={(status || {})[`lastInforme_${m}`]} target="_blank" rel="noopener noreferrer">SI</a>
                    ) : (
                      <span className="badge no">NO</span>
                    )}
                  </td>
                </Fragment>
              ))}
              <td>
                {status.informeFinal ? (
                  <a className="badge ok" href={status.lastInformeFinalUrl} target="_blank" rel="noopener noreferrer">SI</a>
                ) : (
                  <span className="badge no">NO</span>
                )}
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
          <button className="action-btn" onClick={() => generateInformeMensual(getPeriodoActual())}>🗓️ Informe mensual</button>
          <button className="action-btn" onClick={generateInformeFinal}>📘 Informe final</button>
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
              <button onClick={generateInformeMensual} disabled={loading || !periodo}>Generar informe</button>
            </div>
            <div className="modal-actions">
              <button onClick={() => setOpenMensual(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  )
}
