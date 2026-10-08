import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import RastreoMarco from '../../components/RastreoMarco';
import BuscadorGuia from '../../components/BuscadorGuia';
import GuiaRuta from '../../components/GuiaRuta';
import GuiaHistorial from '../../components/GuiaHistorial';
import { ESTADOS_GUIA, formatearFecha, formatearNumeroGuia } from '../../lib/guias';

export default function RastreoGuia() {
  const router = useRouter();
  const { numero } = router.query;
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;
    consultar();
  }, [router.isReady, numero]);

  async function consultar() {
    setCargando(true);
    setError('');
    setResultado(null);
    try {
      const resp = await fetch(`/api/rastreo?numero=${encodeURIComponent(numero)}`);
      const datos = await resp.json();
      if (!resp.ok) setError(datos.error || 'No pudimos consultar la guía.');
      else setResultado(datos);
    } catch {
      setError('Sin conexión. Revisa tu internet e intenta de nuevo.');
    }
    setCargando(false);
  }

  const guia = resultado?.guia;
  const eventos = resultado?.eventos || [];
  const titulo = guia ? `Guía ${formatearNumeroGuia(guia.numero)} · Hurgo Transporte` : 'Rastreo · Hurgo Transporte';

  return (
    <RastreoMarco titulo={titulo}>
      <BuscadorGuia valorInicial={typeof numero === 'string' ? numero : ''} compacto key={numero} />

      {cargando && <p className="rastreo-cargando">Consultando guía…</p>}

      {!cargando && error && (
        <div className="rastreo-error" role="alert">
          <h1>Guía no encontrada</h1>
          <p>{error}</p>
        </div>
      )}

      {guia && (
        <article className={`guia-publica guia-publica-${guia.estado}`}>
          <div className="guia-publica-top">
            <span className="guia-publica-lbl">Guía</span>
            <span className="guia-num">{formatearNumeroGuia(guia.numero)}</span>
          </div>

          <h1 className="guia-publica-estado">{ESTADOS_GUIA[guia.estado]?.label}</h1>
          <p className="guia-publica-desc">{ESTADOS_GUIA[guia.estado]?.publico}</p>


          <div className="guia-publica-trayecto">
            <div>
              <span className="guia-publica-lbl">Desde</span>
              <span className="guia-publica-ciudad">{guia.origen_ciudad}</span>
            </div>
            <span className="guia-publica-flecha" aria-hidden="true" />
            <div style={{ textAlign: 'right' }}>
              <span className="guia-publica-lbl">Hacia</span>
              <span className="guia-publica-ciudad">{guia.destino_ciudad}</span>
            </div>
          </div>

          <GuiaRuta eventos={eventos} estado={guia.estado} />

          <dl className="guia-publica-datos">
            <div><dt>Para</dt><dd>{guia.destinatario || '—'}</dd></div>
            <div><dt>Unidades</dt><dd>{guia.unidades}</dd></div>
            <div><dt>Creada</dt><dd>{formatearFecha(guia.creado_en, false)}</dd></div>
            {guia.entregado_en && <div><dt>Entregada</dt><dd>{formatearFecha(guia.entregado_en)}</dd></div>}
            {guia.recibido_por && <div><dt>Recibió</dt><dd>{guia.recibido_por}</dd></div>}
          </dl>
        </article>
      )}

      {guia && eventos.length > 0 && (
        <section className="rastreo-historial">
          <h2 className="seccion-titulo">Movimientos</h2>
          <GuiaHistorial eventos={eventos} />
          <button className="btn btn-ghost" onClick={consultar}>Actualizar</button>
        </section>
      )}
    </RastreoMarco>
  );
}
