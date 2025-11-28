import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export default function HorarioCalendarioView({ docenteId, docenteEmail }) {
  const [current, setCurrent] = useState(() => new Date())
  const [items, setItems] = useState([])

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
                <div key={idx} className="cal-badge">{ev.tipoSesion || ''} {ev.horaInicio || ''}</div>
              ))}
            </div>
          )
        })}
      </div>
      <div className="cal-legend">
        <span className="legend-item pending">Programada</span>
        <span className="legend-item done">Realizada</span>
      </div>
    </div>
  )
}

