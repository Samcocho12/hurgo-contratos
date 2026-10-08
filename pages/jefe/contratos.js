import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { llamarApiJefe, subirPdf } from '../../lib/apiJefe';
import PanelLayout from '../../components/PanelLayout';
import { normalizarPlaca, formatearPlaca } from '../../lib/placa';

const ESTADO_LABEL = { pendiente: 'Pendiente', visto: 'Visto', firmado: 'Firmado', rechazado: 'Rechazado' };

export default function Contratos() {
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
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => { verificarAcceso(); }, []);

  async function verificarAcceso() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user || localStorage.getItem('hurgo_rol') !== 'jefe') {
      router.replace('/login');
      return;
    }
    cargarTodo();
  }

  async function cargarTodo() {
    const { ok, datos } = await llamarApiJefe('/api/jefe/contratos?vista=activos');
    if (!ok) { setError(datos.error || 'No se pudieron cargar los contratos.'); return; }
    setContratos(datos.contratos || []);
    setConductores(datos.conductores || []);
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

    // El PDF sube directo al almacenamiento con un permiso firmado que
    // emite el servidor; el navegador ya no usa la llave de Supabase.
    const principal = await subirPdf(archivo);
    if (!principal.ok) {
      setCargando(false);
      setError(principal.error);
      return;
    }

    const anexosSubidos = [];
    for (const anexo of anexos) {
      const r = await subirPdf(anexo, 'anexos');
      if (r.ok) anexosSubidos.push({ ruta: r.ruta, nombre: anexo.name });
    }

    const { ok, datos } = await llamarApiJefe('/api/jefe/contratos', {
      method: 'POST',
      body: JSON.stringify({
        titulo: titulo.trim(),
        placa: conductor.placa,
        archivo: principal.ruta,
        anexos: anexosSubidos,
      }),
    });

    if (!ok) {
      setCargando(false);
      setError(datos.error || 'No se pudo enviar el contrato.');
      return;
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

  const texto = busqueda.trim().toLowerCase();
  const filtrados = texto
    ? activos.filter((c) =>
        normalizarPlaca(c.conductor_placa).includes(normalizarPlaca(busqueda)) ||
        (c.conductor_nombre || '').toLowerCase().includes(texto) ||
        (c.titulo || '').toLowerCase().includes(texto))
    : activos;

  // ------------------------------------------------ Formulario
  if (mostrarForm) {
    return (
      <PanelLayout
        activo="/jefe/contratos"
        titulo="Nuevo contrato"
        descripcion="Selecciona el conductor y sube el PDF que va a firmar."
        acciones={
          <button className="btn btn-ghost" onClick={() => setMostrarForm(false)}>Cancelar</button>
        }
      >
        <button className="back-link solo-movil" onClick={() => setMostrarForm(false)}>← Cancelar</button>

        {conductores.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Todavía no hay conductores registrados</div>
            <div className="empty-sub">Registra el primero para poder enviarle un contrato</div>
            <Link href="/jefe/conductores" className="btn btn-primary" style={{ marginTop: 16 }}>
              Registrar conductor
            </Link>
          </div>
        ) : (
          <form onSubmit={enviarContrato} className="panel-form">
            <label style={{ marginTop: 0 }}>Título del contrato</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Contrato de servicio - Ruta Santa Marta" />

            <label>Conductor</label>
            <select value={placaSeleccionada} onChange={(e) => setPlacaSeleccionada(e.target.value)}>
              <option value="">Selecciona un conductor…</option>
              {conductores.map((c) => (
                <option key={c.placa} value={c.placa}>
                  {c.nombre} — {formatearPlaca(c.placa)}
                </option>
              ))}
            </select>

            <label>PDF del contrato (es el que se firma)</label>
            <input type="file" accept="application/pdf"
              onChange={(e) => setArchivo(e.target.files[0] || null)} />

            <label>Anexos (opcional, no se firman)</label>
            <input type="file" accept="application/pdf" multiple
              onChange={(e) => setAnexos(Array.from(e.target.files || []))} />
            {anexos.length > 0 && (
              <div className="card-meta" style={{ marginTop: -10, marginBottom: 16 }}>
                {anexos.length} anexo{anexos.length > 1 ? 's' : ''}: {anexos.map((a) => a.name).join(', ')}
              </div>
            )}

            {error && <div className="error">{error}</div>}
            <button className="btn btn-stamp" disabled={cargando}>
              {cargando ? 'Enviando…' : 'Enviar al conductor'}
            </button>
          </form>
        )}
      </PanelLayout>
    );
  }

  // ------------------------------------------------ Lista
  return (
    <PanelLayout
      activo="/jefe/contratos"
      titulo="Contratos enviados"
      descripcion="Contratos que esperan firma de tus conductores."
      acciones={
        <button className="btn btn-stamp" onClick={() => setMostrarForm(true)}>Nuevo contrato</button>
      }
    >
      {/* ---------- cifras ---------- */}
      <div className="cifras solo-escritorio">
        <div className="cifra">
          <span className="cifra-num">{contratos.length}</span>
          <span className="cifra-lbl">en total</span>
        </div>
        <div className="cifra cifra-amber">
          <span className="cifra-num">{pendientes}</span>
          <span className="cifra-lbl">por firmar</span>
        </div>
        <div className="cifra cifra-green">
          <span className="cifra-num">{firmados}</span>
          <span className="cifra-lbl">firmados</span>
        </div>
      </div>

      <div className="stat-row solo-movil">
        <div className="stat-chip stat-chip-navy">
          <div className="num">{contratos.length}</div><div className="lbl">Total</div>
        </div>
        <div className="stat-chip stat-chip-amber">
          <div className="num">{pendientes}</div><div className="lbl">Por firmar</div>
        </div>
        <div className="stat-chip stat-chip-green">
          <div className="num">{firmados}</div><div className="lbl">Firmados</div>
        </div>
      </div>

      {activos.length > 0 && (
        <div className="panel-filtros">
          <input
            type="text"
            placeholder="Buscar placa, conductor o documento"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      )}

      {/* ---------- escritorio: tabla ---------- */}
      <div className="solo-escritorio">
        <div className="tabla-caja">
          {filtrados.length === 0 ? (
            <div className="tabla-vacia">
              <strong>{activos.length === 0 ? 'No hay contratos por firmar' : 'Ningún contrato coincide'}</strong>
              {activos.length === 0 ? 'Envía uno nuevo con el botón de arriba' : 'Prueba con otra placa o nombre'}
            </div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Documento</th>
                  <th>Conductor</th>
                  <th>Enviado</th>
                  <th className="td-fin">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td><span className="plate-badge">{formatearPlaca(c.conductor_placa)}</span></td>
                    <td className="td-doc">{c.titulo}</td>
                    <td>{c.conductor_nombre}</td>
                    <td className="td-suave">
                      {new Date(c.creado_en).toLocaleDateString('es-CO', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="td-fin">
                      <span className={`status status-${c.estado}`}>{ESTADO_LABEL[c.estado]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ---------- celular: tarjetas, igual que siempre ---------- */}
      <div className="solo-movil">
        {activos.length === 0 && (
          <div className="empty">
            <div className="empty-title">No tienes contratos por firmar</div>
            <div className="empty-sub">Toca + para enviar uno nuevo</div>
          </div>
        )}

        {filtrados.map((c) => (
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
      </div>
    </PanelLayout>
  );
}
