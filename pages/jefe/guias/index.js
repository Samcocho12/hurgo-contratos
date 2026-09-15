import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';
import AppHeader from '../../../components/AppHeader';
import JefeTabs from '../../../components/JefeTabs';
import GuiaTarjeta from '../../../components/GuiaTarjeta';
import { nombreRuta } from '../../../lib/guias';

const FILTROS = [
  { id: 'todas', label: 'Todas', cumple: () => true },
  { id: 'nuevas', label: 'Nuevas', cumple: (g) => g.estado === 'creada' },
  { id: 'recogiendo', label: 'Recogiendo', cumple: (g) => g.estado === 'recogiendo' },
  { id: 'camino', label: 'En camino', cumple: (g) => g.estado === 'en_camino' },
  { id: 'entregadas', label: 'Entregadas', cumple: (g) => g.estado === 'entregada' },
  { id: 'canceladas', label: 'Canceladas', cumple: (g) => g.estado === 'cancelada' },
];

export default function GuiasJefe() {
  const router = useRouter();
  const [guias, setGuias] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [rutaFiltro, setRutaFiltro] = useState('');
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    verificarAcceso();
  }, []);

  async function verificarAcceso() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user || localStorage.getItem('hurgo_rol') !== 'jefe') {
      router.replace('/login');
      return;
    }
    cargar();
  }

  async function cargar() {
    setError('');
    const [{ data, error: err }, { data: dataRutas }] = await Promise.all([
      supabase
        .from('guias')
        .select('numero, estado, ruta_id, conductor_placa, conductor_nombre, origen_ciudad, destino_ciudad, destinatario_nombre, creado_en, actualizado_en')
        .order('actualizado_en', { ascending: false })
        .limit(500),
      supabase.from('rutas').select('id, nombre, origen_ciudad, destino_ciudad').order('origen_ciudad'),
    ]);
    setRutas(dataRutas || []);
    if (err) setError('No se pudieron cargar las guías: ' + err.message);
    setGuias(data || []);
    setCargado(true);
  }

  const q = busqueda.trim().toUpperCase();
  const qCompacto = q.replace(/[^A-Z0-9]/g, '');
  const filtroActual = FILTROS.find((f) => f.id === filtro);
  const visibles = guias.filter((g) => {
    if (!filtroActual.cumple(g)) return false;
    if (rutaFiltro && g.ruta_id !== rutaFiltro) return false;
    if (!q) return true;
    return (
      (qCompacto && g.numero.includes(qCompacto)) ||
      (qCompacto && (g.conductor_placa || '').includes(qCompacto)) ||
      (g.destinatario_nombre || '').toUpperCase().includes(q) ||
      (g.destino_ciudad || '').toUpperCase().includes(q)
    );
  });

  const nuevas = guias.filter(FILTROS[1].cumple).length;
  const camino = guias.filter((g) => g.estado === 'recogiendo' || g.estado === 'en_camino').length;
  const entregadas = guias.filter(FILTROS[4].cumple).length;

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <h1 className="page-title">Guías de envío</h1>
        <p className="page-sub">Las guías que crean los conductores llegan aquí. Toca una para ver el detalle.</p>

        <JefeTabs activo="/jefe/guias" />

        <div className="stat-row">
          <div className="stat-chip stat-chip-navy"><div className="num">{nuevas}</div><div className="lbl">Nuevas</div></div>
          <div className="stat-chip stat-chip-amber"><div className="num">{camino}</div><div className="lbl">En camino</div></div>
          <div className="stat-chip stat-chip-green"><div className="num">{entregadas}</div><div className="lbl">Entregadas</div></div>
        </div>

        {error && <div className="empty"><div className="empty-sub">{error}</div></div>}

        {cargado && !error && guias.length === 0 && (
          <div className="empty">
            <div className="empty-title">Todavía no hay guías</div>
            <div className="empty-sub">Primero crea las rutas en la pestaña Rutas. Luego los conductores con contrato firmado podrán crear guías.</div>
          </div>
        )}

        {guias.length > 0 && (
          <>
            <input
              type="search"
              placeholder="Buscar por guía, placa, destinatario o ciudad"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar guías"
              style={{ marginBottom: 12 }}
            />
            {rutas.length > 0 && (
              <select value={rutaFiltro} onChange={(e) => setRutaFiltro(e.target.value)}
                aria-label="Filtrar por ruta" style={{ marginBottom: 12 }}>
                <option value="">Todas las rutas</option>
                {rutas.map((r) => <option key={r.id} value={r.id}>{nombreRuta(r)}</option>)}
              </select>
            )}
            <div className="filtros" role="group" aria-label="Filtrar por estado">
              {FILTROS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filtro === f.id}
                  className={`filtro${filtro === f.id ? ' filtro-activo' : ''}`} onClick={() => setFiltro(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>

            {visibles.length === 0 && (
              <div className="empty"><div className="empty-sub">Ninguna guía coincide con la búsqueda.</div></div>
            )}
            {visibles.map((g) => (
              <GuiaTarjeta key={g.numero} guia={g} href={`/jefe/guias/${g.numero}`} mostrarPlaca />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
