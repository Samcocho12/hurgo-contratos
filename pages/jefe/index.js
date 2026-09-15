import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import AppHeader from '../../components/AppHeader';
import JefeTabs from '../../components/JefeTabs';
import { normalizarPlaca, formatearPlaca } from '../../lib/placa';

const ESTADO_LABEL = { pendiente: 'Pendiente', visto: 'Visto', firmado: 'Firmado', rechazado: 'Rechazado' };

export default function JefeDashboard() {
  const router = useRouter();
  const [contratos, setContratos] = useState([]);
  const [conductores, setConductores] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [placaSeleccionada, setPlacaSeleccionada] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [anexos, setAnexos] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
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
    cargarTodo();
  }

  async function cargarTodo() {
    const [{ data: dataContratos }, { data: dataConductores }] = await Promise.all([
      supabase.from('contratos').select('*').order('creado_en', { ascending: false }),
      supabase.from('conductores').select('*').order('nombre', { ascending: true }),
    ]);
    setContratos(dataContratos || []);
    setConductores(dataConductores || []);
  }

  async function enviarContrato(e) {
    e.preventDefault();
    setError('');
    if (!titulo.trim() || !placaSeleccionada || !archivo) {
      setError('Completa el título, selecciona el conductor y sube el PDF del contrato.');
      return;
    }
    if (archivo.type !== 'application/pdf') {
      setError('El archivo debe ser un PDF.');
      return;
    }
    const conductor = conductores.find((c) => c.placa === placaSeleccionada);
    if (!conductor) {
      setError('Selecciona un conductor válido de la lista.');
      return;
    }
    setCargando(true);

    const rutaArchivo = `${Date.now()}-${archivo.name.replace(/\s+/g, '-')}`;
    const { error: uploadError } = await supabase.storage
      .from('contratos-originales')
      .upload(rutaArchivo, archivo, { contentType: 'application/pdf' });

    if (uploadError) {
      setCargando(false);
      setError('No se pudo subir el PDF: ' + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('contratos-originales')
      .getPublicUrl(rutaArchivo);

    const { data: contratoCreado, error: insertError } = await supabase
      .from('contratos')
      .insert({
        titulo: titulo.trim(),
        conductor_nombre: conductor.nombre,
        conductor_placa: conductor.placa,
        contrato_original_url: urlData.publicUrl,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (insertError) {
      setCargando(false);
      setError('No se pudo enviar el contrato: ' + insertError.message);
      return;
    }

    // Sube los anexos opcionales (si el coordinador adjuntó alguno)
    for (const anexo of anexos) {
      const rutaAnexo = `anexos/${Date.now()}-${anexo.name.replace(/\s+/g, '-')}`;
      const { error: anexoUploadError } = await supabase.storage
        .from('contratos-originales')
        .upload(rutaAnexo, anexo, { contentType: 'application/pdf' });
      if (anexoUploadError) continue; // si falla uno, sigue con los demás
      const { data: anexoUrlData } = supabase.storage
        .from('contratos-originales')
        .getPublicUrl(rutaAnexo);
      await supabase.from('contrato_anexos').insert({
        contrato_id: contratoCreado.id,
        url: anexoUrlData.publicUrl,
        nombre: anexo.name,
      });
    }

    setCargando(false);
    setTitulo(''); setPlacaSeleccionada(''); setArchivo(null); setAnexos([]);
    setMostrarForm(false);
    cargarTodo();
  }

  function salir() {
    supabase.auth.signOut();
    localStorage.removeItem('hurgo_rol');
    router.push('/login');
  }

  const activos = contratos.filter((c) => c.estado !== 'firmado');
  const pendientes = contratos.filter((c) => c.estado === 'pendiente' || c.estado === 'visto').length;
  const firmados = contratos.filter((c) => c.estado === 'firmado').length;
  const contratosFiltrados = busquedaPlaca.trim()
    ? activos.filter((c) => normalizarPlaca(c.conductor_placa).includes(normalizarPlaca(busquedaPlaca)))
    : activos;

  if (mostrarForm) {
    return (
      <div className="dashboard-bg">
        <AppHeader />
        <main className="page">
          <button className="back-link" onClick={() => setMostrarForm(false)}>← Cancelar</button>
          <h1 className="page-title">Nuevo contrato</h1>
          <p className="page-sub">Selecciona el conductor y sube el PDF del contrato.</p>

          {conductores.length === 0 ? (
            <div className="empty">
              <div className="empty-title">No tienes conductores registrados</div>
              <div className="empty-sub">Regístralo primero en la pestaña Conductores</div>
              <Link href="/jefe/conductores" className="btn btn-primary" style={{ marginTop: 16 }}>
                Registrar conductor
              </Link>
            </div>
          ) : (
            <form onSubmit={enviarContrato}>
              <label style={{ marginTop: 0 }}>Título del contrato</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Contrato de servicio - Ruta X" />

              <label>Conductor</label>
              <select value={placaSeleccionada} onChange={(e) => setPlacaSeleccionada(e.target.value)}>
                <option value="">Selecciona un conductor...</option>
                {conductores.map((c) => (
                  <option key={c.placa} value={c.placa}>
                    {c.nombre} — {formatearPlaca(c.placa)}
                  </option>
                ))}
              </select>

              <label>PDF del contrato (se firma este)</label>
              <input type="file" accept="application/pdf"
                onChange={(e) => setArchivo(e.target.files[0] || null)} />

              <label>Anexos (opcional, no se firman)</label>
              <input type="file" accept="application/pdf" multiple
                onChange={(e) => setAnexos(Array.from(e.target.files || []))} />
              {anexos.length > 0 && (
                <div className="card-meta" style={{ marginTop: -10, marginBottom: 16 }}>
                  {anexos.length} anexo{anexos.length > 1 ? 's' : ''} seleccionado{anexos.length > 1 ? 's' : ''}: {anexos.map((a) => a.name).join(', ')}
                </div>
              )}

              {error && <div className="error">{error}</div>}
              <button className="btn btn-stamp" disabled={cargando}>
                {cargando ? 'Enviando...' : 'Enviar al conductor'}
              </button>
            </form>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <h1 className="page-title">Contratos enviados</h1>
        <p className="page-sub">Gestiona los contratos que has enviado a tus conductores.</p>

        <JefeTabs activo="/jefe" />

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

        {activos.length === 0 && (
          <div className="empty">
            <div className="empty-title">No tienes contratos por firmar</div>
            <div className="empty-sub">Toca + para enviar uno nuevo</div>
          </div>
        )}

        {activos.length > 0 && (
          <input
            type="text"
            placeholder="Buscar por placa..."
            value={busquedaPlaca}
            onChange={(e) => setBusquedaPlaca(e.target.value)}
            style={{ marginBottom: 16, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}
          />
        )}

        {contratosFiltrados.map((c) => (
          <div className={`card card-${c.estado}`} key={c.id}>
            <div className="card-row">
              <div>
                <span className="plate-badge">{formatearPlaca(c.conductor_placa)}</span>
                <div className="card-title" style={{ marginTop: 8 }}>{c.titulo}</div>
                <div className="card-meta">
                  {c.conductor_nombre} · {new Date(c.creado_en).toLocaleDateString('es-CO')}
                </div>
              </div>
              <span className={`status status-${c.estado}`}>{ESTADO_LABEL[c.estado]}</span>
            </div>
          </div>
        ))}

        <button className="fab" onClick={() => setMostrarForm(true)} title="Nuevo contrato">+</button>
        <div className="exit-row">
          <button className="link-btn" onClick={salir}>Cambiar de usuario</button>
        </div>
      </main>
    </div>
  );
}
