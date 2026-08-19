import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

const ESTADO_LABEL = { pendiente: 'Pendiente', visto: 'Visto', firmado: 'Firmado', rechazado: 'Rechazado' };

export default function JefeDashboard() {
  const router = useRouter();
  const [contratos, setContratos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [conductorNombre, setConductorNombre] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('hurgo_rol') !== 'jefe') { router.replace('/login'); return; }
    cargarContratos();
  }, []);

  async function cargarContratos() {
    const { data } = await supabase
      .from('contratos')
      .select('*')
      .order('creado_en', { ascending: false });
    setContratos(data || []);
  }

  async function enviarContrato(e) {
    e.preventDefault();
    setError('');
    if (!titulo.trim() || !conductorNombre.trim() || !archivo) {
      setError('Completa el título, el nombre del conductor y sube el PDF del contrato.');
      return;
    }
    if (archivo.type !== 'application/pdf') {
      setError('El archivo debe ser un PDF.');
      return;
    }
    setCargando(true);

    // Sube el PDF original al bucket público de contratos-originales
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

    const { error: insertError } = await supabase.from('contratos').insert({
      titulo: titulo.trim(),
      conductor_nombre: conductorNombre.trim(),
      contrato_original_url: urlData.publicUrl,
      estado: 'pendiente',
    });

    setCargando(false);
    if (insertError) {
      setError('No se pudo enviar el contrato: ' + insertError.message);
      return;
    }
    setTitulo(''); setConductorNombre(''); setArchivo(null);
    setMostrarForm(false);
    cargarContratos();
  }

  function salir() {
    localStorage.removeItem('hurgo_rol');
    router.push('/login');
  }

  if (mostrarForm) {
    return (
      <main className="page">
        <button className="back-link" onClick={() => setMostrarForm(false)}>← Cancelar</button>
        <h1 className="page-title">Nuevo contrato</h1>
        <p className="page-sub">Sube el PDF del contrato y escribe el nombre del conductor.</p>
        <form onSubmit={enviarContrato}>
          <label>Título del contrato</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Contrato de servicio - Ruta X" />

          <label>Nombre del conductor</label>
          <input value={conductorNombre} onChange={(e) => setConductorNombre(e.target.value)}
            placeholder="Ej: Carlos Restrepo" />

          <label>PDF del contrato</label>
          <input type="file" accept="application/pdf"
            onChange={(e) => setArchivo(e.target.files[0] || null)} />

          {error && <div className="error">{error}</div>}
          <button className="btn btn-stamp" disabled={cargando}>
            {cargando ? 'Enviando...' : 'Enviar al conductor'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="topbar-inline">
        <h1 className="page-title">Contratos enviados</h1>
        <p className="page-sub">Gestiona los contratos que has enviado a tus conductores.</p>
      </div>

      {contratos.length === 0 && (
        <div className="empty">
          <div className="empty-title">Aún no has enviado contratos</div>
          <div className="empty-sub">Toca + para crear el primero</div>
        </div>
      )}

      {contratos.map((c) => (
        <div className="card" key={c.id}>
          {c.estado === 'firmado' && <div className="stamp-mark">Firmado</div>}
          <div className="card-row">
            <div>
              <div className="card-title">{c.titulo}</div>
              <div className="card-meta">
                {c.conductor_nombre} · {new Date(c.creado_en).toLocaleDateString('es-CO')}
              </div>
            </div>
            <span className={`status status-${c.estado}`}>{ESTADO_LABEL[c.estado]}</span>
          </div>
          {c.pdf_firmado_url && (
            <div className="card-foot" style={{ marginTop: 10 }}>
              <a className="btn btn-ghost btn-sm" href={c.pdf_firmado_url} target="_blank" rel="noreferrer">
                Ver PDF firmado
              </a>
            </div>
          )}
        </div>
      ))}

      <button className="fab" onClick={() => setMostrarForm(true)} title="Nuevo contrato">+</button>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button className="link-btn" onClick={salir}>Cambiar de usuario</button>
      </div>
    </main>
  );
}
