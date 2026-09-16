import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import AppHeader from '../../components/AppHeader';
import { formatearPlaca } from '../../lib/placa';

const ESTADO_LABEL = { pendiente: 'Pendiente', visto: 'Visto', firmado: 'Firmado', rechazado: 'Rechazado' };

export default function ConductorDashboard() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [placa, setPlaca] = useState('');
  const [contratos, setContratos] = useState([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    const rol = localStorage.getItem('hurgo_rol');
    const nombreGuardado = localStorage.getItem('hurgo_nombre');
    const placaGuardada = localStorage.getItem('hurgo_placa');
    if (rol !== 'conductor' || !placaGuardada) { router.replace('/login'); return; }
    setNombre(nombreGuardado || '');
    setPlaca(placaGuardada);
    cargar(placaGuardada);
  }, []);

  async function cargar(placaConductor) {
    const { data } = await supabase
      .from('contratos')
      .select('*')
      .eq('conductor_placa', placaConductor)
      .order('creado_en', { ascending: false });
    setContratos(data || []);
    setCargado(true);
  }

  function salir() {
    localStorage.removeItem('hurgo_rol');
    localStorage.removeItem('hurgo_nombre');
    localStorage.removeItem('hurgo_placa');
    router.push('/login');
  }

  const pendientes = contratos.filter((c) => c.estado === 'pendiente' || c.estado === 'visto').length;
  const firmados = contratos.filter((c) => c.estado === 'firmado').length;

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <div className="card-row" style={{ alignItems: 'center', marginBottom: 4 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Hola, {nombre.split(' ')[0] || 'conductor'}</h1>
          <span className="plate-badge">{formatearPlaca(placa)}</span>
        </div>
        <p className="page-sub">Tu buzón de contratos. Tócalos para leer y firmar.</p>

        <div className="stat-row">
          <div className="stat-chip stat-chip-navy">
            <div className="num">{contratos.length}</div>
            <div className="lbl">Total</div>
          </div>
          <div className="stat-chip stat-chip-amber">
            <div className="num">{pendientes}</div>
            <div className="lbl">Por firmar</div>
          </div>
          <div className="stat-chip stat-chip-green">
            <div className="num">{firmados}</div>
            <div className="lbl">Firmados</div>
          </div>
        </div>

        {cargado && (firmados > 0 ? (
          <Link href="/conductor/guias" className="guias-acceso">
            <span>
              <span className="guias-acceso-titulo">Mis guías de envío</span>
              <span className="guias-acceso-sub">Marca el estado de las guías que te asignaron</span>
            </span>
            <span className="guias-acceso-flecha" aria-hidden="true">›</span>
          </Link>
        ) : (
          <div className="guias-acceso guias-acceso-bloqueado">
            <span>
              <span className="guias-acceso-titulo">Guías de envío</span>
              <span className="guias-acceso-sub">Se activan cuando firmes tu contrato.</span>
            </span>
          </div>
        ))}

        {contratos.length === 0 && (
          <div className="empty">
            <div className="empty-title">No tienes contratos pendientes</div>
            <div className="empty-sub">Aquí aparecerán cuando te los envíen</div>
          </div>
        )}

        {contratos.map((c) => (
          <Link href={`/conductor/contrato/${c.id}`} key={c.id} className="card-link">
            <div className={`card card-${c.estado}`}>
              {c.estado === 'firmado' && <div className="stamp-mark">Firmado</div>}
              <div className="card-row">
                <div>
                  <div className="card-title">{c.titulo}</div>
                  <div className="card-meta">{new Date(c.creado_en).toLocaleDateString('es-CO')}</div>
                </div>
                <span className={`status status-${c.estado}`}>{ESTADO_LABEL[c.estado]}</span>
              </div>
            </div>
          </Link>
        ))}

        <div className="exit-row">
          <button className="link-btn" onClick={salir}>Cambiar de usuario</button>
        </div>
      </main>
    </div>
  );
}
