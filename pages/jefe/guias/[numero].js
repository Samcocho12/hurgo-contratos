import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';
import { llamarApiJefe } from '../../../lib/apiJefe';
import AppHeader from '../../../components/AppHeader';
import GuiaRuta from '../../../components/GuiaRuta';
import GuiaHistorial from '../../../components/GuiaHistorial';
import FormEstadoGuia from '../../../components/FormEstadoGuia';
import CompartirGuia from '../../../components/CompartirGuia';
import InfoGuia from '../../../components/InfoGuia';
import {
  ESTADOS_FINALES, ESTADOS_GUIA, formatearNumeroGuia, normalizarNumeroGuia,
} from '../../../lib/guias';

export default function GuiaJefe() {
  const router = useRouter();
  const numero = normalizarNumeroGuia(router.query.numero);
  const [guia, setGuia] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    verificarAcceso();
  }, [router.isReady, numero]);

  async function verificarAcceso() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user || localStorage.getItem('hurgo_rol') !== 'jefe') {
      router.replace('/login');
      return;
    }
    setCorreo(data.user.email || '');
    cargar();
  }

  async function cargar() {
    const { ok, datos } = await llamarApiJefe(`/api/jefe/guias?numero=${encodeURIComponent(numero)}`);
    if (!ok) { setError(datos?.error || 'No se pudo cargar la guía.'); return; }
    setGuia(datos.guia);
    setEventos(datos.eventos || []);
  }

  async function guardarEstado({ estado, nota, recibido_por }) {
    const { ok, datos } = await llamarApiJefe('/api/jefe/guias', {
      method: 'PATCH',
      body: JSON.stringify({ guiaId: guia.id, estado, nota, recibido_por }),
    });
    if (!ok) return 'No se pudo guardar: ' + (datos?.error || '');
    await cargar();
    return null;
  }

  async function eliminar() {
    const ok = window.confirm(
      `¿Eliminar la guía ${formatearNumeroGuia(guia.numero)}? Se borra también su historial y el enlace de rastreo deja de funcionar.`
    );
    if (!ok) return;
    const resp = await llamarApiJefe('/api/jefe/guias', {
      method: 'DELETE',
      body: JSON.stringify({ guiaId: guia.id }),
    });
    if (!resp.ok) { alert('No se pudo eliminar: ' + (resp.datos?.error || '')); return; }
    router.push('/jefe/guias');
  }

  return (
    <>
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/jefe/guias')}>← Guías</button>

        {error && (
          <div className="empty">
            <div className="empty-title">Guía no disponible</div>
            <div className="empty-sub">{error}</div>
          </div>
        )}
        {!guia && !error && <p className="page-sub">Cargando guía…</p>}

        {guia && (
          <>
            {router.query.nueva && (
              <div className="aviso-banda" role="status">
                Guía creada y asignada a {guia.conductor_nombre || 'el conductor'}. Compártela con el destinatario.
              </div>
            )}
            <div className="guia-cabecera">
              <div className="guia-num">{formatearNumeroGuia(guia.numero)}</div>
              <span className={`status status-g-${guia.estado}`}>{ESTADOS_GUIA[guia.estado]?.label}</span>
            </div>
            <p className="guia-trayecto guia-trayecto-lg">
              {guia.origen_ciudad} <span aria-hidden="true">›</span> {guia.destino_ciudad}
            </p>

            <GuiaRuta eventos={eventos} estado={guia.estado} />

            <CompartirGuia numero={guia.numero} destinatarioNombre={guia.destinatario_nombre}
              destinatarioTelefono={guia.destinatario_telefono} />

            <InfoGuia guia={guia} mostrarConductor />

            {guia.contratos?.pdf_firmado_url && (
              <a className="btn btn-ghost" style={{ marginTop: -4, marginBottom: 16 }}
                href={guia.contratos.pdf_firmado_url} target="_blank" rel="noreferrer">
                Ver contrato firmado de esta ruta
              </a>
            )}

            {!ESTADOS_FINALES.includes(guia.estado) && (
              <FormEstadoGuia estadoActual={guia.estado} onGuardar={guardarEstado} permitirCancelar />
            )}

            <a className="btn btn-ghost" href={`/rastreo/${guia.numero}`} target="_blank" rel="noreferrer">
              Ver como la ve el cliente
            </a>

            <h2 className="seccion-titulo">Historial</h2>
            <GuiaHistorial eventos={eventos} mostrarAutor />

            <div className="exit-row">
              <button className="btn btn-danger btn-sm" onClick={eliminar}>Eliminar guía</button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
