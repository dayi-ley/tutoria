import { useEffect, useState } from 'react'
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export default function ForoView({ docenteUid, docenteEmail, docenteNombre }) {
  const [threads, setThreads] = useState([])
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [toastOk, setToastOk] = useState('')
  const [toastErr, setToastErr] = useState('')
  const [openThread, setOpenThread] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    if (!db) return
    const unsubRoot = onSnapshot(query(collection(db, 'foro_threads')), (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
      setThreads((prev) => {
        const others = Array.isArray(prev) ? prev.filter((x) => x.__scope !== 'user') : []
        return [...others, ...list.map((x) => ({ ...x, __scope: 'root' }))].sort((a, b) => ((b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0)))
      })
    })
    let unsubUser = null
    if (docenteUid) {
      const colUser = collection(db, 'usuarios', docenteUid, 'foro_threads')
      unsubUser = onSnapshot(colUser, (snap) => {
        const list = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
        setThreads((prev) => {
          const others = Array.isArray(prev) ? prev.filter((x) => x.__scope !== 'root') : []
          return [...others, ...list.map((x) => ({ ...x, __scope: 'user' }))].sort((a, b) => ((b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0)))
        })
      })
    }
    return () => {
      try { unsubRoot() } catch { void 0 }
      try { unsubUser && unsubUser() } catch { void 0 }
    }
  }, [docenteUid])

  const openNew = () => {
    setNewTitle('')
    setNewBody('')
    setNewOpen(true)
  }

  const saveNew = async () => {
    const tt = String(newTitle || '').trim()
    const body = String(newBody || '').trim()
    if (!tt || !body) { setToastErr('Completa título y contenido'); setTimeout(() => setToastErr(''), 2000); return }
    const id = `${docenteUid || 'docente'}-${Date.now()}`
    const it = { id, titulo: tt, contenido: body, docenteUid, docenteEmail, docenteNombre, createdAt: serverTimestamp() }
    try {
      await setDoc(doc(db, 'foro_threads', id), it, { merge: true })
      setThreads((prev) => [it, ...prev])
      setNewOpen(false)
      setToastOk('Tema creado')
      setTimeout(() => setToastOk(''), 2000)
    } catch (err) {
      try {
        if (!docenteUid) throw err
        await setDoc(doc(db, 'usuarios', docenteUid, 'foro_threads', id), it, { merge: true })
        setThreads((prev) => [it, ...prev])
        setNewOpen(false)
        setToastOk('Tema creado')
        setTimeout(() => setToastOk(''), 2000)
      } catch (err2) {
        setToastErr(err?.message || String(err2))
        setTimeout(() => setToastErr(''), 2000)
      }
    }
  }

  useEffect(() => {
    if (!db || !openThread?.id) return
    const col = collection(db, 'foro_threads', openThread.id, 'comments')
    const unsub = onSnapshot(col, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
      list.sort((a, b) => ((a?.createdAt?.toMillis?.() || 0) - (b?.createdAt?.toMillis?.() || 0)))
      setComments(list)
    })
    return () => { try { unsub() } catch { void 0 } }
  }, [openThread?.id])

  const addComment = async () => {
    const txt = String(commentText || '').trim()
    if (!txt || !openThread?.id) return
    const cid = `${docenteUid || 'docente'}-${Date.now()}`
    const it = { id: cid, texto: txt, autorUid: docenteUid || '', autorEmail: docenteEmail || '', autorNombre: docenteNombre || '', createdAt: serverTimestamp() }
    try {
      await setDoc(doc(db, 'foro_threads', openThread.id, 'comments', cid), it, { merge: true })
      setCommentText('')
    } catch (err) {
      try {
        if (!docenteUid) throw err
        await setDoc(doc(db, 'usuarios', docenteUid, 'foro_threads', openThread.id, 'comments', cid), it, { merge: true })
        setCommentText('')
      } catch { void 0 }
    }
  }

  const preview = (t) => {
    const s = String(t?.contenido || '')
    if (s.length <= 160) return s
    return s.slice(0, 160) + '…'
  }

  return (
    <div>
      <div className="content-header-row small">
        <div className="header-actions left">
          <button className="btn-new small" onClick={openNew}>+ Nuevo tema</button>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
        {threads.map((x) => (
          <div key={x.id} className="content-card" onClick={() => setOpenThread(x)} style={{ display: 'grid', gap: '0.4rem', minHeight: '140px', cursor: 'pointer' }}>
            <div className="content-header" style={{ margin: 0 }}>{x.titulo || ''}</div>
            <div style={{ fontSize: '0.9rem', color: '#333' }}>{preview(x)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#555' }}>{x.docenteNombre || x.docenteEmail || ''}</div>
              <div style={{ fontSize: '0.74rem', color: '#666' }}>{x.createdAt ? (x.createdAt.toDate ? x.createdAt.toDate().toLocaleString() : '') : ''}</div>
            </div>
          </div>
        ))}
      </div>

      {newOpen && (
        <div className="modal-backdrop" onClick={() => setNewOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="content-header" style={{ textAlign: 'left', fontSize: '1rem' }}>Nuevo tema</div>
            <div style={{ maxHeight: '68vh', overflowY: 'auto', display: 'grid', gap: '0.5rem' }}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.86rem' }}>Título</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ padding: '0.4rem 0.55rem', fontSize: '0.9rem' }} />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.86rem' }}>Contenido</label>
                <textarea rows={6} value={newBody} onChange={(e) => setNewBody(e.target.value)} style={{ background: '#fff', color: '#222', padding: '0.4rem 0.55rem', fontSize: '0.9rem' }} />
              </div>
            </div>
            <div className="modal-actions" style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', background: '#fff' }}>
              <button onClick={() => setNewOpen(false)} style={{ padding: '0.45rem 0.8rem', fontSize: '0.86rem' }}>Cancelar</button>
              <button className="btn-confirm" onClick={saveNew} style={{ padding: '0.45rem 0.8rem', fontSize: '0.86rem' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {openThread && (
        <div className="modal-backdrop" onClick={() => { setOpenThread(null); setComments([]) }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(820px, 92vw)', margin: '2vh auto', boxSizing: 'border-box' }}>
            <div className="content-header" style={{ textAlign: 'left', fontSize: '1rem' }}>{openThread.titulo || ''}</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', color: '#222' }}>{openThread.contenido || ''}</div>
            <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.4rem' }}>
              <div className="content-header" style={{ fontSize: '0.96rem', margin: 0 }}>Comentarios</div>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                {comments.map((c) => (
                  <div key={c.id} className="content-card" style={{ padding: '0.5rem', display: 'grid', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.84rem', color: '#555' }}>{c.autorNombre || c.autorEmail || ''}</div>
                      <div style={{ fontSize: '0.74rem', color: '#666' }}>{c.createdAt ? (c.createdAt.toDate ? c.createdAt.toDate().toLocaleString() : '') : ''}</div>
                    </div>
                    <div style={{ fontSize: '0.94rem', color: '#222', whiteSpace: 'pre-wrap' }}>{c.texto || ''}</div>
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ textAlign: 'left', marginTop: '0.4rem' }}>
                <label style={{ fontSize: '0.86rem' }}>Añadir comentario</label>
                <textarea rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} style={{ background: '#fff', color: '#222', padding: '0.4rem 0.55rem', fontSize: '0.9rem' }} />
              </div>
              <div className="actions" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="btn-save" onClick={addComment}>Publicar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastOk && (
        <div className="tooltip-toast"><div className="tooltip-card success">{toastOk}</div></div>
      )}
      {toastErr && (
        <div className="tooltip-toast"><div className="tooltip-card">{toastErr}</div></div>
      )}
    </div>
  )
}
