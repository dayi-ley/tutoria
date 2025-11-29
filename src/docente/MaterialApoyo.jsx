import { useEffect, useState, useMemo, memo } from 'react'
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { storage, db, supabase, storageProvider } from '../firebase'

export default function MaterialApoyoView({ docenteUid, docenteEmail, docenteNombre }) {
  const [items, setItems] = useState([])
  const [newOpen, setNewOpen] = useState(false)
  const [newTema, setNewTema] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newFiles, setNewFiles] = useState([])
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [toastOk, setToastOk] = useState('')
  const [toastErr, setToastErr] = useState('')
  const [docCiclo, setDocCiclo] = useState('')
  const [newLink, setNewLink] = useState('')
  const [newLinks, setNewLinks] = useState([])
  const [saving, setSaving] = useState(false)
  const [pdfPreview, setPdfPreview] = useState({})

  useEffect(() => {
    if (!db) return
    const key = docenteEmail || docenteUid
    if (!key) return
    const q = query(collection(db, 'salones'), where('docenteTutor_id', '==', key))
    const unsub = onSnapshot(q, (snap) => {
      const first = snap.docs[0]?.data() || null
      setDocCiclo(String(first?.ciclo || ''))
    })
    return () => { try { unsub() } catch { /* noop */ } }
  }, [docenteUid, docenteEmail])

  useEffect(() => {
    if (!db) return
    const idVals = []
    if (docenteUid) idVals.push(docenteUid)
    if (docenteEmail) idVals.push(docenteEmail)
    const listeners = []
    const map = new Map()
    const apply = () => {
      const next = Array.from(map.values()).sort((a,b) => (b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0))
      setItems((prev) => {
        if (prev.length === next.length && prev.every((p, i) => p.id === next[i]?.id)) return prev
        return next
      })
    }
    if (docenteUid) {
      const qUid = query(collection(db, 'material_apoyo'), where('docenteUid', '==', docenteUid))
      listeners.push(onSnapshot(qUid, (snap) => { snap.forEach((d) => map.set(`mat_${d.id}`, { id: d.id, ...(d.data() || {}) })); apply() }))
      const sub = collection(doc(db, 'usuarios', docenteUid), 'material_apoyo')
      listeners.push(onSnapshot(sub, (snap) => { snap.forEach((d) => map.set(`sub_${d.id}`, { id: d.id, ...(d.data() || {}) })); apply() }))
    } else if (docenteEmail) {
      const qEmail = query(collection(db, 'material_apoyo'), where('docenteEmail', '==', docenteEmail))
      listeners.push(onSnapshot(qEmail, (snap) => { snap.forEach((d) => map.set(`mat_${d.id}`, { id: d.id, ...(d.data() || {}) })); apply() }))
    }
    return () => listeners.forEach((u) => { try { u() } catch { /* noop */ } })
  }, [docenteUid, docenteEmail])

  

  const openNew = () => {
    setNewTema('')
    setNewDesc('')
    setNewFiles([])
    setNewDate(new Date().toISOString().slice(0, 10))
    setNewLink('')
    setNewLinks([])
    setNewOpen(true)
  }

  const loadPdfJs = async () => {
    if (window.pdfjsLib) return window.pdfjsLib
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
    const lib = window.pdfjsLib
    if (lib && lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    return lib
  }

  const makePdfThumb = async (u) => {
    try {
      if (!u || pdfPreview[u]) return
      const lib = await loadPdfJs()
      if (!lib) return
      const task = lib.getDocument(u)
      const pdf = await task.promise
      let p = 1
      if (pdf.numPages >= 15) {
        p = Math.random() < 0.5 ? 10 : 15
      } else if (pdf.numPages >= 10) {
        p = 10
      } else {
        p = 1
      }
      if (p < 1) p = 1
      const page = await pdf.getPage(p)
      const vp1 = page.getViewport({ scale: 1 })
      const scale = Math.max(120 / vp1.height, 120 / vp1.width)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      const data = canvas.toDataURL('image/jpeg')
      setPdfPreview((prev) => (prev[u] ? prev : { ...prev, [u]: data }))
    } catch {
      void 0
    }
  }

  const onChooseFiles = (e) => {
    const arr = Array.from(e.target.files || [])
    setNewFiles(arr)
  }

  const addLink = () => {
    const v = String(newLink || '').trim()
    if (!v) return
    setNewLinks((prev) => [v, ...prev])
    setNewLink('')
  }

  const uploadFile = async (path, file) => {
    if (storageProvider === 'supabase' && supabase) {
      const supaPath = path.replace(/^material_apoyo\//, '')
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
      const supaPath = path.replace(/^material_apoyo\//, '')
      const contentType = String(file?.type || '') || undefined
      const { error } = await supabase.storage.from('cumplimientos').upload(supaPath, file, { upsert: true, contentType })
      if (error) throw error
      const { data } = supabase.storage.from('cumplimientos').getPublicUrl(supaPath)
      return data.publicUrl
    }
    throw new Error('No hay storage configurado')
  }

  const saveNew = async () => {
    const tt = String(newTema || '').trim()
    if (!tt) { setToastErr('Completa el tema'); setTimeout(() => setToastErr(''), 2000); return }
    const id = `${docenteUid || 'docente'}-${Date.now()}`
    setSaving(true)
    const uploads = []
    for (const f of newFiles) {
      const name = f?.name || 'archivo'
      const path = `material_apoyo/${docenteUid || docenteEmail || 'docente'}/${id}/${name}`
      try {
        const url = await uploadFile(path, f)
        uploads.push({ name, type: f?.type || '', size: f?.size || 0, url, kind: 'file' })
      } catch {
        uploads.push({ name, type: f?.type || '', size: f?.size || 0, url: '', kind: 'file' })
      }
    }
    const linkAtt = newLinks.map((href) => ({ href, name: href, kind: 'link' }))
    const it = { id, tema: tt, descripcion: newDesc, fecha: newDate, files: [...uploads, ...linkAtt], docenteUid, docenteEmail, docenteNombre, createdAt: serverTimestamp() }
    try {
      await setDoc(doc(db, 'material_apoyo', id), it, { merge: true })
      setItems((prev) => [it, ...prev])
      setNewOpen(false)
      setToastOk('Material creado')
      setTimeout(() => setToastOk(''), 2000)
    } catch (err) {
      const code = String(err?.code || '')
      try {
        if (docenteUid) {
          await setDoc(doc(db, 'usuarios', docenteUid, 'material_apoyo', id), it, { merge: true })
          setItems((prev) => [it, ...prev])
          setNewOpen(false)
          setToastOk('Material creado')
          setTimeout(() => setToastOk(''), 2000)
        } else {
          throw err
        }
      } catch (err2) {
        setToastErr(code || String(err2))
        setTimeout(() => setToastErr(''), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  const openAttachment = (f) => {
    const u = String(f?.url || f?.href || '')
    if (!u) return
    try { window.open(u, '_blank', 'noopener,noreferrer') } catch { void 0 }
  }


  const downloadAll = (x) => {
    const arr = Array.isArray(x?.files) ? x.files : []
    const pick = arr.find((f) => (String(f?.type || '').includes('pdf') || /\.pdf$/i.test(String(f?.name || '')) || /\.pdf$/i.test(String(f?.url || '')) || /\.pdf$/i.test(String(f?.href || ''))))
      || arr.find((f) => f?.url)
      || arr.find((f) => f?.href)
    if (!pick) return
    const u = String(pick?.url || pick?.href || '')
    if (!u) return
    const a = document.createElement('a')
    a.href = u
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.download = String(pick?.name || 'archivo')
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const PreviewBanner = memo(function PreviewBanner({ files }) {
    const pick = useMemo(() => {
      const arr = Array.isArray(files) ? files : []
      return (
        arr.find((f) => (String(f?.type || '').includes('pdf') || /\.pdf$/i.test(String(f?.name || '')) || /\.pdf$/i.test(String(f?.url || '')) || /\.pdf$/i.test(String(f?.href || ''))))
        || arr.find((f) => (String(f?.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(String(f?.name || '')) || /\.(png|jpe?g|gif|webp)$/i.test(String(f?.url || '')) || /\.(png|jpe?g|gif|webp)$/i.test(String(f?.href || ''))))
        || arr.find((f) => (f?.href))
        || arr[0]
      )
    }, [files])
    const u = String(pick?.url || pick?.href || '')
    const isPdf = Boolean(((String(pick?.type || '').includes('pdf')) || /\.pdf$/i.test(String(pick?.name || '')) || /\.pdf$/i.test(String(pick?.url || '')) || /\.pdf$/i.test(String(pick?.href || ''))) && u)
    useEffect(() => {
      if (isPdf && u && !pdfPreview[u]) { makePdfThumb(u) }
    }, [isPdf, u])
    if (!pick) return null
    return (
      <div onClick={(e) => { e.stopPropagation(); openAttachment(pick) }} style={{ width: '100%', height: '120px', overflow: 'hidden', cursor: (pick?.url || pick?.href) ? 'pointer' : 'default', background: '#fff', transform: 'translateZ(0)' }}>
        {(String(pick?.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(String(pick?.name || '')) || /\.(png|jpe?g|gif|webp)$/i.test(String(pick?.url || '')) || /\.(png|jpe?g|gif|webp)$/i.test(String(pick?.href || ''))) && (pick.url || pick.href) ? (
          <img src={String(pick.url || pick.href)} alt={pick.name || 'img'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', backfaceVisibility: 'hidden' }} />
        ) : isPdf && pdfPreview[u] ? (
          <img src={pdfPreview[u]} alt={pick.name || 'pdf'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', backfaceVisibility: 'hidden' }} />
        ) : isPdf ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><span style={{ fontSize: '1.2rem' }}>📄</span></div>
        ) : pick.href ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><span style={{ fontSize: '1.2rem' }}>🔗</span></div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><span style={{ fontSize: '1.2rem' }}>📁</span></div>
        )}
      </div>
    )
  })

  return (
    <div>
      <div className="content-header-row small">
        <div className="header-actions left">
          <div className="content-header" style={{ margin: 0 }}>Ciclo: {docCiclo || '—'}</div>
        </div>
        <div className="stats-list right">
          <div className="stat-item">
            <span className="stat-label">Archivos</span>
            <span>{items.reduce((a, b) => a + (Array.isArray(b.files) ? b.files.length : 0), 0)}</span>
          </div>
        </div>
      </div>
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
        {items.map((x) => (
          <div key={x.id} className="content-card" onClick={() => downloadAll(x)} style={{ display: 'grid', gap: '0.4rem', minHeight: '180px', position: 'relative', cursor: 'pointer' }}>
            <PreviewBanner files={x.files} />
            <div className="content-header" style={{ margin: 0 }}>{x.tema || x.titulo || ''}</div>
            {x.descripcion ? (<div style={{ fontSize: '0.86rem', color: '#444' }}>{x.descripcion}</div>) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#555' }}>Adjuntos: {Array.isArray(x.files) ? x.files.length : 0}</div>
              <div style={{ fontSize: '0.74rem', color: '#666' }}>{x.fecha || ''}</div>
            </div>
          </div>
        ))}
        <div className="content-card" onClick={openNew} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px', background: '#1f8f4b', color: '#fff', fontSize: '1.6rem', fontWeight: 700 }}>+
        </div>
      </div>

      {newOpen && (
        <div className="modal-backdrop" onClick={() => setNewOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="content-header" style={{ textAlign: 'left', fontSize: '1rem' }}>Nuevo material de apoyo</div>
            <div style={{ maxHeight: '68vh', overflowY: 'auto', display: 'grid', gap: '0.5rem' }}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.86rem' }}>Tema</label>
                <input type="text" value={newTema} onChange={(e) => setNewTema(e.target.value)} style={{ padding: '0.4rem 0.55rem', fontSize: '0.9rem' }} />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.86rem' }}>Descripción</label>
                <textarea rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ background: '#fff', color: '#222', padding: '0.4rem 0.55rem', fontSize: '0.9rem' }} />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.86rem' }}>Fecha</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ padding: '0.4rem 0.55rem', fontSize: '0.9rem' }} />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.86rem' }}>Subir archivos</label>
                <input type="file" multiple onChange={onChooseFiles} />
                <small style={{ fontSize: '0.8rem' }}>{newFiles.length ? `${newFiles.length} seleccionados` : 'Selecciona archivos'}</small>
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.86rem' }}>Agregar enlace</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input type="url" placeholder="https://..." value={newLink} onChange={(e) => setNewLink(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.55rem', fontSize: '0.9rem' }} />
                  <button type="button" className="btn-save" onClick={addLink} style={{ padding: '0.4rem 0.7rem', fontSize: '0.86rem' }}>Agregar link</button>
                </div>
                <small style={{ fontSize: '0.8rem' }}>{newLinks.length ? `${newLinks.length} enlaces agregados` : 'Sin enlaces'}</small>
              </div>
            </div>
            <div className="modal-actions" style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', background: '#fff' }}>
              <button onClick={() => setNewOpen(false)} style={{ padding: '0.45rem 0.8rem', fontSize: '0.86rem' }}>Cancelar</button>
              <button className="btn-confirm" onClick={saveNew} disabled={saving} style={{ padding: '0.45rem 0.8rem', fontSize: '0.86rem' }}>Guardar</button>
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
