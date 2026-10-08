import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { llamarApiJefe } from '../../lib/apiJefe';
import PanelLayout from '../../components/PanelLayout';
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
    const { ok, datos } = await llamarApiJefe('/api/jefe/contratos?vista=firmados');
    if (!ok) return;
    setContratos(datos.contratos || []);
    setGuiasPorContrato(datos.guiasPorContrato || {});
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
    const { ok, datos } = await llamarApiJefe('/api/jefe/contratos', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (!ok) {
      alert(datos.error || 'No se pudo eliminar.');
      return;
    }
    cargar();
  }

  return (
    <PanelLayout
      activo="/jefe/firmados"
      titulo="Contratos firmados"
      descripcion="Archivo de contratos ya firmados por tus conductores."
    >
      <button className="back-link solo-movil" onClick={() => router.push('/jefe/contratos')}>← Volver a contratos</button>

        {contratos.length === 0 && (
          <div className="empty">
            <div className="empty-title">Aún no hay contratos firmados</div>
            <div className="empty-sub">Aparecerán aquí en cuanto un conductor firme</div>
          </div>
        )}

        {contratos.length > 0 && (
          <div className="panel-filtros">
            <input
              type="text"
              placeholder="Buscar por placa..."
              value={busquedaPlaca}
              onChange={(e) => setBusquedaPlaca(e.target.value)}
              style={{ marginBottom: 16, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}
            />
          </div>
        )}

        {/* ---------- escritorio: tabla ---------- */}
        <div className="solo-escritorio">
          {contratosFiltrados.length > 0 && (
            <div className="tabla-caja">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Placa</th><th>Documento</th><th>Conductor</th>
                    <th>Firmado</th><th className="td-fin">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {contratosFiltrados.map((c) => (
                    <tr key={c.id}>
                      <td><span className="plate-badge">{formatearPlaca(c.conductor_placa)}</span></td>
                      <td className="td-doc">{c.titulo}</td>
                      <td>{c.conductor_nombre}</td>
                      <td className="td-suave">
                        {c.firmado_en ? new Date(c.firmado_en).toLocaleDateString('es-CO', {
                          day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="td-fin">
                        <div className="fila-acciones">
                          {c.pdf_firmado_url && (
                            <a className="btn btn-ghost btn-sm" href={c.pdf_firmado_url}
                               target="_blank" rel="noreferrer">Ver PDF</a>
                          )}
                          <BotonGuias contratoId={c.id} total={guiasPorContrato[c.id]} />
                          <button className="btn btn-danger btn-sm"
                            onClick={() => eliminarContrato(c.id, c.titulo)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="solo-movil">

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
        </div>
    </PanelLayout>
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
