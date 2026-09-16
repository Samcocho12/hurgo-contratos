import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppHeader from '../../../components/AppHeader';
import GuiaRuta from '../../../components/GuiaRuta';
import GuiaHistorial from '../../../components/GuiaHistorial';
import FormEstadoGuia from '../../../components/FormEstadoGuia';
import InfoGuia from '../../../components/InfoGuia';
import { llamarApiConductor } from '../../../lib/apiConductor';
import { ESTADOS_FINALES, ESTADOS_GUIA, formatearNumeroGuia } from '../../../lib/guias';

export default function GuiaConductor() {
  const router = useRouter();
  const { numero } = router.query;
  const [guia, setGuia] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    if (localStorage.getItem('hurgo_rol') !== 'conductor') { router.replace('/login'); return; }
    cargar();
  }, [router.isReady, numero]);

  async function cargar() {
    const { ok, status, datos } = await llamarApiConductor(`/api/conductor/guia?numero=${encodeURIComponent(numero)}`);
    if (status === 401) { router.replace('/login'); return; }
    if (!ok) { setError(datos.error || 'No se pudo cargar la guía.'); return; }
    setGuia(datos.guia);
    setEventos(datos.eventos || []);
  }

  async function guardarEstado(payload) {
    const { ok, datos } = await llamarApiConductor('/api/conductor/guia', {
      method: 'POST',
      body: JSON.stringify({ numero, ...payload }),
    });
    if (!ok) return datos.error || 'No se pudo guardar el estado.';
    await cargar();
    return null;
  }

  return (
    <>
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/conductor/guias')}>← Mis guías</button>

        {error && (
          <div className="empty">
            <div className="empty-title">Guía no disponible</div>
            <div className="empty-sub">{error}</div>
          </div>
        )}
        {!guia && !error && <p className="page-sub">Cargando guía…</p>}

        {guia && (
          <>

            <div className="guia-cabecera">
              <div className="guia-num">{formatearNumeroGuia(guia.numero)}</div>
              <span className={`status status-g-${guia.estado}`}>{ESTADOS_GUIA[guia.estado]?.label}</span>
            </div>
            <p className="guia-trayecto guia-trayecto-lg">
              {guia.origen_ciudad} <span aria-hidden="true">›</span> {guia.destino_ciudad}
            </p>

            <GuiaRuta eventos={eventos} estado={guia.estado} />

            {ESTADOS_FINALES.includes(guia.estado) ? (
              <div className="panel">
                <p className="panel-texto" style={{ margin: 0 }}>
                  Esta guía está {guia.estado === 'entregada' ? 'entregada' : 'cancelada'} y ya no se puede actualizar.
                </p>
              </div>
            ) : (
              <FormEstadoGuia estadoActual={guia.estado} onGuardar={guardarEstado} />
            )}

            <InfoGuia guia={guia} />

            <h2 className="seccion-titulo">Historial</h2>
            <GuiaHistorial eventos={eventos} mostrarAutor />
          </>
        )}
      </main>
    </>
  );
}
