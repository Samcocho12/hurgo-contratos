import { useState } from 'react';
import { useRouter } from 'next/router';
import { normalizarPlaca } from '../lib/placa';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [nombreConductor, setNombreConductor] = useState('');
  const [placaConductor, setPlacaConductor] = useState('');
  const [error, setError] = useState('');
  const [cargandoConductor, setCargandoConductor] = useState(false);

  // paso 2: registro (solo la primera vez que se ve esa placa)
  const [pedirRegistro, setPedirRegistro] = useState(false);
  const [cedula, setCedula] = useState('');
  const [celular, setCelular] = useState('');
  const [errorRegistro, setErrorRegistro] = useState('');

  const [mostrarCoordLogin, setMostrarCoordLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorCoord, setErrorCoord] = useState('');
  const [cargandoCoord, setCargandoCoord] = useState(false);

  function entrarYRedirigir(placaLimpia) {
    localStorage.setItem('hurgo_rol', 'conductor');
    localStorage.setItem('hurgo_nombre', nombreConductor.trim());
    localStorage.setItem('hurgo_placa', placaLimpia);
    router.push('/conductor');
  }

  async function continuarComoConductor(e) {
    e.preventDefault();
    setError('');
    const placaLimpia = normalizarPlaca(placaConductor);
    if (!nombreConductor.trim()) {
      setError('Escribe tu nombre para continuar.');
      return;
    }
    if (placaLimpia.length < 5) {
      setError('Ingresa la placa completa del vehículo.');
      return;
    }

    setCargandoConductor(true);
    const { data: existente } = await supabase
      .from('conductores')
      .select('placa')
      .eq('placa', placaLimpia)
      .maybeSingle();
    setCargandoConductor(false);

    if (existente) {
      // ya estaba registrado: solo actualiza el nombre por si cambió, y entra directo
      await supabase.from('conductores').update({ nombre: nombreConductor.trim() }).eq('placa', placaLimpia);
      entrarYRedirigir(placaLimpia);
    } else {
      // primera vez con esta placa: pide cédula y celular para completar el registro
      setPedirRegistro(true);
    }
  }

  async function completarRegistro(e) {
    e.preventDefault();
    setErrorRegistro('');
    if (!cedula.trim()) {
      setErrorRegistro('Ingresa tu número de cédula.');
      return;
    }
    if (!celular.trim()) {
      setErrorRegistro('Ingresa tu número de celular.');
      return;
    }
    const placaLimpia = normalizarPlaca(placaConductor);
    setCargandoConductor(true);
    const { error: upsertError } = await supabase.from('conductores').upsert({
      placa: placaLimpia,
      nombre: nombreConductor.trim(),
      cedula: cedula.trim(),
      celular: celular.trim(),
    });
    setCargandoConductor(false);
    if (upsertError) {
      setErrorRegistro('No se pudo completar el registro: ' + upsertError.message);
      return;
    }
    entrarYRedirigir(placaLimpia);
  }

  async function entrarComoJefe(e) {
    e.preventDefault();
    setErrorCoord('');
    if (!email.trim() || !password) {
      setErrorCoord('Ingresa tu correo y contraseña.');
      return;
    }
    setCargandoCoord(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setCargandoCoord(false);
    if (authError) {
      setErrorCoord('Correo o contraseña incorrectos.');
      return;
    }
    localStorage.setItem('hurgo_rol', 'jefe');
    localStorage.removeItem('hurgo_nombre');
    localStorage.removeItem('hurgo_placa');
    router.push('/jefe');
  }

  if (mostrarCoordLogin) {
    return (
      <div className="login-screen">
        <div className="login-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Hurgo Transporte Logística" className="login-logo" />
          <h1>Acceso coordinador</h1>
          <p>Ingresa con tu correo y contraseña</p>

          <div className="login-form">
            <form onSubmit={entrarComoJefe}>
              <label style={{ marginTop: 0 }}>Correo</label>
              <input
                type="email"
                placeholder="coordinador@hurgotransporte.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label>Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {errorCoord && <div className="error">{errorCoord}</div>}
              <button className="btn btn-primary" disabled={cargandoCoord}>
                {cargandoCoord ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>

          <div className="login-coord-access">
            <button className="link-btn" onClick={() => setMostrarCoordLogin(false)}>← Volver al ingreso de conductor</button>
          </div>
        </div>
      </div>
    );
  }

  if (pedirRegistro) {
    return (
      <div className="login-screen">
        <div className="login-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Hurgo Transporte Logística" className="login-logo" />
          <h1>Completa tu registro</h1>
          <p>Como es tu primera vez con la placa {formatearMostrar(placaConductor)}, necesitamos estos datos.</p>

          <div className="login-form">
            <form onSubmit={completarRegistro}>
              <label style={{ marginTop: 0 }}>Número de cédula</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej: 1083012966"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
              />

              <label>Número de celular</label>
              <input
                type="tel"
                placeholder="Ej: 3001234567"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
              />

              {errorRegistro && <div className="error">{errorRegistro}</div>}
              <button className="btn btn-stamp" disabled={cargandoConductor}>
                {cargandoConductor ? 'Guardando...' : 'Terminar registro y continuar'}
              </button>
            </form>
          </div>

          <div className="login-coord-access">
            <button className="link-btn" onClick={() => setPedirRegistro(false)}>← Volver</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Hurgo Transporte Logística" className="login-logo" />
        <h1>Ingreso de conductor</h1>
        <p>Escribe tu nombre y la placa de tu vehículo</p>

        <div className="login-form">
          <form onSubmit={continuarComoConductor}>
            <label style={{ marginTop: 0 }}>Tu nombre</label>
            <input
              type="text"
              placeholder="Ej: Carlos Restrepo"
              value={nombreConductor}
              onChange={(e) => setNombreConductor(e.target.value)}
            />

            <label>Placa del vehículo</label>
            <input
              type="text"
              placeholder="Ej: ABC123"
              value={placaConductor}
              onChange={(e) => setPlacaConductor(e.target.value)}
              style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', fontWeight: 700 }}
              maxLength={8}
            />

            {error && <div className="error">{error}</div>}
            <button className="btn btn-stamp" disabled={cargandoConductor}>
              {cargandoConductor ? 'Verificando...' : 'Ver mis contratos'}
            </button>
          </form>
        </div>

        <div className="login-coord-access">
          <button className="link-btn" onClick={() => router.push('/instalar')}>¿Cómo agrego esta app a mi celular?</button>
        </div>
        <div className="login-coord-access" style={{ marginTop: 8, paddingTop: 0, borderTop: 'none' }}>
          <button className="link-btn" onClick={() => setMostrarCoordLogin(true)}>Acceso coordinador</button>
        </div>
      </div>
    </div>
  );
}

function formatearMostrar(valor) {
  return normalizarPlaca(valor || '');
}
