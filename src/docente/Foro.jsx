import { useEffect, useState, useRef } from 'react'
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { storage, db, supabase, storageProvider } from '../firebase'

export default function ForoView({ docenteUid, docenteEmail, docenteNombre }) {
  const [threads, setThreads] = useState([])
  const [newBody, setNewBody] = useState('')
  const [toastOk, setToastOk] = useState('')
  const [toastErr, setToastErr] = useState('')
  const [openThread, setOpenThread] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [newMedia, setNewMedia] = useState([])
  const imgInputRef = useRef(null)
  const gifInputRef = useRef(null)
  const vidInputRef = useRef(null)
  const [localPreviews, setLocalPreviews] = useState([])
  const [imgToast, setImgToast] = useState('')

  const saveThreadSupabase = async (it) => {
    if (!supabase) return
    try {
      await supabase.from('foro_threads').upsert({
        id: it.id,
        titulo: String(it.titulo || ''),
        contenido: String(it.contenido || ''),
        docente_uid: it.docenteUid || null,
        docente_email: it.docenteEmail || null,
        docente_nombre: it.docenteNombre || null,
        created_at: new Date().toISOString(),
        media: Array.isArray(it.media) ? it.media : []
      }, { onConflict: 'id' })
    } catch { void 0 }
  }

  const saveCommentSupabase = async (threadId, it) => {
    if (!supabase) return
    try {
      await supabase.from('foro_comments').upsert({
        id: it.id,
        thread_id: threadId,
        texto: String(it.texto || ''),
        autor_uid: it.autorUid || null,
        autor_email: it.autorEmail || null,
        autor_nombre: it.autorNombre || null,
        created_at: new Date().toISOString()
      }, { onConflict: 'id' })
    } catch { void 0 }
  }

  useEffect(() => {
    if (!db) return
    const collect = new Map()
    const apply = () => {
      const arr = Array.from(collect.values())
      arr.sort((a, b) => ((b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0)))
      setThreads(arr)
    }
    const unsubRoot = onSnapshot(query(collection(db, 'foro_threads')), (snap) => {
      snap.forEach((d) => collect.set(d.id, { id: d.id, ...(d.data() || {}) }))
      apply()
    })
    let unsubUser = null
    if (docenteUid) {
      const colUser = collection(db, 'usuarios', docenteUid, 'foro_threads')
      unsubUser = onSnapshot(colUser, (snap) => {
        snap.forEach((d) => collect.set(d.id, { id: d.id, ...(d.data() || {}) }))
        apply()
      })
    }
    return () => {
      try { unsubRoot() } catch { void 0 }
      try { unsubUser && unsubUser() } catch { void 0 }
    }
  }, [docenteUid])

  
  
  const saveNew = async () => {
    const body = String(newBody || '').trim()
    if (!body) { setToastErr('Escribe el anuncio'); setTimeout(() => setToastErr(''), 2000); return }
    const tt = body.split(/\s+/).slice(0, 4).join(' ')
    const id = `${docenteUid || 'docente'}-${Date.now()}`
    const uploads = []
    for (const f of newMedia) {
      const name = f?.name || 'imagen'
      const path = `foro/${docenteUid || docenteEmail || 'docente'}/${id}/${name}`
      try {
        const url = await uploadMedia(path, f)
        uploads.push({ name, type: f?.type || '', size: f?.size || 0, url })
      } catch {
        uploads.push({ name, type: f?.type || '', size: f?.size || 0, url: '' })
      }
    }
    const it = { id, titulo: tt, contenido: body, media: uploads, docenteUid, docenteEmail, docenteNombre, createdAt: serverTimestamp() }
    try {
      await setDoc(doc(db, 'foro_threads', id), it, { merge: true })
      await saveThreadSupabase(it)
      setToastOk('Tema creado')
      setTimeout(() => setToastOk(''), 2000)
    } catch (err) {
      try {
        if (!docenteUid) throw err
        await setDoc(doc(db, 'usuarios', docenteUid, 'foro_threads', id), it, { merge: true })
        await saveThreadSupabase(it)
        setToastOk('Tema creado')
        setTimeout(() => setToastOk(''), 2000)
      } catch (err2) {
        setToastErr(err?.message || String(err2))
        setTimeout(() => setToastErr(''), 2000)
      }
    }
    setNewBody('')
    setNewMedia([])
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
      await saveCommentSupabase(openThread.id, it)
    } catch (err) {
      try {
        if (!docenteUid) throw err
        await setDoc(doc(db, 'usuarios', docenteUid, 'foro_threads', openThread.id, 'comments', cid), it, { merge: true })
        setCommentText('')
        await saveCommentSupabase(openThread.id, it)
      } catch { void 0 }
    }
  }

  const preview = (t) => {
    const s = String(t?.contenido || '')
    if (s.length <= 160) return s
    return s.slice(0, 160) + '…'
  }

  const onChooseMedia = (e) => {
    const arr = Array.from(e.target.files || [])
    setNewMedia((prev) => [...prev, ...arr])
  }

  const removePreview = (idx) => {
    setNewMedia((prev) => prev.filter((_, i) => i !== idx))
  }

  useEffect(() => {
    const urls = newMedia.map((f) => ({ url: URL.createObjectURL(f), type: String(f?.type || ''), name: f?.name || '' }))
    setLocalPreviews(urls)
    return () => { urls.forEach((u) => { try { URL.revokeObjectURL(u.url) } catch { void 0 } }) }
  }, [newMedia])

  const uploadMedia = async (path, file) => {
    if (storageProvider === 'supabase' && supabase) {
      const supaPath = path.replace(/^foro\//, '')
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
      const supaPath = path.replace(/^foro\//, '')
      const contentType = String(file?.type || '') || undefined
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true, contentType })
      if (error) throw error
      const { data } = supabase.storage.from('cumplimientos').getPublicUrl(supaPath)
      return data.publicUrl
    }
    throw new Error('No hay storage configurado')
  }

  return (
    <div>
      <div className="content-header-row small">
        <div className="header-actions left" />
      </div>

      <div className="content-card" style={{ display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '1.25rem' }}>👤</div>
          <div style={{ fontWeight: 600 }}>{docenteNombre || docenteEmail || 'Docente'}</div>
        </div>
        <div style={{ position: 'relative' }}>
          <textarea rows={3} placeholder="¿Qué deseas anunciar?" value={newBody} onChange={(e) => setNewBody(e.target.value)} style={{ background: '#fff', color: '#222', padding: '0.5rem 0.6rem', fontSize: '0.96rem', width: '100%', boxSizing: 'border-box' }} />
          <div style={{ position: 'absolute', right: '6px', top: '6px', display: 'flex', gap: '6px', zIndex: 2 }}>
            <button title="Imagen" onClick={() => { try { imgInputRef.current && imgInputRef.current.click() } catch { void 0 } }} style={{ padding: '0.22rem 0.5rem', background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>🖼️</button>
            <button title="GIF" onClick={() => { try { gifInputRef.current && gifInputRef.current.click() } catch { void 0 } }} style={{ padding: '0.22rem 0.5rem', background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', fontWeight: 700 }}>GIF</button>
            <button title="Video" onClick={() => { try { vidInputRef.current && vidInputRef.current.click() } catch { void 0 } }} style={{ padding: '0.22rem 0.5rem', background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>🎥</button>
          </div>
          <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={onChooseMedia} style={{ display: 'none' }} />
          <input ref={gifInputRef} type="file" accept="image/gif" multiple onChange={onChooseMedia} style={{ display: 'none' }} />
          <input ref={vidInputRef} type="file" accept="video/*" multiple onChange={onChooseMedia} style={{ display: 'none' }} />
        </div>
        {localPreviews.length ? (
          <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {localPreviews.map((m, i) => (
              <div key={i} style={{ position: 'relative', width: '100%', height: '160px' }}>
                {(String(m?.type || '').startsWith('video/'))
                  ? (<video src={m.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />)
                  : (<img src={m.url} alt={m.name || 'img'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', backfaceVisibility: 'hidden' }} />)}
                <button title="Quitar" onClick={() => removePreview(i)} style={{ position: 'absolute', right: '6px', top: '6px', padding: '0.15rem 0.45rem', background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>✖</button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className="btn-confirm" onClick={saveNew}>Publicar</button>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', marginTop: '0.6rem' }}>
        {threads.map((x) => (
          <div key={x.id} className="content-card" style={{ display: 'grid', gap: '0.5rem', paddingBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem' }}>👤</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{x.docenteNombre || x.docenteEmail || ''}</div>
                  <div style={{ fontSize: '0.74rem', color: '#666' }}>{x.createdAt ? (x.createdAt.toDate ? x.createdAt.toDate().toLocaleString() : '') : ''}</div>
                </div>
              </div>
              <button className="menu-item" onClick={() => setOpenThread(x)}>Ver publicación</button>
            </div>
            <div style={{ fontSize: '0.95rem', color: '#222', whiteSpace: 'pre-wrap', textAlign: 'left' }}>{preview(x)}</div>
            {(Array.isArray(x.media) && x.media.length) ? (
              <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {x.media.filter((m) => m?.url).map((m, i) => (
                  (String(m?.type || '').startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(String(m?.url || m?.name || '')))
                    ? (<video key={i} src={m.url} controls style={{ width: '100%', height: '160px', objectFit: 'cover', background: '#000' }} />)
                    : (<img key={i} src={m.url} alt={m.name || 'img'} loading="lazy" onClick={() => setImgToast(m.url)} style={{ width: '100%', height: '160px', objectFit: 'cover', backfaceVisibility: 'hidden', cursor: 'zoom-in' }} />)
                ))}
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-save" onClick={() => setOpenThread(x)}>Ver comentarios</button>
            </div>
          </div>
        ))}
      </div>

      {openThread && (
        <div className="modal-backdrop" onClick={() => { setOpenThread(null); setComments([]) }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(820px, 92vw)', margin: '2vh auto', boxSizing: 'border-box' }}>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', color: '#222', textAlign: 'left' }}>{openThread.contenido || ''}</div>
            {(Array.isArray(openThread.media) && openThread.media.length) ? (
              <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', marginTop: '0.4rem' }}>
                {openThread.media.filter((m) => m?.url).map((m, i) => (
                  (String(m?.type || '').startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(String(m?.url || m?.name || '')))
                    ? (<video key={i} src={m.url} controls style={{ width: '100%', height: '180px', objectFit: 'cover', background: '#000' }} />)
                    : (<img key={i} src={m.url} alt={m.name || 'img'} loading="lazy" onClick={() => setImgToast(m.url)} style={{ width: '100%', height: '180px', objectFit: 'cover', backfaceVisibility: 'hidden', cursor: 'zoom-in' }} />)
                ))}
              </div>
            ) : null}
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
      {imgToast && (
        <div className="modal-backdrop" onClick={() => setImgToast('')}>
          <div className="tooltip-card" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
            <img src={imgToast} alt="preview" style={{ width: 'auto', height: 'auto', maxWidth: '92vw', maxHeight: '85vh', display: 'block', borderRadius: '12px' }} />
          </div>
        </div>
      )}
    </div>
  )
}
