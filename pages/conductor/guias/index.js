import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppHeader from '../../../components/AppHeader';
import GuiaTarjeta from '../../../components/GuiaTarjeta';
import { llamarApiConductor } from '../../../lib/apiConductor';
import { ESTADOS_FINALES, nombreRuta } from '../../../lib/guias';

const CLAVE_RUTA = 'hurgo_ruta_actual';

const FORM_VACIO = {
  remitente_nombre: '', remitente_telefono: '', origen_direccion: '',
  destinatario_nombre: '', destinatario_telefono: '', destino_direccion: '',
  contenido: '', unidades: '1', peso_kg: '', valor_declarado: '', observaciones: '',
};

export default function GuiasConductor() {
  const router = useRouter();
  const [guias, setGuias] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [rutaActual, setRutaActual] = useState('');
  const [carga, setCarga] = useState('cargando'); // cargando | listo | bloqueado | error
  const [mensaje, setMensaje] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('hurgo_rol') !== 'conductor' || !localStorage.getItem('hurgo_placa')) {
      router.replace('/login');
      return;
    }
    setRutaActual(localStorage.getItem(CLAVE_RUTA) || '');
    cargar();
  }, []);

  async function cargar() {
    const [respGuias, respRutas] = await Promise.all([
      llamarApiConductor('/api/conductor/guias'),
      llamarApiConductor('/api/conductor/rutas'),
    ]);
    const { ok, status, datos } = respGuias;
    if (ok) {
      setGuias(datos.guias || []);
      const lista = respRutas.ok ? respRutas.datos.rutas || [] : [];
      setRutas(lista);
      // Si la ruta guardada ya no está activa, se olvida.
      const guardada = localStorage.getItem(CLAVE_RUTA);
      if (guardada && !lista.some((r) => r.id === guardada)) {
        localStorage.removeItem(CLAVE_RUTA);
        setRutaActual('');
      }
      setCarga('listo');
      return;
    }
    if (status === 401) { router.replace('/login'); return; }
    setMensaje(datos.error || 'No se pudieron cargar tus guías.');
    setCarga(status === 403 ? 'bloqueado' : 'error');
  }

  function cambiarRuta(id) {
    setRutaActual(id);
    if (id) localStorage.setItem(CLAVE_RUTA, id);
    else localStorage.removeItem(CLAVE_RUTA);
  }

  function campo(nombre) {
    return {
      id: `f-${nombre}`,
      value: form[nombre],
      onChange: (e) => setForm((f) => ({ ...f, [nombre]: e.target.value })),
    };
  }

  async function crear(e) {
    e.preventDefault();
    setError('');
    if (!rutaActual) {
      setError('Selecciona la ruta en la que vas.');
      return;
    }
    setEnviando(true);
    const { ok, datos } = await llamarApiConductor('/api/conductor/guias', {
      method: 'POST',
      body: JSON.stringify({ ...form, ruta_id: rutaActual }),
    });
    setEnviando(false);
    if (!ok) {
      setError(datos.error || 'No se pudo crear la guía.');
      return;
    }
    setForm(FORM_VACIO);
    router.push(`/conductor/guias/${datos.numero}?nueva=1`);
  }

  if (mostrarForm) {
    return (
      <div className="dashboard-bg">
        <AppHeader />
        <main className="page">
          <button className="back-link" onClick={() => setMostrarForm(false)}>← Cancelar</button>
          <h1 className="page-title">Nueva guía</h1>
          <p className="page-sub">Al guardarla se genera el número de guía y queda visible para coordinación.</p>

          <form onSubmit={crear}>
            <fieldset className="form-seccion">
              <legend>Ruta</legend>
              {rutas.length === 0 ? (
                <div className="error error-claro">Coordinación aún no ha creado rutas. Pídeles que agreguen la tuya.</div>
              ) : (
                <>
                  <label htmlFor="f-ruta">¿En qué ruta vas?</label>
                  <select id="f-ruta" value={rutaActual} onChange={(e) => cambiarRuta(e.target.value)}>
                    <option value="">Selecciona tu ruta…</option>
                    {rutas.map((r) => <option key={r.id} value={r.id}>{nombreRuta(r)}</option>)}
                  </select>
                </>
              )}
            </fieldset>

            <fieldset className="form-seccion">
              <legend>Quién envía</legend>
              <label htmlFor="f-remitente_nombre">Nombre o empresa</label>
              <input {...campo('remitente_nombre')} placeholder="Ej: Distribuidora El Rodadero" maxLength={120} />
              <label htmlFor="f-remitente_telefono">Celular (opcional)</label>
              <input {...campo('remitente_telefono')} type="tel" inputMode="tel" placeholder="Ej: 3001234567" maxLength={20} />
              <label htmlFor="f-origen_direccion">Dirección de recogida (opcional)</label>
              <input {...campo('origen_direccion')} placeholder="Ej: Cra 5 # 20-15" maxLength={200} />
            </fieldset>

            <fieldset className="form-seccion">
              <legend>Quién recibe</legend>
              <label htmlFor="f-destinatario_nombre">Nombre</label>
              <input {...campo('destinatario_nombre')} placeholder="Ej: Laura Gómez" maxLength={120} />
              <label htmlFor="f-destinatario_telefono">Celular</label>
              <input {...campo('destinatario_telefono')} type="tel" inputMode="tel" placeholder="Ej: 3109876543" maxLength={20} />
              <label htmlFor="f-destino_direccion">Dirección de entrega</label>
              <input {...campo('destino_direccion')} placeholder="Ej: Calle 72 # 45-10, apto 302" maxLength={200} />
            </fieldset>

            <fieldset className="form-seccion">
              <legend>Qué se envía</legend>
              <label htmlFor="f-contenido">Contenido</label>
              <input {...campo('contenido')} placeholder="Ej: 3 cajas de repuestos" maxLength={200} />
              <div className="form-fila">
                <div>
                  <label htmlFor="f-unidades">Unidades</label>
                  <input {...campo('unidades')} type="number" min="1" step="1" inputMode="numeric" />
                </div>
                <div>
                  <label htmlFor="f-peso_kg">Peso kg (opcional)</label>
                  <input {...campo('peso_kg')} type="number" min="0" step="0.1" inputMode="decimal" placeholder="Ej: 12.5" />
                </div>
              </div>
              <label htmlFor="f-valor_declarado">Valor declarado en pesos (opcional)</label>
              <input {...campo('valor_declarado')} inputMode="numeric" placeholder="Ej: 250000" maxLength={14} />
              <label htmlFor="f-observaciones">Observaciones (opcional)</label>
              <textarea {...campo('observaciones')} rows={3} style={{ minHeight: 80 }} maxLength={500}
                placeholder="Ej: Frágil, entregar en portería" />
            </fieldset>

            {error && <div className="error error-claro" role="alert">{error}</div>}
            <button className="btn btn-stamp" disabled={enviando || rutas.length === 0}>
              {enviando ? 'Creando guía…' : 'Crear guía'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  const visibles = rutaActual ? guias.filter((g) => g.ruta_id === rutaActual) : guias;
  const activas = visibles.filter((g) => !ESTADOS_FINALES.includes(g.estado)).length;
  const entregadas = visibles.filter((g) => g.estado === 'entregada').length;
  const rutaElegida = rutas.find((r) => r.id === rutaActual);

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/conductor')}>← Volver a mis contratos</button>
        <h1 className="page-title">Mis guías</h1>
        <p className="page-sub">Crea una guía por cada envío que cargues y márcala: recogiendo, en camino y entregado.</p>

        {carga === 'cargando' && <p className="page-sub">Cargando guías…</p>}

        {(carga === 'bloqueado' || carga === 'error') && (
          <div className="empty">
            <div className="empty-title">{carga === 'bloqueado' ? 'Guías no disponibles' : 'No se pudieron cargar'}</div>
            <div className="empty-sub">{mensaje}</div>
            {carga === 'error' && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={cargar}>Intentar de nuevo</button>
            )}
          </div>
        )}

        {carga === 'listo' && (
          <>
            <div className="ruta-actual">
              <label htmlFor="ruta-actual">Ruta actual</label>
              <select id="ruta-actual" value={rutaActual} onChange={(e) => cambiarRuta(e.target.value)}>
                <option value="">Todas mis rutas</option>
                {rutas.map((r) => <option key={r.id} value={r.id}>{nombreRuta(r)}</option>)}
              </select>
              {rutaElegida && (
                <div className="ruta-elegida">
                  {rutaElegida.origen_ciudad}<span aria-hidden="true">›</span>{rutaElegida.destino_ciudad}
                </div>
              )}
            </div>

            <div className="stat-row">
              <div className="stat-chip stat-chip-navy"><div className="num">{visibles.length}</div><div className="lbl">Total</div></div>
              <div className="stat-chip stat-chip-amber"><div className="num">{activas}</div><div className="lbl">En curso</div></div>
              <div className="stat-chip stat-chip-green"><div className="num">{entregadas}</div><div className="lbl">Entregadas</div></div>
            </div>

            {visibles.length === 0 && (
              <div className="empty">
                <div className="empty-title">{rutaActual ? 'Sin guías en esta ruta' : 'Aún no has creado guías'}</div>
                <div className="empty-sub">Toca + para crear una guía</div>
              </div>
            )}

            {visibles.map((g) => (
              <GuiaTarjeta key={g.numero} guia={g} href={`/conductor/guias/${g.numero}`} />
            ))}

            <button className="fab" onClick={() => setMostrarForm(true)} title="Nueva guía" aria-label="Nueva guía">+</button>
          </>
        )}
      </main>
    </div>
  );
}
