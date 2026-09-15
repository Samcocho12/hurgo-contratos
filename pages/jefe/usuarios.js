import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import AppHeader from '../../components/AppHeader';
import JefeTabs from '../../components/JefeTabs';

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
      <div className="dashboard-bg">
        <AppHeader />
        <main className="page">
          <button className="back-link" onClick={() => setMostrarForm(false)}>← Cancelar</button>
          <h1 className="page-title">Nuevo coordinador</h1>
          <p className="page-sub">Crea un acceso adicional con los mismos permisos.</p>
          <form onSubmit={crearUsuario}>
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
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/jefe')}>← Volver a contratos</button>
        <h1 className="page-title">Usuarios coordinadores</h1>
        <p className="page-sub">Quiénes tienen acceso para enviar y gestionar contratos.</p>

        <JefeTabs activo="/jefe/usuarios" />

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
      </main>
    </div>
  );
}
