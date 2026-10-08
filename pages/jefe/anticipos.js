import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { llamarApiJefe } from '../../lib/apiJefe';
import PanelLayout from '../../components/PanelLayout';
import { formatearPlaca } from '../../lib/placa';

const ESTADOS = {
  solicitado: { label: 'Por revisar', clase: 'pendiente' },
  aprobado:   { label: 'Aprobado',    clase: 'visto' },
  rechazado:  { label: 'Rechazado',   clase: 'rechazado' },
  pagado:     { label: 'Pagado',      clase: 'visto' },
  legalizado: { label: 'Cerrado',     clase: 'firmado' },
};

const pesos = (v) =>
  '$' + Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

export default function AnticiposJefe() {
  const router = useRouter();
  const [anticipos, setAnticipos] = useState([]);
  const [error, setError] = useState('');
  const [verCerrados, setVerCerrados] = useState(false);

  useEffect(() => { verificarAcceso(); }, []);

  async function verificarAcceso() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user || localStorage.getItem('hurgo_rol') !== 'jefe') {
      router.replace('/login');
      return;
    }
    cargar();
  }

  async function cargar() {
    const { ok, datos } = await llamarApiJefe('/api/jefe/anticipos');
    if (!ok) { setError(datos.error || 'No se pudieron cargar los anticipos.'); return; }
    setError('');
    setAnticipos(datos.anticipos || []);
  }

  async function accion(id, accion, extra = {}) {
    const { ok, datos } = await llamarApiJefe('/api/jefe/anticipos', {
      method: 'PATCH',
      body: JSON.stringify({ id, accion, ...extra }),
    });
    if (!ok) { alert(datos.error || 'No se pudo completar la acción.'); return; }
    cargar();
  }

  function aprobar(a) {
    const propuesto = window.prompt(
      `${a.conductor_nombre} pide ${pesos(a.monto_solicitado)}.\n\nConfirma el monto a entregar:`,
      String(a.monto_solicitado).replace(/\.00$/, '')
    );
    if (propuesto === null) return;
    const monto = Number(String(propuesto).replace(/\D/g, ''));
    if (!(monto > 0)) { alert('Monto no válido.'); return; }
    accion(a.id, 'aprobar', { monto });
  }

  function rechazar(a) {
    const motivo = window.prompt(`¿Por qué rechazas el anticipo de ${a.conductor_nombre}?`);
    if (!motivo) return;
    accion(a.id, 'rechazar', { motivo });
  }

  function pagar(a) {
    const referencia = window.prompt(
      `Marcar como entregado ${pesos(a.monto_aprobado)} a ${a.conductor_nombre}.\n\nReferencia del pago (opcional):`, ''
    );
    if (referencia === null) return;
    accion(a.id, 'pagar', { referencia });
  }

  function legalizar(a) {
    const saldo = Number(a.monto_aprobado || 0) - Number(a.gastado || 0);
    const resumen = saldo === 0 ? 'Los gastos cuadran exactamente.'
      : saldo > 0 ? `Sobran ${pesos(saldo)} por devolver.`
      : `Se excedió en ${pesos(-saldo)}.`;
    if (!window.confirm(`Cerrar el anticipo de ${a.conductor_nombre}.\n\n${resumen}\n\n¿Confirmas?`)) return;
    accion(a.id, 'legalizar', {});
  }

  // El PDF va con el token del coordinador, asi que se baja por fetch
  // y no con un enlace suelto.
  async function descargarLegalizacion(a) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) { alert('Tu sesión expiró. Vuelve a iniciar sesión.'); return; }

    try {
      const resp = await fetch(`/api/jefe/legalizacion?id=${a.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const datos = await resp.json().catch(() => ({}));
        alert(datos.error || 'No se pudo generar el PDF.');
        return;
      }
      const blob = await resp.blob();
      if (!blob.size) { alert('El PDF llegó vacío. Avísame para revisarlo.'); return; }

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `legalizacion-${a.conductor_placa}.pdf`;
      enlace.rel = 'noopener';
      // El enlace tiene que estar en la pagina para que el clic cuente, y el
      // blob no se puede soltar enseguida: el navegador todavia no lo leyo.
      document.body.appendChild(enlace);
      enlace.click();
      setTimeout(() => {
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
      }, 4000);
    } catch (err) {
      console.error(err);
      alert('No se pudo descargar. Revisa tu conexión.');
    }
  }

  const pendientes = anticipos.filter((a) => a.estado === 'solicitado');
  const activos = anticipos.filter((a) => ['aprobado', 'pagado'].includes(a.estado));
  const cerrados = anticipos.filter((a) => ['legalizado', 'rechazado'].includes(a.estado));

  const visibles = verCerrados ? cerrados : [...pendientes, ...activos];

  const porEntregar = activos
    .filter((a) => a.estado === 'aprobado')
    .reduce((t, a) => t + Number(a.monto_aprobado || 0), 0);
  const sinLegalizar = activos.filter((a) => a.estado === 'pagado').length;

  return (
    <PanelLayout
      activo="/jefe/anticipos"
      titulo="Anticipos"
      descripcion="Dinero que los conductores piden por adelantado para cubrir el viaje."
      acciones={
        <button
          className={verCerrados ? 'btn btn-stamp' : 'btn btn-ghost'}
          onClick={() => setVerCerrados(!verCerrados)}
        >
          {verCerrados ? 'Ver activos' : `Ver cerrados (${cerrados.length})`}
        </button>
      }
    >
      <button className="back-link solo-movil" onClick={() => router.push('/jefe')}>← Volver</button>

      {!verCerrados && (
        <div className="cifras solo-escritorio">
          <div className="cifra cifra-amber">
            <span className="cifra-num">{pendientes.length}</span>
            <span className="cifra-lbl">por revisar</span>
          </div>
          <div className="cifra">
            <span className="cifra-num">{pesos(porEntregar)}</span>
            <span className="cifra-lbl">aprobados sin entregar</span>
          </div>
          <div className="cifra">
            <span className="cifra-num">{sinLegalizar}</span>
            <span className="cifra-lbl">esperando soportes</span>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {visibles.length === 0 && (
        <div className="empty">
          <div className="empty-title">
            {verCerrados ? 'No hay anticipos cerrados' : 'No hay anticipos en curso'}
          </div>
          <div className="empty-sub">
            {verCerrados ? '' : 'Aquí aparecen las solicitudes de los conductores'}
          </div>
        </div>
      )}

      {visibles.map((a) => {
        const est = ESTADOS[a.estado] || { label: a.estado, clase: 'pendiente' };
        const entregado = Number(a.monto_aprobado || 0);
        const saldo = entregado - Number(a.gastado || 0);

        return (
          <div
            className="card"
            key={a.id}
            style={a.estado === 'solicitado' ? { borderLeft: '3px solid #E8A32B' } : undefined}
          >
            <div className="card-row">
              <div>
                <span className="plate-badge">{formatearPlaca(a.conductor_placa)}</span>
                <div className="card-title" style={{ marginTop: 8 }}>
                  {a.conductor_nombre} · {pesos(a.monto_aprobado || a.monto_solicitado)}
                </div>
                {a.destino && <div className="card-meta">{a.destino}</div>}
                <div className="card-meta">
                  {new Date(a.creado_en).toLocaleString('es-CO', {
                    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
              <span className={`status status-${est.clase}`}>{est.label}</span>
            </div>

            <div className="card-meta" style={{ marginTop: 8 }}>{a.motivo}</div>

            {a.estado === 'aprobado' && entregado !== Number(a.monto_solicitado) && (
              <div className="card-meta">Pidió {pesos(a.monto_solicitado)}</div>
            )}
            {a.motivo_rechazo && (
              <div className="card-meta">Motivo del rechazo: {a.motivo_rechazo}</div>
            )}

            {(a.estado === 'pagado' || a.estado === 'legalizado') && (
              <>
                <div className="card-meta" style={{ marginTop: 10, fontWeight: 700 }}>
                  Soportes: {pesos(a.gastado)} de {pesos(entregado)}
                  {saldo !== 0 && (
                    <> · {saldo > 0 ? `faltan ${pesos(saldo)} por justificar` : `excedido ${pesos(-saldo)}`}</>
                  )}
                </div>
                {a.soportes.map((s) => (
                  <div className="card-row" key={s.id} style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 14 }}>
                      {s.descripcion}
                      {s.archivo_url && (
                        <>
                          {' · '}
                          <a className="card-link" href={s.archivo_url} target="_blank" rel="noreferrer">
                            recibo
                          </a>
                        </>
                      )}
                    </div>
                    <div style={{ fontWeight: 700 }}>{pesos(s.monto)}</div>
                  </div>
                ))}
                {a.soportes.length === 0 && (
                  <div className="card-meta">Todavía no ha subido soportes.</div>
                )}
              </>
            )}

            <div className="card-foot" style={{ flexWrap: 'wrap', gap: 6 }}>
              {a.estado === 'solicitado' && (
                <>
                  <button className="btn btn-stamp btn-sm" onClick={() => aprobar(a)}>Aprobar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rechazar(a)}>Rechazar</button>
                </>
              )}
              {a.estado === 'aprobado' && (
                <button className="btn btn-stamp btn-sm" onClick={() => pagar(a)}>
                  Marcar como entregado
                </button>
              )}
              {(a.estado === 'pagado' || a.estado === 'legalizado') && a.soportes.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => descargarLegalizacion(a)}>
                  Descargar legalización
                </button>
              )}
              {a.estado === 'pagado' && (
                <button className="btn btn-ghost btn-sm" onClick={() => legalizar(a)}>
                  Cerrar anticipo
                </button>
              )}
            </div>
          </div>
        );
      })}
    </PanelLayout>
  );
}
