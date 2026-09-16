import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import AppHeader from '../../components/AppHeader';
import JefeTabs from '../../components/JefeTabs';
import { normalizarPlaca, formatearPlaca } from '../../lib/placa';

export default function ContratosFirmados() {
  const router = useRouter();
  const [contratos, setContratos] = useState([]);
  const [busquedaPlaca, setBusquedaPlaca] = useState('');
  const [guiasPorContrato, setGuiasPorContrato] = useState({});

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

    const { data: guias } = await supabase.from('guias').select('contrato_id').not('contrato_id', 'is', null);
    const conteo = {};
    for (const g of guias || []) conteo[g.contrato_id] = (conteo[g.contrato_id] || 0) + 1;
    setGuiasPorContrato(conteo);
  }

  const contratosFiltrados = busquedaPlaca.trim()
    ? contratos.filter((c) => normalizarPlaca(c.conductor_placa).includes(normalizarPlaca(busquedaPlaca)))
    : contratos;

  async function eliminarContrato(id, titulo) {
    const n = guiasPorContrato[id] || 0;
    const aviso = n
      ? `\n\nEste contrato es la ruta de ${n} guía${n > 1 ? 's' : ''}. Las guías se conservan, pero quedan sin contrato asociado.`
      : '';
    const confirmado = window.confirm(`¿Eliminar el contrato "${titulo}" del archivo? Esta acción no se puede deshacer.${aviso}`);
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

        <JefeTabs activo="/jefe/firmados" />

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
                <BotonGuias contratoId={c.id} total={guiasPorContrato[c.id]} />
                <button className="btn btn-danger btn-sm" onClick={() => eliminarContrato(c.id, c.titulo)}>
                  Eliminar
                </button>
              </div>
            )}
            {!c.pdf_firmado_url && (
              <div className="card-foot">
                <BotonGuias contratoId={c.id} total={guiasPorContrato[c.id]} />
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

function BotonGuias({ contratoId, total }) {
  return (
    <>
      <Link className="btn btn-ghost btn-sm" href={`/jefe/guias/nueva?contrato=${contratoId}`}>
        Crear guía
      </Link>
      {total ? (
        <Link className="btn btn-ghost btn-sm" href={`/jefe/guias?contrato=${contratoId}`}>
          Guías ({total})
        </Link>
      ) : null}
    </>
  );
}
