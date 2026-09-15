import Link from 'next/link';
import { ESTADOS_GUIA, formatearFechaCorta, formatearNumeroGuia } from '../lib/guias';
import { formatearPlaca } from '../lib/placa';

export default function GuiaTarjeta({ guia, href, mostrarPlaca = false }) {
  return (
    <Link href={href} className="card-link">
      <div className={`card card-guia-${guia.estado}`}>
        <div className="card-row">
          <div>
            <div className="guia-num-sm">{formatearNumeroGuia(guia.numero)}</div>
            <div className="card-title" style={{ marginTop: 6 }}>{guia.destinatario_nombre}</div>
            <div className="guia-trayecto">{guia.origen_ciudad} <span aria-hidden="true">›</span> {guia.destino_ciudad}</div>
            <div className="card-meta">
              {mostrarPlaca && <><span className="plate-badge plate-sm">{formatearPlaca(guia.conductor_placa)}</span>{' '}</>}
              Act. {formatearFechaCorta(guia.actualizado_en || guia.creado_en)}
            </div>
          </div>
          <span className={`status status-g-${guia.estado}`}>{ESTADOS_GUIA[guia.estado]?.corto || guia.estado}</span>
        </div>
      </div>
    </Link>
  );
}
