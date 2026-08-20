import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import AppHeader from '../../components/AppHeader';
import { normalizarPlaca, formatearPlaca } from '../../lib/placa';

export default function ContratosFirmados() {
  const router = useRouter();
  const [contratos, setContratos] = useState([]);
  const [busquedaPlaca, setBusquedaPlaca] = useState('');

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
      .from('contratos')
      .select('*')
      .eq('estado', 'firmado')
      .order('firmado_en', { ascending: false });
    setContratos(data || []);
  }

  const contratosFiltrados = busquedaPlaca.trim()
    ? contratos.filter((c) => normalizarPlaca(c.conductor_placa).includes(normalizarPlaca(busquedaPlaca)))
    : contratos;

  async function eliminarContrato(id, titulo) {
    const confirmado = window.confirm(`¿Eliminar el contrato "${titulo}" del archivo? Esta acción no se puede deshacer.`);
    if (!confirmado) return;
    const { error: deleteError } = await supabase.from('contratos').delete().eq('id', id);
    if (deleteError) {
      alert('No se pudo eliminar: ' + deleteError.message);
      return;
    }
    cargar();
  }

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/jefe')}>← Volver a contratos</button>
        <h1 className="page-title">Contratos firmados</h1>
        <p className="page-sub">Archivo de contratos ya firmados por tus conductores.</p>

        <div className="tab-row">
          <span className="tab-item" onClick={() => router.push('/jefe')}>Contratos</span>
          <span className="tab-item" onClick={() => router.push('/jefe/conductores')}>Conductores</span>
          <span className="tab-item tab-active">Firmados</span>
          <span className="tab-item" onClick={() => router.push('/jefe/usuarios')}>Usuarios</span>
        </div>

        {contratos.length === 0 && (
          <div className="empty">
            <div className="empty-title">Aún no hay contratos firmados</div>
            <div className="empty-sub">Aparecerán aquí en cuanto un conductor firme</div>
          </div>
        )}

        {contratos.length > 0 && (
          <input
            type="text"
            placeholder="Buscar por placa..."
            value={busquedaPlaca}
            onChange={(e) => setBusquedaPlaca(e.target.value)}
            style={{ marginBottom: 16, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}
          />
        )}

        {contratosFiltrados.map((c) => (
          <div className="card card-firmado" key={c.id}>
            <div className="stamp-mark">Firmado</div>
            <div className="card-row">
              <div>
                <span className="plate-badge">{formatearPlaca(c.conductor_placa)}</span>
                <div className="card-title" style={{ marginTop: 8 }}>{c.titulo}</div>
                <div className="card-meta">
                  {c.conductor_nombre} · firmado el {c.firmado_en ? new Date(c.firmado_en).toLocaleDateString('es-CO') : '—'}
                </div>
              </div>
            </div>
            {c.pdf_firmado_url && (
              <div className="card-foot">
                <a className="btn btn-ghost btn-sm" href={c.pdf_firmado_url} target="_blank" rel="noreferrer">
                  Ver PDF firmado
                </a>
                <button className="btn btn-danger btn-sm" onClick={() => eliminarContrato(c.id, c.titulo)}>
                  Eliminar
                </button>
              </div>
            )}
            {!c.pdf_firmado_url && (
              <div className="card-foot">
                <button className="btn btn-danger btn-sm" onClick={() => eliminarContrato(c.id, c.titulo)}>
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
