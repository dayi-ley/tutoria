import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export default function HistorialSesionesView({ docenteId, docenteEmail }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!db) return
    console.log('HistorialSesiones:mount', { docenteId, docenteEmail })
    const ids = []
    if (docenteId) ids.push(docenteId)
    if (docenteEmail) ids.push(docenteEmail)
    const listeners = []
    const map = new Map()
    if (ids.length === 1) {
      const q1 = query(collection(db, 'tutorias'), where('docenteId', '==', ids[0]))
      listeners.push(onSnapshot(q1, (snap) => {
        console.log('HistorialSesiones:snap docenteId eq size', snap.size)
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        const arr = Array.from(map.values()).filter((x) => Boolean(x.realizada))
        console.log('HistorialSesiones:items eq', arr.length)
        setItems(arr.sort((a,b) => String(b.fecha||'').localeCompare(String(a.fecha||''))))
      }, (err) => {
        console.error('HistorialSesiones:onSnapshot error eq', err)
      }))
    } else if (ids.length > 1) {
      const qIn = query(collection(db, 'tutorias'), where('docenteId', 'in', ids))
      listeners.push(onSnapshot(qIn, (snap) => {
        console.log('HistorialSesiones:snap docenteId in size', snap.size)
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        const arr = Array.from(map.values()).filter((x) => Boolean(x.realizada))
        console.log('HistorialSesiones:items in', arr.length)
        setItems(arr.sort((a,b) => String(b.fecha||'').localeCompare(String(a.fecha||''))))
      }, (err) => {
        console.error('HistorialSesiones:onSnapshot error in', err)
      }))
      const q2 = query(collection(db, 'tutorias'), where('docenteEmail', '==', docenteEmail))
      listeners.push(onSnapshot(q2, (snap) => {
        console.log('HistorialSesiones:snap docenteEmail eq size', snap.size)
        snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }))
        const arr = Array.from(map.values()).filter((x) => Boolean(x.realizada))
        console.log('HistorialSesiones:items email eq', arr.length)
        setItems(arr.sort((a,b) => String(b.fecha||'').localeCompare(String(a.fecha||''))))
      }, (err) => {
        console.error('HistorialSesiones:onSnapshot error email eq', err)
      }))
    }
    return () => listeners.forEach((u) => { try { u() } catch (e) { void e } })
  }, [docenteId, docenteEmail])

  return (
    <div>
      <div className="table-responsive">
        <table className="historial-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>N°</th>
              <th>Tema</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Tipo</th>
              <th>Compromiso</th>
              <th>Aula</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#666' }}>Sin registros</td>
              </tr>
            ) : (
              items.map((x, i) => (
                <tr key={x.id}>
                  <td>{i + 1}</td>
                  <td>{x.tema || ''}</td>
                  <td>{x.fecha || ''}</td>
                  <td>{x.horaInicio || ''} - {x.horaFin || ''}</td>
                  <td>{x.tipoSesion || ''}</td>
                  <td>{x.compromiso || ''}</td>
                  <td>{x?.aula?.ciclo || ''} · {x?.aula?.seccion || ''}</td>
                  <td>
                    <span className={`status-badge ${x.realizada ? 'ok' : 'no'}`}>{x.realizada ? 'REALIZADA' : 'PROGRAMADA'}</span>
                  </td>
                  <td>
                    <button className="btn-save" disabled={!x?.pdfUrl} onClick={() => { if (x?.pdfUrl) window.open(x.pdfUrl, '_blank') }}>Descargar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
