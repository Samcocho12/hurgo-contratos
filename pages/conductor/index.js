import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const ESTADO_LABEL = { pendiente: 'Pendiente', visto: 'Visto', firmado: 'Firmado', rechazado: 'Rechazado' };

export default function ConductorDashboard() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [contratos, setContratos] = useState([]);

  useEffect(() => {
    const rol = localStorage.getItem('hurgo_rol');
    const nombreGuardado = localStorage.getItem('hurgo_nombre');
    if (rol !== 'conductor' || !nombreGuardado) { router.replace('/login'); return; }
    setNombre(nombreGuardado);
    cargar(nombreGuardado);
  }, []);

  async function cargar(nombreConductor) {
    const { data } = await supabase
      .from('contratos')
      .select('*')
      .eq('conductor_nombre', nombreConductor)
      .order('creado_en', { ascending: false });
    setContratos(data || []);
  }

  function salir() {
    localStorage.removeItem('hurgo_rol');
    localStorage.removeItem('hurgo_nombre');
    router.push('/login');
  }

  return (
    <main className="page">
      <h1 className="page-title">Hola, {nombre.split(' ')[0] || 'conductor'}</h1>
      <p className="page-sub">Estos son tus contratos. Tócalos para leer y firmar.</p>

      {contratos.length === 0 && (
        <div className="empty">
          <div className="empty-title">No tienes contratos pendientes</div>
          <div className="empty-sub">Aquí aparecerán cuando te los envíen</div>
        </div>
      )}

      {contratos.map((c) => (
        <Link href={`/conductor/contrato/${c.id}`} key={c.id} className="card-link">
          <div className="card">
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

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button className="link-btn" onClick={salir}>Cambiar de usuario</button>
      </div>
    </main>
  );
}
