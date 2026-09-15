import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import AppHeader from '../../components/AppHeader';
import JefeTabs from '../../components/JefeTabs';
import { normalizarPlaca, formatearPlaca } from '../../lib/placa';

export default function ConductoresRegistrados() {
  const router = useRouter();
  const [conductores, setConductores] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [placa, setPlaca] = useState('');
  const [cedula, setCedula] = useState('');
  const [celular, setCelular] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

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
    const { data } = await supabase
      .from('conductores')
      .select('*')
      .order('creado_en', { ascending: false });
    setConductores(data || []);
  }

  async function registrar(e) {
    e.preventDefault();
    setError('');
    const placaLimpia = normalizarPlaca(placa);
    if (!nombre.trim()) { setError('Escribe el nombre del conductor.'); return; }
    if (placaLimpia.length < 5) { setError('Ingresa la placa completa del vehículo.'); return; }

    setCargando(true);
    const { error: upsertError } = await supabase
      .from('conductores')
      .upsert({
        placa: placaLimpia,
        nombre: nombre.trim(),
        cedula: cedula.trim() || null,
        celular: celular.trim() || null,
      });
    setCargando(false);

    if (upsertError) {
      setError('No se pudo registrar: ' + upsertError.message);
      return;
    }
    setNombre(''); setPlaca(''); setCedula(''); setCelular('');
    setMostrarForm(false);
    cargar();
  }

  async function eliminarConductor(placaEliminar, nombreEliminar) {
    const confirmado = window.confirm(
      `¿Eliminar a ${nombreEliminar} (${formatearPlaca(placaEliminar)}) del registro?\n\nEsto no borra los contratos que ya se le enviaron, solo lo quita de la lista de conductores.`
    );
    if (!confirmado) return;
    const { error: deleteError } = await supabase.from('conductores').delete().eq('placa', placaEliminar);
    if (deleteError) {
      alert('No se pudo eliminar: ' + deleteError.message);
      return;
    }
    cargar();
  }

  if (mostrarForm) {
    return (
      <div className="dashboard-bg">
        <AppHeader />
        <main className="page">
          <button className="back-link" onClick={() => setMostrarForm(false)}>← Cancelar</button>
          <h1 className="page-title">Registrar conductor</h1>
          <p className="page-sub">Agrega un conductor y su vehículo al registro.</p>
          <form onSubmit={registrar}>
            <label style={{ marginTop: 0 }}>Nombre del conductor</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Carlos Restrepo" />

            <label>Placa del vehículo</label>
            <input value={placa} onChange={(e) => setPlaca(e.target.value)}
              placeholder="Ej: ABC123"
              style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', fontWeight: 700 }}
              maxLength={8} />

            <label>Cédula (opcional)</label>
            <input value={cedula} onChange={(e) => setCedula(e.target.value)}
              placeholder="Ej: 1083012966" inputMode="numeric" />

            <label>Celular (opcional)</label>
            <input value={celular} onChange={(e) => setCelular(e.target.value)}
              placeholder="Ej: 3001234567" type="tel" />

            {error && <div className="error">{error}</div>}
            <button className="btn btn-stamp" disabled={cargando}>
              {cargando ? 'Guardando...' : 'Registrar'}
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
        <button className="back-link" onClick={() => router.push('/jefe')}>← Volver a contratos</button>
        <h1 className="page-title">Conductores registrados</h1>
        <p className="page-sub">Todos los conductores y vehículos que tienes registrados.</p>

        <JefeTabs activo="/jefe/conductores" />

        {conductores.length === 0 && (
          <div className="empty">
            <div className="empty-title">Aún no hay conductores registrados</div>
            <div className="empty-sub">Toca + para agregar el primero</div>
          </div>
        )}

        {conductores.map((c) => (
          <div className="card" key={c.placa}>
            <div className="card-row">
              <div>
                <span className="plate-badge">{formatearPlaca(c.placa)}</span>
                <div className="card-title" style={{ marginTop: 8 }}>{c.nombre}</div>
                <div className="card-meta">
                  {c.cedula && `C.C. ${c.cedula}`}{c.cedula && c.celular && ' · '}{c.celular && c.celular}
                </div>
                <div className="card-meta">Registrado el {new Date(c.creado_en).toLocaleDateString('es-CO')}</div>
              </div>
            </div>
            <div className="card-foot">
              <button className="btn btn-danger btn-sm" onClick={() => eliminarConductor(c.placa, c.nombre)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <button className="fab" onClick={() => setMostrarForm(true)} title="Registrar conductor">+</button>
      </main>
    </div>
  );
}
