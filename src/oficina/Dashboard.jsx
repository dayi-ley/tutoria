import { useEffect, useState } from 'react'
import { collection, doc, setDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import LogoutButton from '../auth/LogoutButton.jsx'

export default function Dashboard({ user }) {
  const [active, setActive] = useState('alumnos')
  const name = user?.displayName || user?.email || 'Oficina de Tutoría'
  const [docentes, setDocentes] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [form, setForm] = useState({ nombres: '', apellidos: '', email: '', telefono: '', ciclo: '', seccion: '', docenteTutorId: '', carrera: '', turno: '', notaPromedio: '', faltasCantidad: '' })
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [salones, setSalones] = useState([])
  const [salonForm, setSalonForm] = useState({ ciclo: '', seccion: 'A', docenteTutorId: '' })
  
  const [filters, setFilters] = useState({ docenteTutorId: '', carrera: '' })
  const [carForm, setCarForm] = useState({ alumnoId: '', carrera: '', turno: 'Mañana' })
  const [derivaciones, setDerivaciones] = useState([])
  const [derivForm, setDerivForm] = useState({ derivacionId: '', estado: 'Pendiente' })
  const [denuncias, setDenuncias] = useState([])
  const [statusDocentes, setStatusDocentes] = useState([])
  const [_CARRERAS, setCarreras] = useState([])
  const [nuevoDocente, setNuevoDocente] = useState({ email: '', nombres: '', apellidos: '', telefono: '' })
  const [nuevoSalon, setNuevoSalon] = useState({ docenteNombres: '', docenteApellidos: '', carrera: '', ciclo: '', seccion: '', turno: '', docenteTutorId: '', curso: '', dia: '' })
  const [loadingDocentes, setLoadingDocentes] = useState(true)
  const [errDeriv, setErrDeriv] = useState('')
  const [errDenuncias, setErrDenuncias] = useState('')
  const [errStatus, setErrStatus] = useState('')
  const [savedRows, setSavedRows] = useState([])
  const [okDocentes, setOkDocentes] = useState('')
  const [_ERR_DOCENTES, setErrDocentes] = useState('')
  const [showSavePopup, setShowSavePopup] = useState(false)
  const [lastSavedEmail, setLastSavedEmail] = useState('')
  const submitNuevoSalon = async (e) => {
    e.preventDefault()
    setOk('')
    setErr('')
    if (!nuevoSalon.docenteTutorId || !nuevoSalon.carrera || !nuevoSalon.ciclo || !nuevoSalon.seccion || !nuevoSalon.turno) { setErr('Completa todos los campos'); return }
    try {
      const id = `${nuevoSalon.ciclo}-${nuevoSalon.seccion}`
      await setDoc(doc(db, 'salones', id), {
        ciclo: nuevoSalon.ciclo,
        seccion: nuevoSalon.seccion,
        carrera: nuevoSalon.carrera,
        turno: nuevoSalon.turno,
        curso: nuevoSalon.curso || '',
        dia: nuevoSalon.dia || '',
        docenteTutor_id: nuevoSalon.docenteTutorId || '',
        docente_nombres: nuevoSalon.docenteNombres,
        docente_apellidos: nuevoSalon.docenteApellidos,
        createdAt: serverTimestamp(),
      }, { merge: true })
      setOk('Aula registrada')
      const ss = await getDocs(collection(db, 'salones'))
      const listS = []
      ss.forEach((s) => listS.push({ id: s.id, ...(s.data() || {}) }))
      setSalones(listS)
      setNuevoSalon({ docenteNombres: '', docenteApellidos: '', carrera: '', ciclo: '', seccion: '', turno: '', docenteTutorId: '', curso: '', dia: '' })
    } catch (e) {
      setErr(e?.message || String(e))
    }
  }

  useEffect(() => {
    const run = async () => {
      if (!db) return
      const list = []
      try {
        const ds = await getDocs(collection(db, 'docentes'))
        ds.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
      } catch (e) { console.warn(e?.message || String(e)) }
      if (!list.length) {
        try {
          const ds2 = await getDocs(collection(db, 'Docentes'))
          ds2.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
        } catch (e) { console.warn(e?.message || String(e)) }
      }
      if (!list.length) {
        try {
          const ds3 = await getDocs(collection(db, 'docente'))
          ds3.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
        } catch (e) { console.warn(e?.message || String(e)) }
      }
      try {
        const allow = await getDocs(collection(db, 'docentes_allowlist'))
        const byId = new Map()
        list.forEach((x) => byId.set(x.id, { ...x }))
        allow.forEach((d) => {
          const k = d.id
          const v = d.data() || {}
          const prev = byId.get(k) || { id: k }
          byId.set(k, {
            ...prev,
            email: prev.email || v.email || k,
            nombres: prev.nombres || v.nombres || v.nombre || v.displayName || '',
            apellidos: prev.apellidos || v.apellidos || '',
            telefono: prev.telefono || v.telefono || ''
          })
        })
        setDocentes(Array.from(byId.values()))
      } catch (e) {
        setDocentes(list)
        void e
      }
      setLoadingDocentes(false)
      const as = await getDocs(collection(db, 'alumnos'))
      const listA = []
      as.forEach((a) => listA.push({ id: a.id, ...(a.data() || {}) }))
      setAlumnos(listA)
      const ss = await getDocs(collection(db, 'salones'))
      const listS = []
      ss.forEach((s) => listS.push({ id: s.id, ...(s.data() || {}) }))
      setSalones(listS)
      try {
        const cs = await getDocs(collection(db, 'carreras'))
        const listC = []
        cs.forEach((c) => listC.push((c.data() || {}).nombre || c.id))
        if (listC.length) {
          setCarreras(listC.filter((x) => !!x))
        } else {
          const setUniq = new Set()
          listA.forEach((a) => { if (a.carrera) setUniq.add(a.carrera) })
          listS.forEach((s) => { if (s.carrera) setUniq.add(s.carrera) })
          setCarreras(Array.from(setUniq))
        }
      } catch (e) {
        const setUniq = new Set()
        listA.forEach((a) => { if (a.carrera) setUniq.add(a.carrera) })
        listS.forEach((s) => { if (s.carrera) setUniq.add(s.carrera) })
        setCarreras(Array.from(setUniq))
        void e
      }
      try {
        const dsDer = await getDocs(collection(db, 'derivaciones'))
        const listDer = []
        dsDer.forEach((d) => listDer.push({ id: d.id, ...(d.data() || {}) }))
        setDerivaciones(listDer)
        setErrDeriv('')
      } catch (e) { setErrDeriv(String(e?.message || e)) }
      try {
        const dsDen = await getDocs(collection(db, 'denuncias'))
        const listDen = []
        dsDen.forEach((d) => listDen.push({ id: d.id, ...(d.data() || {}) }))
        setDenuncias(listDen)
        setErrDenuncias('')
      } catch (e) { setErrDenuncias(String(e?.message || e)) }
      try {
        const dsStat = await getDocs(collection(db, 'cumplimientos_status'))
        const listSt = []
        dsStat.forEach((d) => listSt.push({ id: d.id, ...(d.data() || {}) }))
        setStatusDocentes(listSt)
        setErrStatus('')
      } catch (e) { setErrStatus(String(e?.message || e)) }
    }
    run()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setOk('')
    setErr('')
    if (!form.nombres || !form.apellidos || !form.email || !form.ciclo || !form.seccion || !form.docenteTutorId || form.notaPromedio === '' || form.faltasCantidad === '') { setErr('Completa todos los campos'); return }
    const aula = { ciclo: form.ciclo, seccion: form.seccion }
    try {
      const salonSel = salones.find((s) => s.docenteTutor_id === form.docenteTutorId && s.ciclo === form.ciclo && s.seccion === form.seccion) || salones.find((s) => s.docenteTutor_id === form.docenteTutorId)
      const id = `${form.docenteTutorId}-${Date.now()}`
      await setDoc(doc(db, 'alumnos', id), {
        nombres: form.nombres,
        apellidos: form.apellidos,
        email: form.email,
        telefono: form.telefono || '',
        docenteTutorId: form.docenteTutorId,
        aula,
        carrera: form.carrera || '',
        turno: form.turno || 'Mañana',
        notaPromedio: Number(form.notaPromedio),
        faltasCantidad: Number(form.faltasCantidad),
        curso: salonSel?.curso || '',
        dia: salonSel?.dia || '',
        createdAt: serverTimestamp(),
      })
      setOk('Alumno registrado')
      setForm({ nombres: '', apellidos: '', email: '', telefono: '', ciclo: '', seccion: '', docenteTutorId: '', carrera: '', turno: '', notaPromedio: '', faltasCantidad: '' })
      const as = await getDocs(collection(db, 'alumnos'))
      const listA = []
      as.forEach((a) => listA.push({ id: a.id, ...(a.data() || {}) }))
      setAlumnos(listA)
    } catch (e) {
      setErr(e?.message || String(e))
    }
  }

  const submitSalon = async (e) => {
    e.preventDefault()
    setOk('')
    setErr('')
    if (!salonForm.ciclo || !salonForm.seccion || !salonForm.docenteTutorId) { setErr('Completa todos los campos'); return }
    try {
      const id = `${salonForm.ciclo}-${salonForm.seccion}`
      await setDoc(doc(db, 'salones', id), {
        ciclo: salonForm.ciclo,
        seccion: salonForm.seccion,
        docenteTutor_id: salonForm.docenteTutorId,
        createdAt: serverTimestamp(),
      }, { merge: true })
      setOk('Salón registrado')
      const ss = await getDocs(collection(db, 'salones'))
      const listS = []
      ss.forEach((s) => listS.push({ id: s.id, ...(s.data() || {}) }))
      setSalones(listS)
      setSalonForm({ ciclo: '', seccion: 'A', docenteTutorId: '' })
    } catch (e) {
      setErr(e?.message || String(e))
    }
  }

  


  const createDocente = async (e) => {
    e.preventDefault()
    setOk('')
    setErr('')
    if (!nuevoDocente.email || !nuevoDocente.nombres || !nuevoDocente.apellidos) { setErr('Completa email, nombres y apellidos'); return }
    try {
      const id = String(nuevoDocente.email).toLowerCase()
      await setDoc(doc(db, 'docentes', id), {
        email: String(nuevoDocente.email).toLowerCase(),
        nombres: nuevoDocente.nombres,
        apellidos: nuevoDocente.apellidos,
        telefono: nuevoDocente.telefono || '',
        createdAt: serverTimestamp()
      }, { merge: true })
      setOk('Docente creado')
      setNuevoDocente({ email: '', nombres: '', apellidos: '', telefono: '' })
      const ds = await getDocs(collection(db, 'docentes'))
      const list = []
      ds.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }))
      setDocentes(list)
    } catch (e) {
      setErr(e?.message || String(e))
    }
  }

  const saveDocenteRow = async (d) => {
    setOkDocentes('')
    setErrDocentes('')
    const id = String(d.id || d.email || '').toLowerCase()
    if (!id) { setErrDocentes('ID inválido'); return }
    const tel = String(d.telefono || '')
    if (tel.length !== 9) { setErrDocentes('El teléfono debe tener 9 dígitos'); return }
    try {
      await setDoc(doc(db, 'docentes_allowlist', id), {
        email: d.email || id,
        nombres: d.nombres || d.nombre || d.displayName || '',
        apellidos: d.apellidos || '',
        telefono: d.telefono || ''
      }, { merge: true })
      await setDoc(doc(db, 'docentes', id), {
        email: d.email || id,
        nombres: d.nombres || d.nombre || d.displayName || '',
        apellidos: d.apellidos || '',
        telefono: d.telefono || ''
      }, { merge: true })
      const list = []
      try {
        const ds = await getDocs(collection(db, 'docentes'))
        ds.forEach((x) => list.push({ id: x.id, ...(x.data() || {}) }))
      } catch (e) { console.warn(e?.message || String(e)) }
      try {
        const allow = await getDocs(collection(db, 'docentes_allowlist'))
        const byId = new Map()
        list.forEach((x) => byId.set(x.id, { ...x }))
        allow.forEach((a) => {
          const k = a.id
          const v = a.data() || {}
          const prev = byId.get(k) || { id: k }
          byId.set(k, {
            ...prev,
            email: prev.email || v.email || k,
            nombres: prev.nombres || v.nombres || v.nombre || v.displayName || '',
            apellidos: prev.apellidos || v.apellidos || '',
            telefono: prev.telefono || v.telefono || ''
          })
        })
        setDocentes(Array.from(byId.values()))
      } catch (e) {
        setDocentes(list)
        void e
      }
      setOkDocentes('Docente actualizado')
      setSavedRows((prev) => Array.from(new Set([...(prev || []), id])))
      setLastSavedEmail(d.email || id)
      setShowSavePopup(true)
      setTimeout(() => { setShowSavePopup(false); setOkDocentes('') }, 2000)
    } catch (e) {
      setErrDocentes(e?.message || String(e))
    }
  }

  const submitCarrera = async (e) => {
    e.preventDefault()
    setOk('')
    setErr('')
    const a = alumnos.find((x) => x.id === carForm.alumnoId)
    if (!a) { setErr('Selecciona alumno'); return }
    try {
      await updateDoc(doc(db, 'alumnos', a.id), {
        carrera: carForm.carrera || '',
        turno: carForm.turno || 'Mañana',
      })
      setOk('Carrera/turno actualizados')
      const as = await getDocs(collection(db, 'alumnos'))
      const listA = []
      as.forEach((x) => listA.push({ id: x.id, ...(x.data() || {}) }))
      setAlumnos(listA)
      setCarForm({ alumnoId: '', carrera: '', turno: 'Mañana' })
    } catch (e) {
      setErr(e?.message || String(e))
    }
  }

  const sections = [
    { key: 'alumnos', label: 'Registrar alumnos' },
    { key: 'asignaciones', label: 'Asignar aula y docente' },
    { key: 'derivaciones', label: 'Derivaciones' },
    { key: 'documentos', label: 'Documentos docentes' },
    { key: 'denuncias', label: 'Denuncias estudiantes' },
    { key: 'reportes', label: 'Reportes' },
  ]

  return (
    <div className="docente-layout">
      <aside className="sidebar sidebar-oficina">
        <div className="user-panel">
          <div className="avatar" style={{ cursor: 'default' }}>🏢</div>
          <div className="user-info">
            <div className="user-name">{name}</div>
            <div className="online">
              <span className="online-dot" />
              <span>Online</span>
            </div>
            
          </div>
        </div>
        <nav className="menu">
          {sections.map((s) => (
            <button
              key={s.key}
              className={`menu-item ${active === s.key ? 'active' : ''}`}
              onClick={() => setActive(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <LogoutButton />
        </div>
      </aside>
      <main className="content-area">
        {active === 'alumnos' ? (
          <div className="content-card">
            <h3>Registrar alumnos</h3>
            <div className="content-header-row">
              <div className="header-actions left">
                <select className="select-context" value={form.docenteTutorId} onChange={(e) => {
                  const id = e.target.value
                  const salon = salones.find((s) => s.docenteTutor_id === id)
                  setForm({
                    ...form,
                    docenteTutorId: id,
                    ciclo: salon?.ciclo || '',
                    seccion: salon?.seccion || '',
                    carrera: salon?.carrera || '',
                    turno: salon?.turno || ''
                  })
                }}>
                  <option value="" disabled>Selecciona docente</option>
                  {docentes.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombres || d.email || d.id}</option>
                  ))}
                </select>
                
                {form.docenteTutorId ? (
                  (() => {
                    const s = salones.find((x) => x.docenteTutor_id === form.docenteTutorId && x.ciclo === form.ciclo && x.seccion === form.seccion) || salones.find((x) => x.docenteTutor_id === form.docenteTutorId)
                    return (
                      <div className="header-info" style={{ color: '#000' }}>
                        {s ? `Curso: ${s.curso || '-'} • Ciclo: ${s.ciclo || '-'} • Sección: ${s.seccion || '-'}` : 'Sin salón asignado'}
                      </div>
                    )
                  })()
                ) : null}
              </div>
            </div>
            <form className="login-form" onSubmit={submit}>
              <div className="table-responsive">
                <table className="registro-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Nombres</th>
                      <th>Apellidos</th>
                      <th>Correo</th>
                      <th>Teléfono</th>
                      <th>Nota promedio</th>
                      <th>Faltas</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <input id="nombres" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
                      </td>
                      <td>
                        <input id="apellidos" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
                      </td>
                      <td>
                        <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} />
                      </td>
                      <td>
                        <input id="telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                      </td>
                      <td>
                        <input id="notaPromedio" type="number" step="0.01" min="0" max="20" value={form.notaPromedio} onChange={(e) => setForm({ ...form, notaPromedio: e.target.value })} />
                      </td>
                      <td>
                        <input id="faltasCantidad" type="number" step="1" min="0" value={form.faltasCantidad} onChange={(e) => setForm({ ...form, faltasCantidad: e.target.value })} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                <button type="submit">Registrar</button>
              </div>
              {err && <p className="error-text" style={{ marginTop: '0.25rem' }}>{err}</p>}
              {ok && <p style={{ marginTop: '0.25rem' }}>{ok}</p>}
            </form>
            <h3 style={{ marginTop: '1rem' }}>Alumnos registrados</h3>
            <div className="content-header-row small">
              <div className="header-actions left">
                <select className="menu-item" value={filters.docenteTutorId} onChange={(e) => setFilters({ ...filters, docenteTutorId: e.target.value })} style={{ fontWeight: 700, color: '#000', WebkitTextFillColor: '#000', backgroundColor: '#fff', opacity: 1, border: '1px solid rgba(0,0,0,0.2)' }}>
                  <option value="" style={{ color: '#000' }}>Todos los docentes</option>
                  {docentes.map((d) => (
                    <option key={d.id} value={d.id} style={{ color: '#000' }}>{d.nombres || d.email || d.id}</option>
                  ))}
                </select>
                <input className="menu-item" placeholder="Filtrar por carrera" value={filters.carrera} onChange={(e) => setFilters({ ...filters, carrera: e.target.value })} style={{ fontWeight: 700, color: '#000' }} />
              </div>
            </div>
            <div className="table-responsive">
                <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Correo</th>
                      <th>Teléfono</th>
                      
                      <th>Carrera</th>
                      <th>Turno</th>
                      <th>Nota</th>
                      <th>Faltas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnos.filter((a) => {
                    const byDoc = filters.docenteTutorId ? a.docenteTutorId === filters.docenteTutorId : true
                    const byCar = filters.carrera ? String(a.carrera || '').toLowerCase().includes(filters.carrera.toLowerCase()) : true
                    return byDoc && byCar
                  }).map((a) => (
                    <tr key={a.id}>
                      <td>{(a.nombres || '') + ' ' + (a.apellidos || '')}</td>
                      <td>{a.email}</td>
                      <td>{a.telefono}</td>
                      
                      <td>{a.carrera}</td>
                      <td>{a.turno}</td>
                      
                      <td>{a.notaPromedio}</td>
                      <td>{a.faltasCantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : active === 'asignaciones' ? (
          <div className="content-card">
            <h3>Asignar Docente tutor a un aula</h3>
            <form className="login-form" onSubmit={submitNuevoSalon}>
              <div className="table-responsive">
                <table className="registro-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Docente</th>
                      <th>Carrera de alumnos</th>
                      <th>Ciclo de alumnos</th>
                      <th>Sección</th>
                      <th>Turno</th>
                      <th>Curso</th>
                      <th>Día</th>

                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <select id="docenteSalonNuevo" value={nuevoSalon.docenteTutorId} onChange={(e) => {
                          const id = e.target.value
                          const d = docentes.find((x) => x.id === id)
                          setNuevoSalon({
                            ...nuevoSalon,
                            docenteTutorId: id,
                            docenteNombres: d?.nombres || '',
                            docenteApellidos: d?.apellidos || ''
                          })
                        }}>
                          <option value="" disabled>Selecciona docente</option>
                          {docentes.map((d) => (
                            <option key={d.id} value={d.id}>{((d.nombres || '') + ' ' + (d.apellidos || '')).trim() || d.email || d.id}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select id="carreraSalonNuevo" value={nuevoSalon.carrera} onChange={(e) => setNuevoSalon({ ...nuevoSalon, carrera: e.target.value })}>
                          <option value="" disabled>Selecciona carrera</option>
                          <option value="Ingeniería Electrónica">Ingeniería Electrónica</option>
                          <option value="Ingeniería Informática">Ingeniería Informática</option>
                          <option value="Ingeniería Mecatrónica">Ingeniería Mecatrónica</option>
                          <option value="Ingeniería de Telecomunicaciones">Ingeniería de Telecomunicaciones</option>
                        </select>
                      </td>
                      <td>
                        <select id="cicloSalonNuevo" value={nuevoSalon.ciclo} onChange={(e) => setNuevoSalon({ ...nuevoSalon, ciclo: e.target.value })}>
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
                        <select id="seccionSalonNuevo" value={nuevoSalon.seccion} onChange={(e) => setNuevoSalon({ ...nuevoSalon, seccion: e.target.value })}>
                          <option value="" disabled>Selecciona sección</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                        </select>
                      </td>
                      <td>
                        <select id="turnoSalonNuevo" value={nuevoSalon.turno} onChange={(e) => setNuevoSalon({ ...nuevoSalon, turno: e.target.value })}>
                          <option value="" disabled>Selecciona turno</option>
                          <option value="Mañana">Mañana</option>
                          <option value="Tarde">Tarde</option>
                          <option value="Noche">Noche</option>
                        </select>
                      </td>
                      <td>
                        <input id="cursoSalonNuevo" value={nuevoSalon.curso} onChange={(e) => setNuevoSalon({ ...nuevoSalon, curso: e.target.value })} />
                      </td>
                      <td>
                        <select id="diaSalonNuevo" value={nuevoSalon.dia} onChange={(e) => setNuevoSalon({ ...nuevoSalon, dia: e.target.value })}>
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
                <button type="submit">Registrar aula de docente</button>
              </div>
              {err && <p className="error-text" style={{ marginTop: '0.25rem' }}>{err}</p>}
              {ok && <p style={{ marginTop: '0.25rem' }}>{ok}</p>}
            </form>
            <h3 style={{ marginTop: '1rem' }}>Crear docente</h3>
            <form className="login-form" onSubmit={createDocente}>
              <div className="table-responsive">
                <table className="registro-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Nombres</th>
                      <th>Apellidos</th>
                      <th>Teléfono</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <input id="newDocEmail" type="email" value={nuevoDocente.email} onChange={(e) => setNuevoDocente({ ...nuevoDocente, email: e.target.value.toLowerCase() })} />
                      </td>
                      <td>
                        <input id="newDocNombres" value={nuevoDocente.nombres} onChange={(e) => setNuevoDocente({ ...nuevoDocente, nombres: e.target.value })} />
                      </td>
                      <td>
                        <input id="newDocApellidos" value={nuevoDocente.apellidos} onChange={(e) => setNuevoDocente({ ...nuevoDocente, apellidos: e.target.value })} />
                      </td>
                      <td>
                        <input id="newDocTelefono" value={nuevoDocente.telefono} onChange={(e) => setNuevoDocente({ ...nuevoDocente, telefono: e.target.value })} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                <button type="submit">Crear docente</button>
              </div>
              {err && <p className="error-text" style={{ marginTop: '0.25rem' }}>{err}</p>}
              {ok && <p style={{ marginTop: '0.25rem' }}>{ok}</p>}
            </form>
            <h3 style={{ marginTop: '1rem' }}>Docentes</h3>
            {showSavePopup && (
              <div className="tooltip-toast">
                <div className="tooltip-card">{okDocentes || (`Guardado con éxito: ${lastSavedEmail}`)}</div>
              </div>
            )}
            <div className="table-responsive">
              <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Email</th>
                      <th>Nombres y apellidos</th>
                      <th>Teléfono</th>
                      <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {docentes.map((d) => (
                    <tr key={d.id} className={savedRows.includes(d.id) ? 'row-saved' : ''}>
                      <td>{d.email || ''}</td>
                      <td>
                        <input value={`${(d.nombres || d.nombre || d.displayName || '').trim()}${d.apellidos ? ' ' + d.apellidos : ''}`} onChange={(e) => setDocentes((prev) => prev.map((x) => x.id === d.id ? { ...x, nombres: e.target.value } : x))} />
                      </td>
                      <td>
                        <input type="tel" maxLength={9} value={(d.telefono || '').toString()} onChange={(e) => {
                          const val = String(e.target.value || '').replace(/\D/g, '').slice(0, 9)
                          setDocentes((prev) => prev.map((x) => x.id === d.id ? { ...x, telefono: val } : x))
                        }} />
                      </td>
                      <td>
                        <button type="button" className={`btn-save${savedRows.includes(d.id) ? ' saved' : ''}`} onClick={() => saveDocenteRow(d)}>Guardar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loadingDocentes ? (
              <div className="info-card" style={{ marginTop: '0.5rem' }}>Cargando docentes…</div>
            ) : (!docentes.length ? (
              <div className="info-card" style={{ marginTop: '0.5rem' }}>No se encontraron docentes</div>
            ) : null)}

          </div>
        ) : active === 'salones' ? (
          <div className="content-card">
            <h3>Gestionar salones</h3>
            <form className="login-form" onSubmit={submitSalon}>
              <div className="form-group">
                <label htmlFor="cicloSalon">Ciclo</label>
                <input id="cicloSalon" value={salonForm.ciclo} onChange={(e) => setSalonForm({ ...salonForm, ciclo: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="seccionSalon">Sección</label>
                <select id="seccionSalon" value={salonForm.seccion} onChange={(e) => setSalonForm({ ...salonForm, seccion: e.target.value })}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="docenteSalon">Docente tutor</label>
                <select id="docenteSalon" value={salonForm.docenteTutorId} onChange={(e) => setSalonForm({ ...salonForm, docenteTutorId: e.target.value })}>
                  <option value="">Selecciona docente</option>
                  {docentes.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombres || d.email || d.id}</option>
                  ))}
                </select>
              </div>
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                <button type="submit">Guardar salón</button>
              </div>
              {err && <p className="error-text" style={{ marginTop: '0.25rem' }}>{err}</p>}
              {ok && <p style={{ marginTop: '0.25rem' }}>{ok}</p>}
            </form>
            <h3 style={{ marginTop: '1rem' }}>Salones</h3>
            <div className="table-responsive">
              <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Ciclo</th>
                    <th>Sección</th>
                    <th>Docente</th>
                  </tr>
                </thead>
                <tbody>
                  {salones.map((s) => (
                    <tr key={s.id}>
                      <td>{s.ciclo}</td>
                      <td>{s.seccion}</td>
                      <td>{s.docenteTutor_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : active === 'carreras' ? (
          <div className="content-card">
            <h3>Carreras y turnos</h3>
            <form className="login-form" onSubmit={submitCarrera}>
              <div className="form-group">
                <label htmlFor="alumnoCar">Alumno</label>
                <select id="alumnoCar" value={carForm.alumnoId} onChange={(e) => setCarForm({ ...carForm, alumnoId: e.target.value })}>
                  <option value="">Selecciona alumno</option>
                  {alumnos.map((a) => (
                    <option key={a.id} value={a.id}>{(a.nombres || '') + ' ' + (a.apellidos || '')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="carreraCar">Carrera</label>
                <input id="carreraCar" value={carForm.carrera} onChange={(e) => setCarForm({ ...carForm, carrera: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="turnoCar">Turno</label>
                <select id="turnoCar" value={carForm.turno} onChange={(e) => setCarForm({ ...carForm, turno: e.target.value })}>
                  <option value="Mañana">Mañana</option>
                  <option value="Noche">Noche</option>
                </select>
              </div>
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                <button type="submit">Actualizar</button>
              </div>
              {err && <p className="error-text" style={{ marginTop: '0.25rem' }}>{err}</p>}
              {ok && <p style={{ marginTop: '0.25rem' }}>{ok}</p>}
            </form>
          </div>
        ) : active === 'docentes' ? (
          <div className="content-card">
            <h3>Docentes</h3>
            <ul>
              {docentes.map((d) => (
                <li key={d.id}>{d.nombres || d.email || d.id}</li>
              ))}
            </ul>
          </div>
        ) : active === 'derivaciones' ? (
          <div className="content-card">
            <h3>Derivaciones</h3>
            <div className="table-responsive">
              <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Correo</th>
                    <th>Destino</th>
                    <th>Ciclo</th>
                    <th>Sección</th>
                    <th>Docente</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {derivaciones.map((d) => (
                    <tr key={d.id}>
                      <td>{d.alumnoNombre || ''}</td>
                      <td>{d.alumnoEmail || ''}</td>
                      <td>{d.destino || ''}</td>
                      <td>{d?.aula?.ciclo || ''}</td>
                      <td>{d?.aula?.seccion || ''}</td>
                      <td>{d.docenteId || ''}</td>
                      <td>{d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toLocaleString() : '') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errDeriv && <p className="error-text" style={{ marginTop: '0.25rem' }}>{errDeriv}</p>}
          </div>
        ) : active === 'validar-derivaciones' ? (
          <div className="content-card">
            <h3>Validar derivación</h3>
            <form className="login-form" onSubmit={async (e) => {
              e.preventDefault()
              setOk(''); setErr('')
              if (!derivForm.derivacionId) { setErr('Selecciona derivación'); return }
              try {
                await updateDoc(doc(db, 'derivaciones', derivForm.derivacionId), { estado: derivForm.estado })
                setOk('Derivación actualizada')
                const dsDer = await getDocs(collection(db, 'derivaciones'))
                const listDer = []
                dsDer.forEach((d) => listDer.push({ id: d.id, ...(d.data() || {}) }))
                setDerivaciones(listDer)
                setDerivForm({ derivacionId: '', estado: 'Pendiente' })
              } catch (e) { setErr(e?.message || String(e)) }
            }}>
              <div className="form-group">
                <label htmlFor="derivSel">Derivación</label>
                <select id="derivSel" value={derivForm.derivacionId} onChange={(e) => setDerivForm({ ...derivForm, derivacionId: e.target.value })}>
                  <option value="">Selecciona derivación</option>
                  {derivaciones.map((d) => (<option key={d.id} value={d.id}>{d.id}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="derivEstado">Estado</label>
                <select id="derivEstado" value={derivForm.estado} onChange={(e) => setDerivForm({ ...derivForm, estado: e.target.value })}>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Aceptada">Aceptada</option>
                  <option value="Rechazada">Rechazada</option>
                </select>
              </div>
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                <button type="submit">Actualizar</button>
              </div>
              {err && <p className="error-text" style={{ marginTop: '0.25rem' }}>{err}</p>}
              {ok && <p style={{ marginTop: '0.25rem' }}>{ok}</p>}
            </form>
          </div>
        ) : active === 'documentos' ? (
          <div className="content-card">
            <h3>Documentos docentes</h3>
            <div className="table-responsive">
              <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Docente</th>
                    <th>Plan</th>
                    <th>Informes mes</th>
                    <th>Informe final</th>
                  </tr>
                </thead>
                <tbody>
                  {statusDocentes.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.planCount || 0}</td>
                      <td>{Object.keys(s.informes || {}).length}</td>
                      <td>{s.finalCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errStatus && <p className="error-text" style={{ marginTop: '0.25rem' }}>{errStatus}</p>}
          </div>
        ) : active === 'denuncias' ? (
          <div className="content-card">
            <h3>Denuncias estudiantes</h3>
            <div className="table-responsive">
              <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {denuncias.map((d) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>{d.fecha || ''}</td>
                      <td>{d.tipoDenuncia || ''}</td>
                      <td>{d.descripcion || ''}</td>
                      <td>{d.estado || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errDenuncias && <p className="error-text" style={{ marginTop: '0.25rem' }}>{errDenuncias}</p>}
          </div>
        ) : (
          <div className="content-card">
            <h3>Reportes</h3>
            <div className="table-responsive">
              <table className="mis-tutorias-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td>Total docentes</td><td>{docentes.length}</td></tr>
                  <tr><td>Total alumnos</td><td>{alumnos.length}</td></tr>
                  <tr><td>Salones</td><td>{salones.length}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
