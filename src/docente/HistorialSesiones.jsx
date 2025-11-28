export default function HistorialSesionesView() {
  const items = []
  return (
    <div>
      <div className="content-header">Historial de sesiones</div>
      <div className="table-responsive">
        <table className="historial-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Tema</th>
              <th>Tipo</th>
              <th>Alumnos</th>
              <th>Aula</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#666' }}>Sin registros</td>
              </tr>
            ) : (
              items.map((x) => (
                <tr key={x.id}>
                  <td>{x.fecha || ''}</td>
                  <td>{x.horaInicio || ''} - {x.horaFin || ''}</td>
                  <td>{x.tema || ''}</td>
                  <td>{x.tipoSesion || ''}</td>
                  <td>{Array.isArray(x.alumnosNombres) ? x.alumnosNombres.join(', ') : ''}</td>
                  <td>{x?.aula?.ciclo || ''} · {x?.aula?.seccion || ''}</td>
                  <td>
                    <span className={`badge ${x.realizada ? 'ok' : 'no'}`}>{x.realizada ? 'REALIZADA' : 'PROGRAMADA'}</span>
                  </td>
                  <td>
                    <button className="btn-save" disabled>Descargar</button>
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

