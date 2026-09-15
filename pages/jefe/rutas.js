import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import AppHeader from '../../components/AppHeader';
import JefeTabs from '../../components/JefeTabs';

export default function RutasJefe() {
  const router = useRouter();
  const [rutas, setRutas] = useState([]);
  const [conteo, setConteo] = useState({});
  const [cargado, setCargado] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

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
    const [{ data, error: err }, { data: guias }] = await Promise.all([
      supabase.from('rutas').select('*').order('activa', { ascending: false }).order('origen_ciudad'),
      supabase.from('guias').select('ruta_id, estado').not('ruta_id', 'is', null),
    ]);
    if (err) setError('No se pudieron cargar las rutas: ' + err.message);
    const c = {};
    for (const g of guias || []) {
      c[g.ruta_id] = c[g.ruta_id] || { total: 0, activas: 0 };
      c[g.ruta_id].total += 1;
      if (g.estado !== 'entregada' && g.estado !== 'cancelada') c[g.ruta_id].activas += 1;
    }
    setConteo(c);
    setRutas(data || []);
    setCargado(true);
  }

  async function crear(e) {
    e.preventDefault();
    setError('');
    if (!origen.trim() || !destino.trim()) {
      setError('Escribe la ciudad de origen y la de destino.');
      return;
    }
    setGuardando(true);
    const { error: err } = await supabase.from('rutas').insert({
      origen_ciudad: origen.trim(),
      destino_ciudad: destino.trim(),
      nombre: nombre.trim() || null,
    });
    setGuardando(false);
    if (err) {
      setError('No se pudo crear la ruta: ' + err.message);
      return;
    }
    setOrigen(''); setDestino(''); setNombre('');
    setMostrarForm(false);
    cargar();
  }

  async function cambiarActiva(ruta) {
    const { error: err } = await supabase.from('rutas').update({ activa: !ruta.activa }).eq('id', ruta.id);
    if (err) { alert('No se pudo actualizar: ' + err.message); return; }
    cargar();
  }

  async function eliminar(ruta) {
    const n = conteo[ruta.id]?.total || 0;
    const msg = n
      ? `Esta ruta tiene ${n} guía${n > 1 ? 's' : ''}. Si la eliminas, las guías se conservan pero quedan sin ruta asignada. Para dejar de usarla es mejor desactivarla.\n\n¿Eliminar de todas formas?`
      : '¿Eliminar esta ruta?';
    if (!window.confirm(msg)) return;
    const { error: err } = await supabase.from('rutas').delete().eq('id', ruta.id);
    if (err) { alert('No se pudo eliminar: ' + err.message); return; }
    cargar();
  }

  if (mostrarForm) {
    return (
      <div className="dashboard-bg">
        <AppHeader />
        <main className="page">
          <button className="back-link" onClick={() => setMostrarForm(false)}>← Cancelar</button>
          <h1 className="page-title">Nueva ruta</h1>
          <p className="page-sub">Los conductores la elegirán al crear sus guías.</p>
          <form onSubmit={crear}>
            <label htmlFor="r-origen">Ciudad de origen</label>
            <input id="r-origen" value={origen} onChange={(e) => setOrigen(e.target.value)}
              placeholder="Ej: Santa Marta" maxLength={80} />
            <label htmlFor="r-destino">Ciudad de destino</label>
            <input id="r-destino" value={destino} onChange={(e) => setDestino(e.target.value)}
              placeholder="Ej: Barranquilla" maxLength={80} />
            <label htmlFor="r-nombre">Nombre de la ruta (opcional)</label>
            <input id="r-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Ruta Costa 1" maxLength={60} />
            {error && <div className="error error-claro" role="alert">{error}</div>}
            <button className="btn btn-stamp" disabled={guardando}>
              {guardando ? 'Creando…' : 'Crear ruta'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <h1 className="page-title">Rutas</h1>
        <p className="page-sub">Los conductores eligen una de estas rutas al crear cada guía.</p>

        <JefeTabs activo="/jefe/rutas" />

        {error && <div className="empty"><div className="empty-sub">{error}</div></div>}

        {cargado && !error && rutas.length === 0 && (
          <div className="empty">
            <div className="empty-title">Aún no hay rutas</div>
            <div className="empty-sub">Toca + para crear la primera</div>
          </div>
        )}

        {rutas.map((r) => {
          const c = conteo[r.id] || { total: 0, activas: 0 };
          return (
            <div className={`card${r.activa ? '' : ' card-inactiva'}`} key={r.id}
              style={{ borderLeftColor: r.activa ? 'var(--amber)' : 'var(--line)' }}>
              <div className="card-row">
                <div>
                  <div className="card-title">
                    {r.origen_ciudad} <span style={{ color: 'var(--amber-deep)' }} aria-hidden="true">›</span> {r.destino_ciudad}
                  </div>
                  {r.nombre && <div className="card-meta">{r.nombre}</div>}
                  <div className="card-meta">
                    {c.activas} en curso, {c.total} en total
                  </div>
                </div>
                <span className={`status ${r.activa ? 'status-g-en_camino' : 'status-g-cancelada'}`}>
                  {r.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="card-foot">
                <button className="btn btn-ghost btn-sm" onClick={() => cambiarActiva(r)}>
                  {r.activa ? 'Desactivar' : 'Activar'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => eliminar(r)}>Eliminar</button>
              </div>
            </div>
          );
        })}

        <button className="fab" onClick={() => setMostrarForm(true)} title="Nueva ruta" aria-label="Nueva ruta">+</button>
      </main>
    </div>
  );
}
