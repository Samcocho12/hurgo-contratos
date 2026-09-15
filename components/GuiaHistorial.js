import { ESTADOS_GUIA, formatearFecha } from '../lib/guias';
import { formatearPlaca } from '../lib/placa';

// Historial de movimientos, del más reciente al más antiguo.
export default function GuiaHistorial({ eventos, mostrarAutor = false }) {
  if (!eventos || eventos.length === 0) return null;
  return (
    <ol className="historial">
      {eventos.map((e, i) => (
        <li key={e.id || `${e.creado_en}-${i}`} className={`historial-item historial-${e.estado}`}>
          <time dateTime={e.creado_en}>{formatearFecha(e.creado_en)}</time>
          <div className="historial-estado">{ESTADOS_GUIA[e.estado]?.label || e.estado}</div>
          {e.ubicacion && <div className="historial-lugar">{e.ubicacion}</div>}
          {e.recibido_por && <div className="historial-lugar">Recibió: {e.recibido_por}</div>}
          {e.nota && <p className="historial-nota">{e.nota}</p>}
          {mostrarAutor && e.autor && (
            <div className="historial-autor">
              {e.autor === 'coordinador'
                ? `Registrado por coordinación${e.autor_detalle ? ` (${e.autor_detalle})` : ''}`
                : `Registrado por el conductor ${formatearPlaca(e.autor_detalle)}`}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
