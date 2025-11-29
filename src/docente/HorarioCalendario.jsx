import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import { db, supabase, storage, storageProvider } from '../firebase'

export default function HorarioCalendarioView({ docenteId, docenteEmail }) {
  const [current, setCurrent] = useState(() => new Date())
  const [items, setItems] = useState([])
  const [manageOpen, setManageOpen] = useState(false)
  const [manageItem, setManageItem] = useState(null)
  const [compromiso, setCompromiso] = useState('')
  const [asistAll, setAsistAll] = useState(false)
  const [asistMarks, setAsistMarks] = useState([])
  const [evFiles, setEvFiles] = useState([])
  const [okToast, setOkToast] = useState('')
  const [errToast, setErrToast] = useState('')
  const ENABLE_PDF = true
  const REQUIRE_EVIDENCE = true
  const ENABLE_EVIDENCE_UPLOAD = true

  useEffect(() => {
    if (!db) return
    const ids = []
    if (docenteId) ids.push(docenteId)
    if (docenteEmail) ids.push(docenteEmail)
    const listeners = []
    const map = new Map()
    if (ids.length === 1) {
      const q1 = query(collection(db, 'tutorias'), where('docenteId', '==', ids[0]))
      listeners.push(onSnapshot(q1, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        setItems(Array.from(map.values()))
      }))
    } else if (ids.length > 1) {
      const qIn = query(collection(db, 'tutorias'), where('docenteId', 'in', ids))
      listeners.push(onSnapshot(qIn, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        setItems(Array.from(map.values()))
      }))
      const q2 = query(collection(db, 'tutorias'), where('docenteEmail', '==', docenteEmail))
      listeners.push(onSnapshot(q2, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        setItems(Array.from(map.values()))
      }))
    }
    return () => listeners.forEach((u) => { try { u() } catch (e) { void e } })
  }, [docenteId, docenteEmail])

  const year = current.getFullYear()
  const month = current.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  const days = end.getDate()
  const startWeekday = start.getDay()
  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const byDate = new Map()
  items.forEach((x) => {
    const f = String(x.fecha || '')
    if (!f) return
    const list = byDate.get(f) || []
    list.push(x)
    byDate.set(f, list)
  })

  const prevMonth = () => { const d = new Date(current); d.setMonth(d.getMonth() - 1); setCurrent(d) }
  const nextMonth = () => { const d = new Date(current); d.setMonth(d.getMonth() + 1); setCurrent(d) }

  const toStr = (d) => {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }

  const openManage = (ev) => {
    const names = Array.isArray(ev.alumnosNombres) ? ev.alumnosNombres : []
    setManageItem(ev)
    setCompromiso('')
    setAsistAll(false)
    setAsistMarks(names.map(() => false))
    setEvFiles([])
    setManageOpen(true)
  }
  const closeManage = () => {
    setManageOpen(false)
    setManageItem(null)
    setCompromiso('')
    setAsistMarks([])
    setEvFiles([])
    setAsistAll(false)
  }
  const toggleAll = () => {
    const next = !asistAll
    setAsistAll(next)
    setAsistMarks(asistMarks.map(() => next))
  }
  const toggleIdx = (i) => {
    const next = [...asistMarks]
    next[i] = !next[i]
    setAsistMarks(next)
    setAsistAll(next.every(Boolean))
  }
  const onChooseFiles = (e) => {
    const arr = Array.from(e.target.files || [])
    setEvFiles(arr)
  }
  const convertImageToJpeg = (file) => new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('No se pudo convertir la imagen')) ; return }
            const name = (file.name || 'evidencia.jpg').replace(/\.[^.]+$/, '.jpg')
            const jpegFile = new File([blob], name, { type: 'image/jpeg' })
            resolve(jpegFile)
          }, 'image/jpeg', 0.92)
        }
        img.onerror = () => reject(new Error('No se pudo leer la imagen'))
        img.src = reader.result
      }
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    } catch (e) {
      reject(e)
    }
  })
  const prepareEvidenceFile = async (file) => {
    const t = String(file?.type || '')
    if (storageProvider === 'supabase') {
      if (!t || !t.startsWith('image/')) return file
      if (t !== 'image/jpeg') {
        const jpeg = await convertImageToJpeg(file)
        return jpeg
      }
    }
    return file
  }
  const uploadEvidence = async (path, file) => {
    // Preferir Supabase para evitar CORS de Firebase; si falla, intentar Firebase
    const supaPath = path.replace(/^tutorias\//, '')
    const contentType = String(file?.type || '') || undefined
    if (supabase) {
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true, contentType })
      if (!error) {
        const { data } = supabase.storage.from('cumplimientos').getPublicUrl(supaPath)
        return data.publicUrl
      }
    }
    if (storage) {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
      const r = ref(storage, path)
      const metadata = { contentType }
      const up = await uploadBytes(r, file, metadata)
      return await getDownloadURL(up.ref)
    }
    throw new Error('No hay storage configurado')
  }
  const uploadPdf = async (path, file) => {
    if (storageProvider === 'supabase' && supabase) {
      const supaPath = path.replace(/^tutorias\//, '')
      const contentType = String(file?.type || '') || undefined
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true, contentType })
      if (error) {
        if (storage) {
          const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
          const rfb = ref(storage, path)
          const metadata = { contentType }
          const upfb = await uploadBytes(rfb, file, metadata)
          return await getDownloadURL(upfb.ref)
        }
        throw error
      }
      const { data } = supabase.storage.from('cumplimientos').getPublicUrl(supaPath)
      return data.publicUrl
    }
    if (storage) {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
      const r = ref(storage, path)
      const metadata = { contentType: String(file?.type || '') || undefined }
      const up = await uploadBytes(r, file, metadata)
      return await getDownloadURL(up.ref)
    }
    if (supabase) {
      const supaPath = path.replace(/^tutorias\//, '')
      const contentType = String(file?.type || '') || undefined
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true, contentType })
      if (error) throw error
      const { data } = supabase.storage.from('cumplimientos').getPublicUrl(supaPath)
      return data.publicUrl
    }
    throw new Error('No hay storage configurado')
  }
  const guardarGestion = async () => {
    if (!manageItem) return
    const compromisoTxt = String(compromiso || '').trim()
    console.log('guardarGestion:start', { manageItemId: manageItem?.id, docenteId, docenteEmail, evCount: evFiles.length, storageProvider })
    if (!db) { console.log('firebase:not-configured'); setErrToast('Firebase no está configurado'); setTimeout(() => setErrToast(''), 2200); return }
    setOkToast('Procesando…')
    setTimeout(() => setOkToast(''), 1800)
    if (!compromisoTxt) { console.log('validacion: compromiso vacío'); setErrToast('Ingresa el compromiso de la tutoría'); setTimeout(() => setErrToast(''), 2200); return }
    const marcas = Array.isArray(asistMarks) ? asistMarks : []
    const algunMarcado = marcas.some(Boolean)
    if (!algunMarcado) { console.log('validacion: asistencia sin marcar'); setErrToast('Marca al menos un alumno en asistencia'); setTimeout(() => setErrToast(''), 2200); return }
    if (REQUIRE_EVIDENCE) {
      if (!Array.isArray(evFiles) || evFiles.length < 2) { console.log('validacion: insuficientes evidencias', evFiles?.length || 0); setErrToast('Sube 2 imágenes de evidencia'); setTimeout(() => setErrToast(''), 2200); return }
      const allImages = evFiles.every((f) => String(f?.type || '').startsWith('image/'))
      if (!allImages) { console.log('validacion: evidencia no imagen', evFiles.map((f) => f?.type)); setErrToast('Solo se permiten imágenes como evidencia'); setTimeout(() => setErrToast(''), 2200); return }
    }
    try {
      const key = String(manageItem.docenteId || docenteId || docenteEmail || 'docente')
      const base = `tutorias/${key}/${manageItem.id}/`
      console.log('upload: base path', base, { supabase: Boolean(supabase), storage: Boolean(storage), storageProvider })
      const urls = []
      if (ENABLE_EVIDENCE_UPLOAD && Array.isArray(evFiles) && evFiles.length > 0) {
        for (let i = 0; i < evFiles.length; i++) {
          const f0 = evFiles[i]
          console.log('evidencia', { i, name: f0?.name, type: f0?.type })
          const f = await prepareEvidenceFile(f0)
          console.log('evidencia-prep', { i, type: f?.type })
          const name = (f?.name || `evidencia_${i+1}.jpg`).replace(/\s+/g, '_')
          const path = `${base}${Date.now()}_${name}`
          const url = await uploadEvidence(path, f)
          console.log('evidencia-url', { i, url })
          urls.push(url)
        }
      } else {
        console.log('evidencias: subida desactivada, se guardará sin URLs')
      }
      const nombres = Array.isArray(manageItem.alumnosNombres) ? manageItem.alumnosNombres : []
      const ids = Array.isArray(manageItem.alumnosIds) ? manageItem.alumnosIds : []
      const asistencia = nombres.map((n, i) => ({ id: ids[i] || '', nombre: n, presente: Boolean(marcas[i]) }))
      const payload = {
        compromiso: compromisoTxt,
        asistencia,
        asistenciaMarcados: asistencia.filter((x) => x.presente).length,
        evidenciaUrls: urls,
        evidenciaCount: urls.length,
        realizada: true,
        realizadaAt: serverTimestamp(),
        docenteId: manageItem.docenteId || docenteId || '',
        docenteEmail: manageItem.docenteEmail || docenteEmail || '',
        docenteNombre: manageItem.docenteNombre || '',
      }
      console.log('firestore:setDoc payload', payload)
      await setDoc(doc(db, 'tutorias', manageItem.id), payload, { merge: true })
      console.log('firestore:setDoc ok', manageItem.id)

      try {
        const periodo = String(manageItem.fecha || '').slice(0, 7)
        if (periodo) {
          const start = `${periodo}-01`
          const end = `${periodo}-31`
          const idsSet = new Set()
          const qId = query(collection(db, 'tutorias'), where('docenteId', '==', payload.docenteId))
          const sId = await getDocs(qId)
          sId.forEach((d) => {
            const data = d.data() || {}
            if (data.realizada && String(data.fecha || '') >= start && String(data.fecha || '') <= end) idsSet.add(d.id)
          })
          if (payload.docenteEmail) {
            const qEm = query(collection(db, 'tutorias'), where('docenteEmail', '==', payload.docenteEmail))
            const sEm = await getDocs(qEm)
            sEm.forEach((d) => {
              const data = d.data() || {}
              if (data.realizada && String(data.fecha || '') >= start && String(data.fecha || '') <= end) idsSet.add(d.id)
            })
          }
          await updateDoc(doc(db, 'cumplimientos_status', payload.docenteId), { [`sesiones.${periodo}`]: idsSet.size })
        }
      } catch (e) { void e }

      if (ENABLE_PDF) {
        const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
        const pageW = pdf.internal.pageSize.getWidth()
        const margin = 40
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(16)
        pdf.text('Constancia de Tutoría', pageW / 2, margin, { align: 'center' })
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(11)
        let y = margin + 24
        pdf.setFont('helvetica', 'bold')
        pdf.text('Datos de la tutoría', margin, y)
        pdf.setFont('helvetica', 'normal')
        y += 16
        const leftCol = [
          ['Docente', String(manageItem.docenteNombre || '')],
          ['Fecha', String(manageItem.fecha || '')],
          ['Hora', `${String(manageItem.horaInicio || '')} - ${String(manageItem.horaFin || '')}`],
        ]
        const rightCol = [
          ['Tipo', String(manageItem.tipoSesion || '')],
          ['Tema', String(manageItem.tema || '')],
          ['Aula', `${String(manageItem?.aula?.ciclo || '')} · ${String(manageItem?.aula?.seccion || '')}`],
        ]
        const colX1 = margin
        const colX2 = margin + 280
        leftCol.forEach(([k, v], i) => { pdf.text(`${k}: ${v}`, colX1, y + i * 18) })
        rightCol.forEach(([k, v], i) => { pdf.text(`${k}: ${v}`, colX2, y + i * 18) })
        y += Math.max(leftCol.length, rightCol.length) * 18 + 8
        pdf.setFont('helvetica', 'bold')
        pdf.text('Día de clase', margin, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(String(manageItem.dia || ''), margin + 100, y)
        y += 22
        pdf.setFont('helvetica', 'bold')
        pdf.text('Compromiso', margin, y)
        y += 8
        const boxH = 80
        pdf.rect(margin, y, pageW - margin * 2, boxH)
        const compLines = pdf.splitTextToSize(String(compromisoTxt), pageW - margin * 2 - 12)
        compLines.forEach((t, i) => { pdf.text(t, margin + 6, y + 18 + i * 14) })
        y += boxH + 18
        pdf.setFont('helvetica', 'bold')
        pdf.text('Asistencia', margin, y)
        y += 10
        const tblX = margin
        const tblW = pageW - margin * 2
        const colW1 = tblW * 0.75
        const rowH = 18
        pdf.setDrawColor(0)
        pdf.setLineWidth(0.8)
        pdf.rect(tblX, y, tblW, rowH)
        pdf.text('Alumno', tblX + 6, y + 12)
        pdf.text('Presente', tblX + colW1 + 6, y + 12)
        let ty = y + rowH
        asistencia.forEach((r) => {
          if (ty + rowH > pdf.internal.pageSize.getHeight() - margin) { pdf.addPage(); ty = margin }
          pdf.rect(tblX, ty, tblW, rowH)
          pdf.text(String(r.nombre || ''), tblX + 6, ty + 12)
          pdf.text(r.presente ? 'Sí' : 'No', tblX + colW1 + 6, ty + 12)
          ty += rowH
        })
        y = ty + 10
        pdf.setFont('helvetica', 'bold')
        pdf.text('Evidencias', margin, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`${urls.length} imagen(es)`, margin + 90, y)
        const blob = pdf.output('blob')
        console.log('pdf:generated', { size: blob.size })
        const pdfFile = new File([blob], `constancia_${Date.now()}.pdf`, { type: 'application/pdf' })
        const pdfPath = `${base}constancia_${Date.now()}.pdf`
        const pdfUrl = await uploadPdf(pdfPath, pdfFile)
        console.log('pdf:uploaded', { pdfUrl })
        await setDoc(doc(db, 'tutorias', manageItem.id), { pdfUrl }, { merge: true })
        console.log('firestore:setDoc pdfUrl ok', manageItem.id)
        try {
          const periodo = String(manageItem.fecha || '').slice(0, 7)
          if (periodo) {
            await updateDoc(doc(db, 'cumplimientos_status', payload.docenteId), { [`constanciasPorMes.${periodo}.${manageItem.id}`]: pdfUrl, updatedAt: serverTimestamp() })
          }
        } catch (e) { void e }
      }

      setOkToast('Gestión guardada')
      setTimeout(() => setOkToast(''), 1800)
      console.log('guardarGestion:success')
      closeManage()
    } catch (e) {
      console.error('guardarGestion:error', e)
      setErrToast(e?.message || String(e))
      setTimeout(() => setErrToast(''), 2500)
    }
  }

  return (
    <div>
      <div className="content-header">Calendario de tutorías</div>
      <div className="cal-header">
        <button className="btn-select-all" onClick={prevMonth}>◀</button>
        <div className="cal-title">{start.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
        <button className="btn-select-all" onClick={nextMonth}>▶</button>
      </div>
      <div className="cal-grid">
        {labels.map((l, i) => (<div key={i} className="cal-cell cal-head">{l}</div>))}
        {Array.from({ length: startWeekday }).map((_, i) => (<div key={`empty-${i}`} className="cal-cell cal-empty" />))}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1
          const key = toStr(day)
          const arr = byDate.get(key) || []
          const hasDone = arr.some((ev) => Boolean(ev.realizada))
          const hasPending = arr.length > 0 && !hasDone
          const cls = hasDone ? 'cal-has-done' : (hasPending ? 'cal-has-pending' : '')
          return (
            <div
              key={day}
              className={`cal-cell ${cls}`}
              style={{ cursor: arr.length ? 'pointer' : 'default' }}
              onClick={() => { if (arr.length) openManage(arr[0]) }}
            >
              <div className="cal-day-number">{day}</div>
              {arr.slice(0, 3).map((ev, idx) => (
                <div key={idx} className="cal-badge" style={{ cursor: 'pointer' }} onClick={() => openManage(ev)}>{ev.tipoSesion || ''} {ev.horaInicio || ''}</div>
              ))}
            </div>
          )
        })}
      </div>
      <div className="cal-legend">
        <span className="legend-item pending">Programada</span>
        <span className="legend-item done">Realizada</span>
      </div>
      {manageOpen && manageItem && (
        <div className="modal-backdrop" onClick={closeManage}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(1040px, 96vw)', maxHeight: '96vh', overflow: 'hidden', margin: '2vh auto', boxSizing: 'border-box', paddingBottom: '0.9rem', fontSize: '0.92rem' }}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Compromiso de la tutoría</label>
              <textarea value={compromiso} onChange={(e) => setCompromiso(e.target.value)} rows={2} style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem', borderRadius: '8px', border: '1px solid #dcdcdc', background: '#fff', color: '#222' }} />
            </div>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Tipo de sesión</label>
              <input type="text" value={manageItem.tipoSesion || ''} readOnly style={{ padding: '0.35rem 0.5rem', fontSize: '0.86rem' }} />
            </div>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Programación</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input type="date" value={manageItem.fecha || ''} readOnly style={{ padding: '0.35rem 0.5rem', fontSize: '0.86rem', height: '32px' }} />
                <input type="time" value={manageItem.horaInicio || ''} readOnly style={{ padding: '0.35rem 0.5rem', fontSize: '0.86rem', height: '32px' }} />
                <input type="time" value={manageItem.horaFin || ''} readOnly style={{ padding: '0.35rem 0.5rem', fontSize: '0.86rem', height: '32px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
              <div className="content-header" style={{ textAlign: 'left', margin: 0 }}>Asistencia de alumnos</div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                Marcar todo
                <input type="checkbox" checked={asistAll} onChange={toggleAll} />
              </label>
            </div>
            <div style={{ display: 'grid', gap: '0.2rem', maxHeight: '18vh', overflowY: 'auto', border: 0, borderRadius: '8px', padding: '0.3rem', background: '#fff', color: '#222', fontSize: '0.74rem', lineHeight: 1.0 }}>
              {(Array.isArray(manageItem.alumnosNombres) ? manageItem.alumnosNombres : []).map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.74rem' }}>{n}</span>
                  <input type="checkbox" checked={Boolean(asistMarks[i])} onChange={() => toggleIdx(i)} />
                </div>
              ))}
            </div>
            <div className="form-group" style={{ textAlign: 'left', marginTop: '0.6rem' }}>
              <label>Evidencia (2 imágenes)</label>
              <input type="file" accept="image/*" multiple onChange={onChooseFiles} />
              <small>{evFiles.length ? `${evFiles.length} seleccionadas` : 'Selecciona 2 imágenes'}</small>
            </div>
            <div className="actions" style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-save" onClick={closeManage}>Cancelar</button>
              <button className="btn-confirm" onClick={guardarGestion}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {okToast && (
        <div className="tooltip-toast">
          <div className="tooltip-card success">{okToast}</div>
        </div>
      )}
      {errToast && (
        <div className="tooltip-toast">
          <div className="tooltip-card">{errToast}</div>
        </div>
      )}
    </div>
  )
}
