import { formatearFecha, formatearPesos, nombreRuta } from '../lib/guias';
import { formatearPlaca } from '../lib/placa';

// Datos completos de la guía (solo para conductor y coordinador).
export default function InfoGuia({ guia, mostrarConductor = false }) {
  return (
    <div className="panel">
      <h2 className="panel-titulo">Datos del envío</h2>
      <dl className="datos">
        <div className="datos-bloque">
          <dt>Ruta</dt>
          <dd>{nombreRuta(guia) || 'Sin contrato asociado'}<br />{guia.origen_ciudad} › {guia.destino_ciudad}</dd>
        </div>
        <div className="datos-bloque">
          <dt>Remitente</dt>
          <dd>
            {guia.remitente_nombre}
            {guia.remitente_telefono && <> · <a href={`tel:${guia.remitente_telefono}`}>{guia.remitente_telefono}</a></>}
            <br />{guia.origen_ciudad}{guia.origen_direccion ? `, ${guia.origen_direccion}` : ''}
          </dd>
        </div>
        <div className="datos-bloque">
          <dt>Destinatario</dt>
          <dd>
            {guia.destinatario_nombre} · <a href={`tel:${guia.destinatario_telefono}`}>{guia.destinatario_telefono}</a>
            <br />{guia.destino_ciudad}, {guia.destino_direccion}
          </dd>
        </div>
        <div className="datos-bloque">
          <dt>Contenido</dt>
          <dd>
            {guia.contenido}
            <br />{guia.unidades} {guia.unidades === 1 ? 'unidad' : 'unidades'}
            {guia.peso_kg ? `, ${Number(guia.peso_kg).toLocaleString('es-CO')} kg` : ''}
            {guia.valor_declarado !== null && guia.valor_declarado !== undefined ? `, valor declarado ${formatearPesos(guia.valor_declarado)}` : ''}
          </dd>
        </div>
        {guia.observaciones && (
          <div className="datos-bloque">
            <dt>Observaciones</dt>
            <dd>{guia.observaciones}</dd>
          </div>
        )}
        {mostrarConductor && (
          <div className="datos-bloque">
            <dt>Conductor</dt>
            <dd><span className="plate-badge">{formatearPlaca(guia.conductor_placa)}</span> {guia.conductor_nombre}</dd>
          </div>
        )}
        <div className="datos-bloque">
          <dt>Creada</dt>
          <dd>{formatearFecha(guia.creado_en)}</dd>
        </div>
      </dl>
    </div>
  );
}
