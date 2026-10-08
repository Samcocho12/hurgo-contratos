import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import PanelLayout from '../../components/PanelLayout';

export default function UsuariosCoordinadores() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    verificarAcceso();
  }, []);

  async function verificarAcceso() {
    const { data } = await supabase.auth.getSession();
    if (!data?.session || localStorage.getItem('hurgo_rol') !== 'jefe') {
      router.replace('/login');
      return;
    }
    setToken(data.session.access_token);
    cargar(data.session.access_token);
  }

  async function cargar(accessToken) {
    const resp = await fetch('/api/usuarios', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const resultado = await resp.json();
    if (resp.ok) setUsuarios(resultado.usuarios || []);
  }

  async function crearUsuario(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Completa el correo y la contraseña.');
      return;
    }
    setCargando(true);
    const resp = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const resultado = await resp.json();
    setCargando(false);
    if (!resp.ok) {
      setError(resultado.error || 'No se pudo crear el usuario.');
      return;
    }
    setEmail(''); setPassword('');
    setMostrarForm(false);
    cargar(token);
  }

  async function eliminarUsuario(id, correoEliminar) {
    const confirmado = window.confirm(`¿Eliminar el acceso de ${correoEliminar}? Ya no podrá iniciar sesión como coordinador.`);
    if (!confirmado) return;
    const resp = await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    const resultado = await resp.json();
    if (!resp.ok) {
      alert(resultado.error || 'No se pudo eliminar.');
      return;
    }
    cargar(token);
  }

  if (mostrarForm) {
    return (
      <PanelLayout
        activo="/jefe/usuarios"
        titulo="Nuevo coordinador"
        descripcion="Crea un acceso adicional con los mismos permisos."
        acciones={<button className="btn btn-ghost" onClick={() => setMostrarForm(false)}>Cancelar</button>}
      >
          <button className="back-link solo-movil" onClick={() => setMostrarForm(false)}>← Cancelar</button>
          <form onSubmit={crearUsuario} className="panel-form">
            <label style={{ marginTop: 0 }}>Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@hurgotransporte.com" />

            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres" />

            {error && <div className="error">{error}</div>}
            <button className="btn btn-stamp" disabled={cargando}>
              {cargando ? 'Creando...' : 'Crear acceso'}
            </button>
          </form>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout
      activo="/jefe/usuarios"
      titulo="Usuarios coordinadores"
      descripcion="Quiénes tienen acceso para enviar y gestionar contratos."
      acciones={<button className="btn btn-stamp" onClick={() => setMostrarForm(true)}>Nuevo coordinador</button>}
    >
      <button className="back-link solo-movil" onClick={() => router.push('/jefe/contratos')}>← Volver a contratos</button>

      {/* ---------- escritorio: tabla ---------- */}
      <div className="solo-escritorio">
        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr><th>Correo</th><th>Creado</th><th className="td-fin">Acciones</th></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="td-doc">
                    {u.email}
                    {u.esUsuarioActual && <span className="etiqueta-tu">tu cuenta</span>}
                  </td>
                  <td className="td-suave">
                    {new Date(u.creado_en).toLocaleDateString('es-CO', {
                      day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="td-fin">
                    {!u.esUsuarioActual && (
                      <button className="btn btn-danger btn-sm"
                        onClick={() => eliminarUsuario(u.id, u.email)}>Eliminar acceso</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="solo-movil">
        {usuarios.map((u) => (
          <div className="card" key={u.id}>
            <div className="card-row">
              <div>
                <div className="card-title">{u.email}</div>
                <div className="card-meta">
                  {u.esUsuarioActual ? 'Esta es tu cuenta' : `Creado el ${new Date(u.creado_en).toLocaleDateString('es-CO')}`}
                </div>
              </div>
            </div>
            {!u.esUsuarioActual && (
              <div className="card-foot">
                <button className="btn btn-danger btn-sm" onClick={() => eliminarUsuario(u.id, u.email)}>
                  Eliminar acceso
                </button>
              </div>
            )}
          </div>
        ))}

        <button className="fab" onClick={() => setMostrarForm(true)} title="Nuevo coordinador">+</button>
      </div>
    </PanelLayout>
  );
}
