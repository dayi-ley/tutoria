import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

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
  const guardarGestion = () => {
    setOkToast('Gestión guardada')
    setTimeout(() => setOkToast(''), 1800)
    closeManage()
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
            <div key={day} className={`cal-cell ${cls}`}>
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
    </div>
  )
}
