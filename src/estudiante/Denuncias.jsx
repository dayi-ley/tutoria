import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export default function DenunciasView({ estudianteUid, estudianteEmail, estudianteNombre }) {
  const [items, setItems] = useState([])
  const [tema, setTema] = useState('')
  const [desc, setDesc] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [derivarA, setDerivarA] = useState('Oficina de defensoría universitaria')
  const [saving, setSaving] = useState(false)
  const [toastOk, setToastOk] = useState('')
  const [toastErr, setToastErr] = useState('')

  useEffect(() => {
    if (!db || !estudianteUid) return
    const q = query(collection(db, 'denuncias'), where('estudianteUid', '==', estudianteUid))
    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
      setItems(list.sort((a, b) => (b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0)))
    })
    return () => { try { unsub() } catch (e) { void e } }
  }, [estudianteUid])

  const submit = async (e) => {
    e.preventDefault()
    const tt = String(tema || '').trim()
    const dd = String(desc || '').trim()
    if (!tt) { setToastErr('Completa el asunto'); setTimeout(() => setToastErr(''), 1800); return }
    if (!dd) { setToastErr('Describe el hecho'); setTimeout(() => setToastErr(''), 1800); return }
    const id = `${estudianteUid || 'est'}-${Date.now()}`
    setSaving(true)
    const it = {
      id,
      asunto: tt,
      descripcion: dd,
      fecha,
      derivarA,
      estado: 'pendiente',
      estudianteUid,
      estudianteEmail,
      estudianteNombre,
      createdAt: serverTimestamp(),
    }
    try {
      await setDoc(doc(db, 'denuncias', id), it, { merge: true })
      setItems((prev) => [it, ...prev])
      setTema('')
      setDesc('')
      setFecha(new Date().toISOString().slice(0, 10))
      setDerivarA('Oficina de defensoría universitaria')
      setToastOk('Denuncia enviada')
      setTimeout(() => setToastOk(''), 1800)
    } catch (err) {
      setToastErr(err?.message || String(err))
      setTimeout(() => setToastErr(''), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="content-header" style={{ textAlign: 'left', margin: 0 }}>Nueva denuncia</div>
      <form onSubmit={submit} className="login-form" style={{ marginTop: '0.5rem' }}>
        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>Asunto</label>
          <input type="text" value={tema} onChange={(e) => setTema(e.target.value)} required />
        </div>
        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>Descripción del hecho</label>
          <textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ background: '#fff', color: '#222' }} required />
        </div>
        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>Fecha del hecho</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>Derivar a</label>
          <select value={derivarA} onChange={(e) => setDerivarA(e.target.value)}>
            <option>Oficina de defensoría universitaria</option>
            <option>Dirección de bienestar universitario</option>
          </select>
        </div>
        <div className="actions" style={{ marginTop: '0.5rem' }}>
          <button type="submit" disabled={saving}>Enviar denuncia</button>
        </div>
      </form>

      <div className="content-header" style={{ textAlign: 'left', marginTop: '0.8rem' }}>Mis denuncias</div>
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
        {items.map((x) => (
          <div key={x.id} className="content-card" style={{ display: 'grid', gap: '0.4rem', minHeight: '160px' }}>
            <div className="content-header" style={{ margin: 0 }}>{x.asunto || ''}</div>
            {x.descripcion ? (<div style={{ fontSize: '0.86rem', color: '#444' }}>{x.descripcion}</div>) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#555' }}>{x.derivarA || ''}</div>
              <div style={{ fontSize: '0.74rem', color: '#666' }}>{x.fecha || ''}</div>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#1f8f4b' }}>{x.estado || 'pendiente'}</div>
          </div>
        ))}
      </div>

      {toastOk && (
        <div className="tooltip-toast"><div className="tooltip-card success">{toastOk}</div></div>
      )}
      {toastErr && (
        <div className="tooltip-toast"><div className="tooltip-card">{toastErr}</div></div>
      )}
    </div>
  )
}
