import { useState, useRef } from 'react'
import ExcelIcon from '../assets/icons/excel_upload.jpg'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export default function GestionAsignacionView() {
  const [step, setStep] = useState(1)
  const [toast, setToast] = useState('')
  const [csvErr, setCsvErr] = useState('')

  const [docente, setDocente] = useState({ numero: '', dni: '', codigo: '', displayName: '', facultadDependencia: 'Ingenieria Electronica e Informatica', sexo: '', telefono: '', email: '', resolucionDesignacion: '', nombres: '', apellidos: '' })
  const [aula, setAula] = useState({ carrera: '', ciclo: '', seccion: '', turno: '', curso: '', dia: '' })
  const [rows, setRows] = useState([])
  const fileRef = useRef(null)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualRows, setManualRows] = useState([])
  const [showUploadToast, setShowUploadToast] = useState(false)
  const [uploadPanelMsg, setUploadPanelMsg] = useState('')

  const next = async () => {
    if (step === 1) {
      const email = String(docente.email || '').toLowerCase().trim()
      const display = String(docente.displayName || '').trim()
      const dni = String(docente.dni || '').replace(/\D/g, '').trim()
      
      const telefono = String(docente.telefono || '').replace(/\D/g, '').slice(0, 9)
      
      if (!email || !display || !telefono) { setToast('Completa los datos del tutor'); setTimeout(() => setToast(''), 1800); return }
      if (dni.length !== 8) { setToast('DNI debe tener 8 dígitos'); setTimeout(() => setToast(''), 1800); return }
      const parts = display.split(/\s+/).filter(Boolean)
      let nombres = display
      let apellidos = ''
      if (parts.length >= 3) {
        nombres = parts.slice(-2).join(' ')
        apellidos = parts.slice(0, -2).join(' ')
      } else if (parts.length === 2) {
        nombres = parts[1]
        apellidos = parts[0]
      }
      
      setDocente((prev) => ({ ...prev, nombres, apellidos }))
      setStep(2)
    } else if (step === 2) {
      const { carrera, ciclo, seccion, turno, curso, dia } = aula
      if (!carrera || !ciclo || !seccion || !turno) { setToast('Completa los datos del aula'); setTimeout(() => setToast(''), 1800); return }
      const id = `${ciclo}-${seccion}`
      const data = { id, carrera, ciclo, seccion, turno, curso, dia, docenteTutor_id: String(docente.email || '').toLowerCase(), docente_nombres: docente.nombres, docente_apellidos: docente.apellidos, createdAt: serverTimestamp() }
      try { await setDoc(doc(db, 'salones', id), data, { merge: true }) } catch (e) { setToast(String(e?.message || e)); setTimeout(() => setToast(''), 2000); return }
      setStep(3)
    }
  }

  
  const openManualModal = () => {
    const mapped = (rows.length ? rows.map((r) => ({
      fullName: `${String(r.apellidos || '').toUpperCase()} ${String(r.nombres || '').toUpperCase()}`.trim(),
      codigo: String(r.codigo || ''),
      nombres: String(r.nombres || ''),
      apellidos: String(r.apellidos || ''),
      email: String(r.codigo ? (r.codigo + '@unfv.edu.pe') : (r.email || '')).toLowerCase(),
      telefono: String(r.telefono || ''),
      notaPromedio: r.notaPromedio || '',
      faltasCantidad: r.faltasCantidad || ''
    })) : [{ fullName: '', codigo: '', nombres: '', apellidos: '', email: '', telefono: '', notaPromedio: '', faltasCantidad: '' }])
    setManualRows(mapped)
    setShowManualModal(true)
  }
  const addManualRowModal = () => { setManualRows((prev) => [...prev, { fullName: '', codigo: '', nombres: '', apellidos: '', email: '', telefono: '', notaPromedio: '', faltasCantidad: '' }]) }
  const setManualField = (idx, key, val) => { setManualRows((prev) => { const next = [...prev]; next[idx] = { ...next[idx], [key]: val }; return next }) }

  const parseFullNameFields = (full, ap, no) => {
    const src = String(full || '').trim()
    if (src) {
      const parts = src.split(/\s+/).filter(Boolean)
      let nombres = src
      let apellidos = ''
      if (parts.length >= 3) {
        nombres = parts.slice(-2).join(' ')
        apellidos = parts.slice(0, -2).join(' ')
      } else if (parts.length === 2) {
        nombres = parts[1]
        apellidos = parts[0]
      } else {
        apellidos = src
        nombres = ''
      }
      return { apellidos, nombres }
    }
    return { apellidos: String(ap || '').trim(), nombres: String(no || '').trim() }
  }

  const saveManualModal = () => {
    const mapped = manualRows.map((r) => {
      const nm = parseFullNameFields(r.fullName, r.apellidos, r.nombres)
      const code = String(r.codigo || '').trim()
      const email = String(r.email || (code ? (code + '@unfv.edu.pe') : '')).toLowerCase()
      const row = { ...r, ...nm, email }
      row._valid = validateRow(row)
      return row
    })
    setRows((prev) => [...mapped, ...prev])
    setShowManualModal(false)
  }
  const closeManualModal = () => { setShowManualModal(false) }

  const validateRow = (r) => {
    const okN = Boolean(String(r.nombres || '').trim())
    const okA = Boolean(String(r.apellidos || '').trim())
    const okE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r.email || '').trim())
    const tel = String(r.telefono || '').replace(/\D/g, '')
    const okT = tel.length === 9
    const nota = Number(r.notaPromedio)
    const falt = Number(r.faltasCantidad)
    const okNota = !Number.isNaN(nota) && nota >= 0 && nota <= 20
    const okFalt = !Number.isNaN(falt) && falt >= 0
    return okN && okA && okE && okT && okNota && okFalt
  }

  const parseCsv = async (file) => {
    setCsvErr('')
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const mapIdx = (name) => { const i = header.findIndex((h) => h === name); return i >= 0 ? i : -1 }
      const ix = { nombres: mapIdx('nombres'), apellidos: mapIdx('apellidos'), email: mapIdx('email'), telefono: mapIdx('telefono'), notaPromedio: mapIdx('notapromedio'), faltasCantidad: mapIdx('faltascantidad') }
      const out = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim())
        if (!cols.length) continue
        const row = { nombres: ix.nombres >= 0 ? cols[ix.nombres] : '', apellidos: ix.apellidos >= 0 ? cols[ix.apellidos] : '', email: ix.email >= 0 ? cols[ix.email].toLowerCase() : '', telefono: ix.telefono >= 0 ? cols[ix.telefono] : '', notaPromedio: ix.notaPromedio >= 0 ? cols[ix.notaPromedio] : '', faltasCantidad: ix.faltasCantidad >= 0 ? cols[ix.faltasCantidad] : '' }
        row._valid = validateRow(row)
        out.push(row)
      }
      setRows(out)
    } catch { setCsvErr('No se pudo leer el CSV'); setTimeout(() => setCsvErr(''), 1800) }
  }

  const loadXlsx = () => {
    return new Promise((resolve, reject) => {
      const g = window
      if (g && g.XLSX) { resolve(g.XLSX); return }
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.19.2/dist/xlsx.full.min.js'
      s.onload = () => { if (g && g.XLSX) resolve(g.XLSX); else reject(new Error('XLSX no disponible')) }
      s.onerror = () => reject(new Error('No se pudo cargar XLSX'))
      document.head.appendChild(s)
    })
  }

  const parseExcel = async (file) => {
    try {
      setUploadPanelMsg('Cargando librería XLSX...')
      const XLSX = await loadXlsx()
      setUploadPanelMsg('Leyendo archivo Excel...')
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab, { type: 'array' })
      setUploadPanelMsg(`Libro leído. Hojas: ${wb.SheetNames.length}`)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
      if (!data.length) return
      setUploadPanelMsg('Detectando fila de encabezado...')
      let headerIndex = 0
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (Array.isArray(row) && row.some((c) => String(c || '').trim().length > 0)) { headerIndex = i; break }
      }
      const header = data[headerIndex] || []
      const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').trim()
      const alias = {
        fullName: ['apellidosynombres', 'apenom', 'apellidoynombres'],
        apellidos: ['apellidos', 'apellido', 'surnames'],
        nombres: ['nombres', 'nombre', 'names'],
        codigo: ['codigo', 'código', 'cod', 'studentcode', 'id'],
        email: ['email', 'correo', 'mail'],
        telefono: ['telefono', 'teléfono', 'celular', 'phone'],
        notaPromedio: ['nota', 'promedio', 'notapromedio', 'score', 'average'],
        faltasCantidad: ['faltas', 'inasistencias', 'absences']
      }
      const ix = { fullName: -1, apellidos: -1, nombres: -1, codigo: -1, email: -1, telefono: -1, notaPromedio: -1, faltasCantidad: -1 }
      for (let i = 0; i < header.length; i++) {
        const h = norm(header[i])
        for (const key of Object.keys(alias)) {
          if (alias[key].includes(h)) { ix[key] = i; break }
        }
      }
      const mappedCount = Object.values(ix).filter((v) => v >= 0).length
      setUploadPanelMsg(`Columnas mapeadas: ${mappedCount}`)
      const out = []
      for (let r = headerIndex + 1; r < data.length; r++) {
        const row = data[r]
        if (!Array.isArray(row)) continue
        const pick = (k) => { const i = ix[k]; return i >= 0 ? String((row[i] ?? '')).trim() : '' }
        const full = pick('fullName')
        const apRaw = pick('apellidos')
        const noRaw = pick('nombres')
        const nm = parseFullNameFields(full, apRaw, noRaw)
        const codigo = pick('codigo')
        let email = pick('email') || (codigo ? (codigo + '@unfv.edu.pe') : '')
        email = String(email).toLowerCase()
        const telefono = pick('telefono').replace(/\D/g, '').slice(0, 9)
        const notaPromedio = pick('notaPromedio')
        const faltasCantidad = pick('faltasCantidad')
        const rec = { ...nm, codigo, email, telefono, notaPromedio, faltasCantidad }
        rec._valid = validateRow(rec)
        out.push(rec)
      }
      setUploadPanelMsg(`Filas procesadas: ${Math.max(0, data.length - (headerIndex + 1))} | válidas: ${out.filter((x) => x._valid).length}`)
      if (out.length) setRows(out)
    } catch (error) {
      setUploadPanelMsg(`Error: ${String(error?.message || error)}`)
      setToast('No se pudo procesar el Excel'); setTimeout(() => setToast(''), 2000)
    }
  }

  const handleUploadClick = () => { setShowUploadToast(true) }
  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const name = String(f.name || '').toLowerCase()
    const isCsv = name.endsWith('.csv')
    const isXls = name.endsWith('.xls') || name.endsWith('.xlsx')
    if (isCsv) { parseCsv(f); setShowUploadToast(false); return }
    if (isXls) { setUploadPanelMsg('Procesando Excel...'); parseExcel(f).finally(() => { setShowUploadToast(false); setUploadPanelMsg('') }); return }
    setToast('Formato no válido. Usa CSV o Excel'); setTimeout(() => setToast(''), 2000)
    setShowUploadToast(false)
  }

  

  

  return (
    <div className="content-card" style={{ display: 'grid', gap: '0.8rem' }}>
      <div className="content-header-row">
        <div className="header-actions left" style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {step > 1 && (
            <button type="button" className="menu-item" onClick={() => setStep(step - 1)} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', color: '#000', WebkitTextFillColor: '#000', backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.2)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>←</button>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
            {['Tutor', 'Aula', 'Alumnos'].map((label, idx) => {
              const isActive = step === (idx + 1)
              return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: isActive ? '#1f8f4b' : '#eee', border: '2px solid #1f8f4b' }} />
                  <div style={{ fontSize: '0.8rem', color: isActive ? '#1f8f4b' : '#333' }}>{label}</div>
                </div>
              )
            })}
          </div>
          {step === 3 && (
            <div className="header-actions right" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
              <button type="button" className="menu-item" style={{ color: '#fff', backgroundColor: '#0b5ed7', border: '1px solid #0b5ed7' }}>Guardar</button>
            </div>
          )}
        </div>
      </div>

      {step === 1 && (
        <form className="login-form" onSubmit={(e) => { e.preventDefault(); next() }}>
          <h3 style={{ marginTop: '0.2rem' }}>Registro de tutor</h3>
          <div className="content-header-row small">
            <div className="header-actions left">
              <label style={{ marginRight: '0.4rem', fontWeight: 700 }}>Facultad</label>
              <select className="menu-item" value={docente.facultadDependencia} onChange={(e) => setDocente({ ...docente, facultadDependencia: e.target.value })} style={{ color: '#000', WebkitTextFillColor: '#000', backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.2)', opacity: 1 }}>
                <option>Ingenieria Electronica e Informatica</option>
              </select>
            </div>
          </div>
          <div className="table-responsive">
            <table className="registro-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }} cellPadding={0}>
              <thead style={{ fontSize: '0.72rem' }}>
                <tr>
                  <th style={{ padding: '0.2rem 0.05rem' }}>N°</th>
                  <th style={{ width: 100, textAlign: 'center', whiteSpace: 'nowrap', padding: '0.2rem 0.05rem' }}>DNI</th>
                  <th style={{ width: 100, padding: '0.2rem 0.05rem' }}>CÓDIGO</th>
                  <th style={{ width: 300, padding: '0.2rem 0.05rem' }}>APELLIDOS Y NOMBRES</th>
                  <th style={{ padding: '0.2rem 0.05rem' }}>SEXO</th>
                  <th style={{ width: 100, padding: '0.2rem 0.05rem' }}>TELÉFONO</th>
                  <th style={{ padding: '0.2rem 0.05rem' }}>CORREO INSTITUCIONAL</th>
                  <th style={{ width: 120, padding: '0.2rem 0.05rem' }}>RESOLUCIÓN DE DESIGNACIÓN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ width: 36, textAlign: 'center', padding: '0.2rem 0.05rem' }}>{1}</td>
                  <td style={{ width: 100, textAlign: 'center', padding: '0.2rem 0.05rem' }}><input style={{ width: '100%', fontSize: '0.82rem' }} value={docente.dni} inputMode="numeric" maxLength={8} onChange={(e) => setDocente({ ...docente, dni: e.target.value.replace(/\\D/g, '').slice(0, 8) })} /></td>
                  <td style={{ width: 100, padding: '0.2rem 0.05rem' }}><input style={{ width: '100%', fontSize: '0.82rem' }} value={docente.codigo} onChange={(e) => setDocente({ ...docente, codigo: e.target.value })} /></td>
                  <td style={{ width: 300, padding: '0.2rem 0.05rem' }}><input style={{ width: '100%', fontSize: '0.82rem' }} value={docente.displayName} onChange={(e) => setDocente({ ...docente, displayName: e.target.value.toUpperCase() })} /></td>
                  <td style={{ padding: '0.2rem 0.05rem' }}>
                    <select style={{ fontSize: '0.82rem' }} value={docente.sexo} onChange={(e) => setDocente({ ...docente, sexo: e.target.value })}>
                      <option value="" disabled>Selecciona</option>
                      <option value="MASCULINO">MASCULINO</option>
                      <option value="FEMENINO">FEMENINO</option>
                    </select>
                  </td>
                  <td style={{ width: 100, padding: '0.2rem 0.05rem' }}><input style={{ width: '100%', fontSize: '0.82rem' }} value={docente.telefono} onChange={(e) => setDocente({ ...docente, telefono: e.target.value.replace(/\\D/g, '').slice(0, 9) })} /></td>
                  <td style={{ padding: '0.2rem 0.05rem' }}><input style={{ fontSize: '0.82rem' }} type="email" value={docente.email} onChange={(e) => setDocente({ ...docente, email: e.target.value.toLowerCase() })} /></td>
                  <td style={{ width: 120, padding: '0.2rem 0.05rem' }}><input style={{ width: '100%', fontSize: '0.82rem' }} value={docente.resolucionDesignacion} onChange={(e) => setDocente({ ...docente, resolucionDesignacion: e.target.value })} /></td>
                </tr>
              </tbody>
              </table>
          </div>
          <div className="actions" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem' }}>
            <button type="submit">Continuar</button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form className="login-form" onSubmit={(e) => { e.preventDefault(); next() }}>
          <div className="content-header-row small">
            <div className="header-actions left" style={{ width: '100%' }}>
              <div className="info-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.4rem', width: '100%' }}>
                <div style={{ fontSize: '0.82rem' }}><strong>Tutor:</strong> {(docente.displayName || ((docente.nombres || '') + ' ' + (docente.apellidos || '')).trim())}</div>
                <div style={{ fontSize: '0.82rem' }}><strong>DNI:</strong> {docente.dni || '-'}</div>
                <div style={{ fontSize: '0.82rem' }}><strong>Código:</strong> {docente.codigo || '-'}</div>
                <div style={{ fontSize: '0.82rem' }}><strong>Facultad:</strong> {docente.facultadDependencia || '-'}</div>
                <div style={{ fontSize: '0.82rem' }}><strong>Teléfono:</strong> {docente.telefono || '-'}</div>
                <div style={{ fontSize: '0.82rem' }}><strong>Correo:</strong> {docente.email || '-'}</div>
                <div style={{ fontSize: '0.82rem' }}><strong>Resolución:</strong> {docente.resolucionDesignacion || '-'}</div>
              </div>
            </div>
          </div>
          <h3 style={{ marginTop: '0.2rem' }}>Asignacion de salon</h3>
          <div className="table-responsive">
            <table className="registro-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ fontSize: '0.7rem', backgroundColor: '#0b5ed7', color: '#fff' }}>
                <tr>
                  <th>Escuela</th>
                  <th>Ciclo Asignado</th>
                  <th>Sección</th>
                  <th>Turno</th>
                  <th>Curso que enseña</th>
                  <th>Día que enseña</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <select value={aula.carrera} onChange={(e) => setAula({ ...aula, carrera: e.target.value })}>
                      <option value="" disabled>Selecciona carrera</option>
                      <option value="Ingeniería Informática">Ingeniería Informática</option>
                      <option value="Ingeniería Electrónica">Ingeniería Electrónica</option>
                      <option value="Ingeniería Mecatrónica">Ingeniería Mecatrónica</option>
                      <option value="Ingeniería de Telecomunicaciones">Ingeniería de Telecomunicaciones</option>
                    </select>
                  </td>
                  <td>
                    <select value={aula.ciclo} onChange={(e) => setAula({ ...aula, ciclo: e.target.value })}>
                      <option value="" disabled>Selecciona ciclo</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                      <option value="7">7</option>
                      <option value="8">8</option>
                      <option value="9">9</option>
                      <option value="10">10</option>
                    </select>
                  </td>
                  <td>
                    <select value={aula.seccion} onChange={(e) => setAula({ ...aula, seccion: e.target.value })}>
                      <option value="" disabled>Selecciona sección</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                    </select>
                  </td>
                  <td>
                    <select value={aula.turno} onChange={(e) => setAula({ ...aula, turno: e.target.value })}>
                      <option value="" disabled>Selecciona turno</option>
                      <option value="Mañana">Mañana</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noche">Noche</option>
                    </select>
                  </td>
                  <td><input value={aula.curso} onChange={(e) => setAula({ ...aula, curso: e.target.value.toUpperCase() })} /></td>
                  <td>
                    <select value={aula.dia} onChange={(e) => setAula({ ...aula, dia: e.target.value })}>
                      <option value="" disabled>Selecciona día</option>
                      <option value="Lunes">Lunes</option>
                      <option value="Martes">Martes</option>
                      <option value="Miércoles">Miércoles</option>
                      <option value="Jueves">Jueves</option>
                      <option value="Viernes">Viernes</option>
                      <option value="Sábado">Sábado</option>
                      <option value="Domingo">Domingo</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="actions" style={{ marginTop: '0.5rem' }}>
            <button type="submit">Continuar</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div className="content-header-row">
            <div className="header-actions left" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'nowrap' }}>
                <div className="info-card" style={{ display: 'grid', gap: '0.25rem', width: 320 }}>
                  <div style={{ fontWeight: 700 }}>Tutor</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>Nombre:</strong> {(docente.displayName || ((docente.nombres || '') + ' ' + (docente.apellidos || '')).trim())}</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>DNI:</strong> {docente.dni || '-'}</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>Código:</strong> {docente.codigo || '-'}</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>Facultad:</strong> {docente.facultadDependencia || '-'}</div>
                </div>
                <div className="info-card" style={{ display: 'grid', gap: '0.25rem', width: 320 }}>
                  <div style={{ fontWeight: 700 }}>Aula asignada</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>Carrera:</strong> {aula.carrera || '-'}</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>Ciclo:</strong> {aula.ciclo || '-'} <span style={{ margin: '0 0.4rem' }}>•</span> <strong>Sección:</strong> {aula.seccion || '-'}</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>Turno:</strong> {aula.turno || '-'}</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>Curso que enseña:</strong> {aula.curso || '-'}</div>
                  <div style={{ fontSize: '0.82rem' }}><strong>Día que enseña:</strong> {aula.dia || '-'}</div>
                </div>
              </div>
              
            </div>
          </div>
          
          <h3 style={{ marginTop: '0.2rem' }}>Asignar alumnos</h3>
          <div className="content-header-row small">
            <div className="header-actions left" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button type="button" className="menu-item" onClick={openManualModal} style={{ color: '#fff', WebkitTextFillColor: '#141414ff', backgroundColor: '#236eddff', border: '1px solid #0b5ed7' }}>➕ Añadir alumnos</button>
            </div>
            <div className="header-actions right" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" onChange={handleFileChange} style={{ display: 'none' }} />
              <button type="button" className="menu-item" onClick={handleUploadClick} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#000', WebkitTextFillColor: '#000', backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.2)' }}>
                <img src={ExcelIcon} alt="Cargar alumnos" style={{ width: 24, height: 24, objectFit: 'cover' }} />
                <span>Cargar alumnos</span>
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.74rem' }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 240 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Apellidos</th>
                  <th>Nombres</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Nota</th>
                  <th>Faltas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ width: 36, textAlign: 'center' }}>{i + 1}</td>
                    <td><div style={{ fontSize: '0.74rem' }}>{(r.apellidos || '').toUpperCase()}</div></td>
                    <td><div style={{ fontSize: '0.74rem' }}>{(r.nombres || '').toUpperCase()}</div></td>
                    <td><div style={{ fontSize: '0.74rem' }}>{String(r.email || '').toLowerCase()}</div></td>
                    <td><div style={{ fontSize: '0.74rem' }}>{String(r.telefono || '')}</div></td>
                    <td style={{ textAlign: 'center' }}><div style={{ fontSize: '0.74rem' }}>{String(r.notaPromedio || '')}</div></td>
                    <td style={{ textAlign: 'center' }}><div style={{ fontSize: '0.74rem' }}>{String(r.faltasCantidad || '')}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csvErr && (<div className="tooltip-toast"><div className="tooltip-card">{csvErr}</div></div>)}
        </div>
      )}

      {toast && (<div className="tooltip-toast"><div className="tooltip-card">{toast}</div></div>)}
      {showUploadToast && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="content-card" style={{ display: 'grid', gap: '0.6rem', width: 'min(560px, 95vw)', padding: '0.6rem' }}>
            <div className="content-header" style={{ margin: 0 }}>Opciones de carga</div>
            <div className="content-header-row small">
              <div className="header-actions left" style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" onClick={() => fileRef.current?.click()} style={{ color: '#000', backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.25)', borderRadius: 6, fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}>Cargar lista de alumnos</button>
              </div>
              <div className="header-actions right" style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" onClick={() => setUploadPanelMsg('[por implementar]')} style={{ color: '#fff', backgroundColor: '#0b5ed7', border: '1px solid #0b5ed7', borderRadius: 6, fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}>Cargar del sistema de notas y asistencias</button>
                <button type="button" onClick={() => { setShowUploadToast(false); setUploadPanelMsg('') }} style={{ color: '#fff', backgroundColor: '#c00', border: '1px solid #c00', borderRadius: 6, fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}>Cerrar</button>
              </div>
            </div>
            {uploadPanelMsg && (
              <div className="tooltip-card" style={{ fontSize: '0.82rem' }}>{uploadPanelMsg}</div>
            )}
          </div>
        </div>
      )}

      {showManualModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="content-card" style={{ width: 'min(1200px, 98vw)', maxHeight: '80vh', overflowY: 'auto', overflowX: 'hidden', display: 'grid', gap: '0.6rem' }}>
            <div className="content-header" style={{ margin: 0 }}>Ingresar alumnos manualmente</div>
            <div className="table-responsive">
              <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.74rem' }}>
                <colgroup>
                  <col style={{ width: 36 }} />
                  <col style={{ width: 250 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 240 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                </colgroup>
                <thead style={{ fontSize: '0.72rem' }}>
                  <tr>
                    <th>N°</th>
                    <th>Apellidos y Nombres</th>
                    <th>Código</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Nota</th>
                    <th>Faltas</th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ width: 36, textAlign: 'center' }}>{i + 1}</td>
                      <td>
                        <input
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.74rem', padding: '0.25rem 0.35rem' }}
                          value={r.fullName || ''}
                          onChange={(e) => setManualField(i, 'fullName', e.target.value.toUpperCase())}
                        />
                      </td>
                      <td>
                        <input
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.74rem', padding: '0.25rem 0.35rem' }}
                          value={r.codigo || ''}
                          onChange={(e) => {
                            const code = e.target.value.trim();
                            setManualField(i, 'codigo', code);
                            setManualField(i, 'email', code ? (code + '@unfv.edu.pe').toLowerCase() : '');
                          }}
                        />
                      </td>
                      <td><input style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.74rem', padding: '0.25rem 0.35rem' }} value={r.email || (r.codigo ? (r.codigo + '@unfv.edu.pe').toLowerCase() : '')} readOnly /></td>
                      <td><input style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.74rem', padding: '0.25rem 0.35rem' }} value={r.telefono || ''} onChange={(e) => setManualField(i, 'telefono', e.target.value.replace(/\D/g, '').slice(0, 9))} /></td>
                      <td><input style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.74rem', padding: '0.2rem 0.25rem', textAlign: 'center' }} type="number" min="0" max="20" step="0.01" value={r.notaPromedio || ''} onChange={(e) => setManualField(i, 'notaPromedio', e.target.value)} /></td>
                      <td><input style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.74rem', padding: '0.2rem 0.25rem', textAlign: 'center' }} type="number" min="0" step="1" value={r.faltasCantidad || ''} onChange={(e) => setManualField(i, 'faltasCantidad', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="content-header-row small">
              <div className="header-actions left" style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" onClick={addManualRowModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#fff', backgroundColor: '#1f8f4b', border: '1px solid #1f8f4b', borderRadius: 6, fontSize: '0.78rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>➕ Agregar fila</button>
              </div>
              <div className="header-actions right" style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" onClick={closeManualModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#fff', backgroundColor: '#c00', border: '1px solid #c00', borderRadius: 6, fontSize: '0.78rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>Cancelar</button>
                <button type="button" onClick={saveManualModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#fff', backgroundColor: '#0b5ed7', border: '1px solid #0b5ed7', borderRadius: 6, fontSize: '0.78rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
