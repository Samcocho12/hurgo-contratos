import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppHeader from '../../../components/AppHeader';
import GuiaTarjeta from '../../../components/GuiaTarjeta';
import { llamarApiConductor } from '../../../lib/apiConductor';
import { ESTADOS_FINALES, formatearFecha } from '../../../lib/guias';

// La ruta actual es el id del contrato firmado en el que va el conductor.
const CLAVE_RUTA = 'hurgo_ruta_actual';

export default function GuiasConductor() {
  const router = useRouter();
  const [guias, setGuias] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [rutaActual, setRutaActual] = useState('');
  const [verCerradas, setVerCerradas] = useState(false);
  const [carga, setCarga] = useState('cargando'); // cargando | listo | bloqueado | error
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (localStorage.getItem('hurgo_rol') !== 'conductor' || !localStorage.getItem('hurgo_placa')) {
      router.replace('/login');
      return;
    }
    cargar();
  }, []);

  async function cargar() {
    setCarga('cargando');
    const [respGuias, respRutas] = await Promise.all([
      llamarApiConductor('/api/conductor/guias'),
      llamarApiConductor('/api/conductor/rutas'),
    ]);
    const { ok, status, datos } = respGuias;
    if (!ok) {
      if (status === 401) { router.replace('/login'); return; }
      setMensaje(datos.error || 'No se pudieron cargar tus guías.');
      setCarga(status === 403 ? 'bloqueado' : 'error');
      return;
    }
    const lista = respRutas.ok ? respRutas.datos.rutas || [] : [];
    setGuias(datos.guias || []);
    setRutas(lista);

    // Ruta actual: la guardada si sigue siendo válida; si solo tiene un contrato, ese.
    const guardada = localStorage.getItem(CLAVE_RUTA);
    let elegida = lista.some((r) => r.id === guardada) ? guardada : '';
    if (!elegida && lista.length === 1) elegida = lista[0].id;
    cambiarRuta(elegida);
    setCarga('listo');
  }

  function cambiarRuta(id) {
    setRutaActual(id);
    if (id) localStorage.setItem(CLAVE_RUTA, id);
    else localStorage.removeItem(CLAVE_RUTA);
  }

  const rutaElegida = rutas.find((r) => r.id === rutaActual);
  const deLaRuta = rutaActual ? guias.filter((g) => g.contrato_id === rutaActual) : guias;
  const pendientes = deLaRuta.filter((g) => !ESTADOS_FINALES.includes(g.estado));
  const cerradas = deLaRuta.filter((g) => ESTADOS_FINALES.includes(g.estado));
  const entregadas = deLaRuta.filter((g) => g.estado === 'entregada').length;
  const visibles = verCerradas ? cerradas : pendientes;

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/conductor')}>← Volver a mis contratos</button>
        <h1 className="page-title">Mis guías</h1>
        <p className="page-sub">Coordinación te asigna las guías. Tú marcas: recogiendo, en camino y entregado.</p>

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
              {rutas.length > 1 ? (
                <>
                  <label htmlFor="ruta-actual">Ruta actual</label>
                  <select id="ruta-actual" value={rutaActual} onChange={(e) => cambiarRuta(e.target.value)}>
                    <option value="">Todas mis rutas</option>
                    {rutas.map((r) => <option key={r.id} value={r.id}>{r.titulo}</option>)}
                  </select>
                </>
              ) : (
                <label>Ruta actual</label>
              )}
              {rutaElegida && (
                <div className="ruta-elegida">
                  {rutaElegida.titulo}
                  <div className="ruta-elegida-meta">Contrato firmado el {formatearFecha(rutaElegida.firmado_en, false)}</div>
                </div>
              )}
            </div>

            <div className="stat-row">
              <div className="stat-chip stat-chip-amber"><div className="num">{pendientes.length}</div><div className="lbl">Por entregar</div></div>
              <div className="stat-chip stat-chip-green"><div className="num">{entregadas}</div><div className="lbl">Entregadas</div></div>
              <div className="stat-chip stat-chip-navy"><div className="num">{deLaRuta.length}</div><div className="lbl">Total</div></div>
            </div>

            <div className="filtros" role="group" aria-label="Ver guías">
              <button type="button" aria-pressed={!verCerradas}
                className={`filtro${!verCerradas ? ' filtro-activo' : ''}`} onClick={() => setVerCerradas(false)}>
                Por entregar ({pendientes.length})
              </button>
              <button type="button" aria-pressed={verCerradas}
                className={`filtro${verCerradas ? ' filtro-activo' : ''}`} onClick={() => setVerCerradas(true)}>
                Terminadas ({cerradas.length})
              </button>
              <button type="button" className="filtro" onClick={cargar}>Actualizar</button>
            </div>

            {visibles.length === 0 && (
              <div className="empty">
                <div className="empty-title">
                  {verCerradas ? 'Aún no tienes guías terminadas' : 'No tienes guías pendientes'}
                </div>
                {!verCerradas && (
                  <div className="empty-sub">Cuando coordinación te asigne una guía, aparecerá aquí.</div>
                )}
              </div>
            )}

            {visibles.map((g) => (
              <GuiaTarjeta key={g.numero} guia={g} href={`/conductor/guias/${g.numero}`} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
