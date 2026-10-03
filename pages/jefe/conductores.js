import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { llamarApiJefe } from '../../lib/apiJefe';
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

  // Codigo recien generado: se muestra una sola vez y no se puede recuperar.
  const [codigoNuevo, setCodigoNuevo] = useState(null);

  useEffect(() => { verificarAcceso(); }, []);

  async function verificarAcceso() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user || localStorage.getItem('hurgo_rol') !== 'jefe') {
      router.replace('/login');
      return;
    }
    cargar();
  }

  async function cargar() {
    const { ok, datos } = await llamarApiJefe('/api/jefe/conductores');
    if (!ok) { setError(datos.error || ''); return; }
    setConductores(datos.conductores || []);
  }

  async function registrar(e) {
    e.preventDefault();
    setError('');
    const placaLimpia = normalizarPlaca(placa);
    if (!nombre.trim()) { setError('Escribe el nombre del conductor.'); return; }
    if (placaLimpia.length < 5) { setError('Ingresa la placa completa del vehículo.'); return; }

    setCargando(true);
    const { ok, datos } = await llamarApiJefe('/api/jefe/conductores', {
      method: 'POST',
      body: JSON.stringify({ nombre: nombre.trim(), placa: placaLimpia, cedula, celular }),
    });
    setCargando(false);

    if (!ok) { setError(datos.error || 'No se pudo registrar.'); return; }

    setNombre(''); setPlaca(''); setCedula(''); setCelular('');
    setMostrarForm(false);
    setCodigoNuevo({ placa: datos.placa, codigo: datos.codigo, expira: datos.expira });
    cargar();
  }

  async function accionSobre(placaObjetivo, accion, confirmacion) {
    if (confirmacion && !window.confirm(confirmacion)) return;
    const { ok, datos } = await llamarApiJefe('/api/jefe/conductores', {
      method: 'PATCH',
      body: JSON.stringify({ placa: placaObjetivo, accion }),
    });
    if (!ok) { alert(datos.error || 'No se pudo completar la acción.'); return; }
    if (datos.codigo) {
      setCodigoNuevo({ placa: placaObjetivo, codigo: datos.codigo, expira: datos.expira });
    }
    cargar();
  }

  async function eliminarConductor(placaEliminar, nombreEliminar) {
    const confirmado = window.confirm(
      `¿Eliminar a ${nombreEliminar} (${formatearPlaca(placaEliminar)}) del registro?\n\nEsto no borra los contratos que ya se le enviaron, solo lo quita de la lista de conductores.`
    );
    if (!confirmado) return;
    const { ok, datos } = await llamarApiJefe('/api/jefe/conductores', {
      method: 'DELETE',
      body: JSON.stringify({ placa: placaEliminar }),
    });
    if (!ok) { alert(datos.error || 'No se pudo eliminar.'); return; }
    cargar();
  }

  // ---------------------------------------------------- Código generado
  if (codigoNuevo) {
    const vence = new Date(codigoNuevo.expira).toLocaleString('es-CO', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    });
    return (
      <div className="dashboard-bg panel-admin">
        <AppHeader />
        <main className="page">
          <h1 className="page-title">Código de ingreso</h1>
          <p className="page-sub">
            Entrégaselo a {formatearPlaca(codigoNuevo.placa)} en persona o por WhatsApp.
          </p>

          <div className="card" style={{ textAlign: 'center', padding: '28px 16px' }}>
            <div className="card-meta">Código de un solo uso</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 44, fontWeight: 800,
              letterSpacing: '8px', margin: '14px 0',
            }}>
              {codigoNuevo.codigo}
            </div>
            <div className="card-meta">Vence el {vence}</div>
          </div>

          <div style={{
            background: '#FFF6E0', border: '1px solid #E8B44A', borderRadius: 14,
            padding: '14px 16px', color: '#7A4E00', fontSize: 14, lineHeight: 1.5,
            textAlign: 'left', marginTop: 10,
          }}>
            <strong>Anótalo o mándalo ahora.</strong> Este código no se vuelve a mostrar:
            en el sistema solo queda guardado de forma cifrada. Si se pierde, genera uno nuevo.
          </div>

          <button
            className="btn btn-ghost"
            onClick={() => navigator.clipboard?.writeText(codigoNuevo.codigo)}
          >
            Copiar código
          </button>
          <button className="btn btn-stamp" onClick={() => setCodigoNuevo(null)}>
            Listo, ya lo entregué
          </button>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------- Formulario
  if (mostrarForm) {
    return (
      <div className="dashboard-bg panel-admin">
        <AppHeader />
        <main className="page">
          <button className="back-link" onClick={() => setMostrarForm(false)}>← Cancelar</button>
          <h1 className="page-title">Registrar conductor</h1>
          <p className="page-sub">Al guardar se genera un código de ingreso para entregarle.</p>
          <form onSubmit={registrar}>
            <label style={{ marginTop: 0 }}>Nombre del conductor</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Carlos Restrepo" />

            <label>Placa del vehículo</label>
            <input value={placa} onChange={(e) => setPlaca(e.target.value)}
              placeholder="Ej: ABC123"
              style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', fontWeight: 700 }}
              maxLength={8} />

            <label>Cédula</label>
            <input value={cedula} onChange={(e) => setCedula(e.target.value)}
              placeholder="Ej: 1083012966" inputMode="numeric" />

            <label>Celular</label>
            <input value={celular} onChange={(e) => setCelular(e.target.value)}
              placeholder="Ej: 3001234567" type="tel" />

            {error && <div className="error">{error}</div>}
            <button className="btn btn-stamp" disabled={cargando}>
              {cargando ? 'Guardando...' : 'Registrar y generar código'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------- Lista
  const pendientes = conductores.filter((c) => !c.aprobado);
  const aprobados = conductores.filter((c) => c.aprobado);

  return (
    <div className="dashboard-bg panel-admin">
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/jefe')}>← Volver a contratos</button>
        <h1 className="page-title">Conductores registrados</h1>
        <p className="page-sub">Todos los conductores y vehículos que tienes registrados.</p>

        <JefeTabs activo="/jefe/conductores" />

        {error && <div className="error">{error}</div>}

        {pendientes.length > 0 && (
          <>
            <div style={{
              background: '#FFF6E0',
              border: '1px solid #E8B44A',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 10,
            }}>
              <div style={{ color: '#7A4E00', fontWeight: 800, fontSize: 15 }}>
                {pendientes.length} solicitud{pendientes.length > 1 ? 'es' : ''} por confirmar
              </div>
              <div style={{ color: '#8A6520', fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>
                Estas personas se registraron solas. Confirma que de verdad manejan ese vehículo
                antes de aprobarlas.
              </div>
            </div>

            {pendientes.map((c) => (
              <div className="card" key={c.placa} style={{ borderLeft: '3px solid #f5a524' }}>
                <span className="plate-badge">{formatearPlaca(c.placa)}</span>
                <div className="card-title" style={{ marginTop: 8 }}>{c.nombre}</div>
                <div className="card-meta">
                  {c.cedula && `C.C. ${c.cedula}`}{c.cedula && c.celular && ' · '}{c.celular}
                </div>
                <div className="card-meta" style={{ marginTop: 4 }}>
                  Solicitó el {new Date(c.creado_en).toLocaleString('es-CO')}
                  {c.solicitudIp && ` · IP ${c.solicitudIp}`}
                </div>
                <div className="card-meta">
                  {c.enrolado ? '✅ Ya registró huella o PIN' : '⏳ Aún no se enrola'}
                </div>

                <div className="card-foot" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <button className="btn btn-stamp btn-sm"
                    onClick={() => accionSobre(c.placa, 'aprobar',
                      `¿Confirmas que ${c.nombre} maneja el vehículo ${formatearPlaca(c.placa)}?`)}>
                    Aprobar
                  </button>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => accionSobre(c.placa, 'rechazar',
                      `¿Rechazar la solicitud de ${c.nombre}?\n\nSe borra el registro y la placa queda libre. Queda constancia en Actividad.`)}>
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {conductores.length === 0 && (
          <div className="empty">
            <div className="empty-title">Aún no hay conductores registrados</div>
            <div className="empty-sub">Toca + para agregar el primero</div>
          </div>
        )}

        {aprobados.map((c) => {
          const bloqueado = c.bloqueadoHasta && new Date(c.bloqueadoHasta) > new Date();
          return (
            <div className="card" key={c.placa} style={!c.activo ? { opacity: 0.55 } : undefined}>
              <div className="card-row">
                <div>
                  <span className="plate-badge">{formatearPlaca(c.placa)}</span>
                  <div className="card-title" style={{ marginTop: 8 }}>{c.nombre}</div>
                  <div className="card-meta">
                    {c.cedula && `C.C. ${c.cedula}`}{c.cedula && c.celular && ' · '}{c.celular}
                  </div>
                  <div className="card-meta" style={{ marginTop: 6 }}>
                    {!c.activo && '⛔ Desactivado · '}
                    {c.enrolado ? '✅ Enrolado' : c.codigoPendiente ? '⏳ Código pendiente' : '⚠️ Sin enrolar'}
                    {c.dispositivos > 0 && ` · ${c.dispositivos} dispositivo(s)`}
                    {bloqueado && ' · 🔒 Bloqueado por intentos'}
                  </div>
                </div>
              </div>

              <div className="card-foot" style={{ flexWrap: 'wrap', gap: 6 }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => accionSobre(c.placa, 'codigo')}>
                  Generar código
                </button>

                {c.dispositivos > 0 && (
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => accionSobre(c.placa, 'revocar_dispositivos',
                      `¿Desvincular los celulares de ${c.nombre}?\n\nVa a necesitar un código nuevo para volver a entrar.`)}>
                    Desvincular celulares
                  </button>
                )}

                <button className="btn btn-ghost btn-sm"
                  onClick={() => accionSobre(c.placa, c.activo ? 'desactivar' : 'activar',
                    c.activo ? `¿Desactivar el acceso de ${c.nombre}?` : null)}>
                  {c.activo ? 'Desactivar' : 'Reactivar'}
                </button>

                <button className="btn btn-danger btn-sm"
                  onClick={() => eliminarConductor(c.placa, c.nombre)}>
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}

        <button className="fab" onClick={() => setMostrarForm(true)} title="Registrar conductor">+</button>
      </main>
    </div>
  );
}
