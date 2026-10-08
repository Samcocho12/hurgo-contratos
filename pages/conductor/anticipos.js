import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppHeader from '../../components/AppHeader';
import BarraConductor from '../../components/BarraConductor';
import { llamarApiConductor } from '../../lib/apiConductor';

const ESTADOS = {
  solicitado: { label: 'En revisión', clase: 'pendiente' },
  aprobado:   { label: 'Aprobado',    clase: 'visto' },
  rechazado:  { label: 'Rechazado',   clase: 'rechazado' },
  pagado:     { label: 'Pagado',      clase: 'visto' },
  legalizado: { label: 'Cerrado',     clase: 'firmado' },
};

const pesos = (v) =>
  '$' + Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

export default function Anticipos() {
  const router = useRouter();
  const [anticipos, setAnticipos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');

  // Formulario de solicitud
  const [pidiendo, setPidiendo] = useState(false);
  const [monto, setMonto] = useState('');
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Soportes
  const [subiendo, setSubiendo] = useState(false);
  const [sDescripcion, setSDescripcion] = useState('');
  const [sMonto, setSMonto] = useState('');
  const [sArchivo, setSArchivo] = useState(null);

  useEffect(() => {
    if (localStorage.getItem('hurgo_rol') !== 'conductor') { router.replace('/login'); return; }
    cargar();
  }, []);

  async function cargar() {
    const { ok, datos } = await llamarApiConductor('/api/conductor/anticipos');
    setCargado(true);
    if (!ok) { setError(datos?.error || 'No se pudieron cargar tus anticipos.'); return; }
    setError('');
    setAnticipos(datos.anticipos || []);
  }

  async function solicitar(e) {
    e.preventDefault();
    setError('');
    const valor = Number(String(monto).replace(/\D/g, ''));
    if (!(valor > 0)) { setError('Escribe cuánto necesitas.'); return; }
    if (motivo.trim().length < 5) { setError('Explica para qué es el anticipo.'); return; }

    setEnviando(true);
    const { ok, datos } = await llamarApiConductor('/api/conductor/anticipos', {
      method: 'POST',
      body: JSON.stringify({ monto: valor, motivo: motivo.trim(), destino: destino.trim() }),
    });
    setEnviando(false);

    if (!ok) { setError(datos?.error || 'No se pudo enviar la solicitud.'); return; }
    setMonto(''); setDestino(''); setMotivo(''); setPidiendo(false);
    cargar();
  }

  async function agregarSoporte(e, anticipoId) {
    e.preventDefault();
    setError('');
    const valor = Number(String(sMonto).replace(/\D/g, ''));
    if (!sDescripcion.trim()) { setError('Escribe en qué gastaste.'); return; }
    if (!(valor >= 0)) { setError('Escribe el valor del gasto.'); return; }

    setSubiendo(true);
    let urlArchivo = null;

    // La foto del recibo sube con un permiso firmado que da el servidor.
    if (sArchivo) {
      const permiso = await llamarApiConductor('/api/conductor/archivos', {
        method: 'POST',
        body: JSON.stringify({ nombre: sArchivo.name }),
      });
      if (!permiso.ok) {
        setSubiendo(false);
        setError(permiso.datos?.error || 'No se pudo preparar la subida.');
        return;
      }
      try {
        const resp = await fetch(permiso.datos.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': sArchivo.type || 'application/octet-stream' },
          body: sArchivo,
        });
        if (!resp.ok) throw new Error();
        urlArchivo = permiso.datos.url;
      } catch {
        setSubiendo(false);
        setError('No se pudo subir la foto. Intenta de nuevo.');
        return;
      }
    }

    const { ok, datos } = await llamarApiConductor('/api/conductor/anticipos?soporte=1', {
      method: 'POST',
      body: JSON.stringify({
        anticipoId,
        descripcion: sDescripcion.trim(),
        monto: valor,
        archivo: urlArchivo,
      }),
    });
    setSubiendo(false);

    if (!ok) { setError(datos?.error || 'No se pudo guardar el gasto.'); return; }
    setSDescripcion(''); setSMonto(''); setSArchivo(null);
    cargar();
  }

  const enCurso = anticipos.find((a) =>
    ['solicitado', 'aprobado', 'pagado'].includes(a.estado));

  // ------------------------------------------------ Formulario
  if (pidiendo) {
    return (
      <div className="dashboard-bg con-barra">
        <AppHeader />
        <main className="page">
          <button className="back-link" onClick={() => setPidiendo(false)}>← Cancelar</button>
          <h1 className="page-title">Pedir anticipo</h1>
          <p className="page-sub">
            Tu coordinador recibe la solicitud y te responde desde aquí mismo.
          </p>

          <form onSubmit={solicitar}>
            <label style={{ marginTop: 0 }}>¿Cuánto necesitas?</label>
            <input
              inputMode="numeric"
              placeholder="Ej: 350000"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700 }}
            />
            {monto && <div className="card-meta" style={{ marginTop: -10, marginBottom: 14 }}>
              {pesos(monto)}
            </div>}

            <label>Ruta o destino (opcional)</label>
            <input
              placeholder="Ej: Virginia → Santa Marta, Barranquilla, Cartagena"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
            />

            <label>¿Para qué es?</label>
            <textarea
              rows={4}
              placeholder="Ej: hospedaje dos noches, comida, peajes del trayecto"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />

            {error && <div className="error">{error}</div>}
            <button className="btn btn-stamp" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  // ------------------------------------------------ Listado
  return (
    <div className="dashboard-bg con-barra">
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/conductor')}>← Mis contratos</button>
        <h1 className="page-title">Anticipos</h1>
        <p className="page-sub">Dinero que pides por adelantado para cubrir el viaje.</p>

        {error && <div className="error">{error}</div>}

        {cargado && !enCurso && (
          <button
            className="btn btn-stamp"
            style={{ marginTop: 0, marginBottom: 18 }}
            onClick={() => setPidiendo(true)}
          >
            Pedir un anticipo
          </button>
        )}

        {cargado && enCurso && (
          <div className="card-meta" style={{ marginBottom: 16 }}>
            Podrás pedir otro anticipo cuando cierres el que tienes en curso.
          </div>
        )}

        {cargado && anticipos.length === 0 && (
          <div className="empty">
            <div className="empty-title">Aún no has pedido anticipos</div>
            <div className="empty-sub">Toca el botón para hacer tu primera solicitud</div>
          </div>
        )}

        {anticipos.map((a) => {
          const est = ESTADOS[a.estado] || { label: a.estado, clase: 'pendiente' };
          const entregado = Number(a.monto_aprobado || 0);
          const saldo = entregado - Number(a.gastado || 0);

          return (
            <div className={`card card-${est.clase}`} key={a.id}>
              <div className="card-row">
                <div>
                  <div className="card-title">{pesos(a.monto_aprobado || a.monto_solicitado)}</div>
                  {a.destino && <div className="card-meta">{a.destino}</div>}
                  <div className="card-meta">
                    {new Date(a.creado_en).toLocaleDateString('es-CO', {
                      day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span className={`status status-${est.clase}`}>{est.label}</span>
              </div>

              <div className="card-meta" style={{ marginTop: 8 }}>{a.motivo}</div>

              {a.estado === 'aprobado' && entregado !== Number(a.monto_solicitado) && (
                <div className="card-meta" style={{ marginTop: 6 }}>
                  Pediste {pesos(a.monto_solicitado)} · aprobaron {pesos(entregado)}
                </div>
              )}

              {a.estado === 'solicitado' && (
                <div className="card-meta" style={{ marginTop: 8 }}>
                  Tu coordinador aún no ha respondido.
                </div>
              )}

              {a.estado === 'aprobado' && (
                <div className="card-meta" style={{ marginTop: 8 }}>
                  Aprobado. Cuando tu coordinador te entregue el dinero, aquí mismo
                  vas a poder ir subiendo los recibos.
                </div>
              )}

              {a.estado === 'legalizado' && (
                <div className="card-meta" style={{ marginTop: 8 }}>
                  Este anticipo ya quedó cerrado.
                </div>
              )}

              {a.estado === 'rechazado' && a.motivo_rechazo && (
                <div className="card-meta" style={{ marginTop: 6 }}>
                  Motivo: {a.motivo_rechazo}
                </div>
              )}

              {/* ---- soportes ---- */}
              {(a.estado === 'pagado' || a.estado === 'legalizado') && (
                <>
                  <div className="card-meta" style={{ marginTop: 12, fontWeight: 700 }}>
                    Gastos reportados: {pesos(a.gastado)} de {pesos(entregado)}
                    {saldo !== 0 && (
                      <> · {saldo > 0 ? `te sobran ${pesos(saldo)}` : `excedido ${pesos(-saldo)}`}</>
                    )}
                  </div>

                  {a.soportes.map((s) => (
                    <div className="card-row" key={s.id} style={{ paddingTop: 6 }}>
                      <div>
                        <div style={{ fontSize: 14 }}>{s.descripcion}</div>
                        {s.archivo_url && (
                          <a className="card-link" href={s.archivo_url} target="_blank" rel="noreferrer">
                            ver recibo
                          </a>
                        )}
                      </div>
                      <div style={{ fontWeight: 700 }}>{pesos(s.monto)}</div>
                    </div>
                  ))}

                  {a.estado === 'pagado' && a.soportes.length === 0 && (
                    <div className="card-meta">
                      Ve agregando cada gasto con su foto del recibo.
                    </div>
                  )}

                  {a.estado === 'pagado' && (
                    <form onSubmit={(e) => agregarSoporte(e, a.id)} style={{ marginTop: 10 }}>
                      <label style={{ marginTop: 0 }}>Agregar un gasto</label>
                      <input
                        placeholder="Ej: Peaje Río Frío"
                        value={sDescripcion}
                        onChange={(e) => setSDescripcion(e.target.value)}
                      />
                      <input
                        inputMode="numeric"
                        placeholder="Valor"
                        value={sMonto}
                        onChange={(e) => setSMonto(e.target.value.replace(/\D/g, ''))}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => setSArchivo(e.target.files[0] || null)}
                      />
                      <button className="btn btn-ghost btn-sm" disabled={subiendo}>
                        {subiendo ? 'Guardando…' : 'Agregar gasto'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          );
        })}

      </main>

      <BarraConductor activo="/conductor/anticipos" />
    </div>
  );
}
