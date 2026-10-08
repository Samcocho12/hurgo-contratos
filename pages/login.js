import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { normalizarPlaca, formatearPlaca } from '../lib/placa';
import { supabase } from '../lib/supabaseClient';
import { llamarApiConductor } from '../lib/apiConductor';
import { llamarApiJefe } from '../lib/apiJefe';
import { startAuthentication } from '@simplewebauthn/browser';

export default function Login() {
  const router = useRouter();
  const [nombreConductor, setNombreConductor] = useState('');
  const [placaConductor, setPlacaConductor] = useState('');
  const [error, setError] = useState('');
  const [cargandoConductor, setCargandoConductor] = useState(false);
  const [usandoHuella, setUsandoHuella] = useState(false);
  // La fila del código solo se muestra cuando de verdad hace falta:
  // placa ya activada en otro celular, o celular nuevo.
  const [ofrecerCodigo, setOfrecerCodigo] = useState(false);
  const [reconocido, setReconocido] = useState(null);   // {placa, nombre, tieneHuella}
  const [comprobando, setComprobando] = useState(true);

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
  // Segundo paso del coordinador en un computador nuevo
  const [pedirCodigo, setPedirCodigo] = useState(null);  // { factorId }
  const [codigo2fa, setCodigo2fa] = useState('');

  // /login?coordinador=1 abre directamente el acceso de coordinación
  useEffect(() => {
    if (router.isReady && router.query.coordinador) setMostrarCoordLogin(true);
  }, [router.isReady, router.query.coordinador]);

  // La identidad real vive en la cookie de sesion firmada que emite el
  // servidor. Lo de localStorage queda solo como preferencia de pantalla
  // (saludo, ultima placa); ya no da acceso a nada.
  function entrarYRedirigir(placaLimpia) {
    localStorage.setItem('hurgo_rol', 'conductor');
    localStorage.setItem('hurgo_nombre', nombreConductor.trim());
    localStorage.setItem('hurgo_placa', placaLimpia);
    router.push('/conductor');
  }

  // Al abrir: ¿este celular ya esta vinculado a un conductor?
  useEffect(() => {
    (async () => {
      const { ok, datos } = await llamarApiConductor('/api/auth/estado');
      setComprobando(false);
      if (!ok) return;

      if (datos.sesionActiva) {
        localStorage.setItem('hurgo_rol', 'conductor');
        localStorage.setItem('hurgo_placa', datos.placa);
        router.replace('/conductor');
        return;
      }
      if (datos.reconocido) setReconocido(datos);
    })();
  }, []);

  // Ingreso con huella o rostro. Abre sesion FUERTE (habilita firmar).
  async function entrarConHuella() {
    setError('');
    // Si el celular ya esta reconocido, la placa la pone el servidor.
    const placaLimpia = reconocido?.placa || normalizarPlaca(placaConductor);
    if (!reconocido && placaLimpia.length < 5) {
      setError('Escribe tu placa para usar la huella.');
      return;
    }

    setUsandoHuella(true);
    try {
      const r1 = await llamarApiConductor('/api/auth/passkey', {
        method: 'POST',
        body: JSON.stringify({ accion: 'login-opciones', placa: reconocido ? '' : placaLimpia }),
      });
      if (!r1.ok) {
        if (r1.datos?.sinPasskey) {
          setError('Esta placa aun no tiene huella registrada. Usa el codigo que te dio tu coordinador.');
        } else {
          setError(r1.datos?.error || 'No se pudo iniciar.');
        }
        setUsandoHuella(false);
        return;
      }

      const respuesta = await startAuthentication({ optionsJSON: r1.datos.opciones });

      const r2 = await llamarApiConductor('/api/auth/passkey', {
        method: 'POST',
        body: JSON.stringify({ accion: 'login-verificar', respuesta }),
      });
      setUsandoHuella(false);

      if (!r2.ok) { setError(r2.datos?.error || 'No se pudo verificar tu huella.'); return; }

      localStorage.setItem('hurgo_rol', 'conductor');
      localStorage.setItem('hurgo_placa', placaLimpia);
      if (r2.datos?.conductor?.nombre) {
        localStorage.setItem('hurgo_nombre', r2.datos.conductor.nombre);
      }
      router.push('/conductor');
    } catch (err) {
      setUsandoHuella(false);
      const msg = String(err?.message || '');
      setError(/NotAllowed|cancel/i.test(msg)
        ? 'Cancelaste la huella.'
        : 'Tu celular no pudo usar la huella. Intenta con tu nombre y placa.');
    }
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
    const { ok, status, datos } = await llamarApiConductor('/api/auth/ingresar', {
      method: 'POST',
      body: JSON.stringify({ placa: placaLimpia, nombre: nombreConductor.trim() }),
    });
    setCargandoConductor(false);

    if (ok) {
      entrarYRedirigir(placaLimpia);
      return;
    }
    if (status === 401) {
      // Primera vez con esta placa: pide cédula y celular.
      setPedirRegistro(true);
      return;
    }
    if (datos?.yaEnrolado) {
      // Ya tiene huella o PIN en otro celular: aquí sí necesita un código.
      setOfrecerCodigo(true);
      setError('Esta placa ya está activada en otro celular. Pídele un código a tu coordinador para usar este.');
      return;
    }
    setError(datos.error || 'No se pudo ingresar. Intenta de nuevo.');
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
    const { ok, datos } = await llamarApiConductor('/api/auth/registrar', {
      method: 'POST',
      body: JSON.stringify({
        placa: placaLimpia,
        nombre: nombreConductor.trim(),
        cedula: cedula.trim(),
        celular: celular.trim(),
      }),
    });
    setCargandoConductor(false);
    if (!ok) {
      setErrorRegistro(datos.error || 'No se pudo completar el registro.');
      return;
    }

    // Recien registrado: va DIRECTO a poner huella y PIN. Si entrara a sus
    // contratos sin eso, quedaria con el acceso mas debil del sistema.
    localStorage.setItem('hurgo_nombre', nombreConductor.trim());
    localStorage.setItem('hurgo_placa', placaLimpia);
    router.push('/enrolar?nuevo=1');
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
    if (authError) {
      setCargandoCoord(false);
      setErrorCoord('Correo o contraseña incorrectos.');
      return;
    }

    // ¿Tiene segundo paso configurado?
    const { data: factores } = await supabase.auth.mfa.listFactors();
    const totp = (factores?.totp || []).find((f) => f.status === 'verified');

    if (!totp) {
      setCargandoCoord(false);
      entrarAlPanel();
      return;
    }

    // Lo tiene: si este computador ya está confirmado, no se pide nada.
    const { ok } = await llamarApiJefe('/api/jefe/conductores');
    setCargandoCoord(false);

    if (ok) { entrarAlPanel(); return; }
    setPedirCodigo({ factorId: totp.id });
  }

  function entrarAlPanel() {
    localStorage.setItem('hurgo_rol', 'jefe');
    localStorage.removeItem('hurgo_nombre');
    localStorage.removeItem('hurgo_placa');
    router.push('/jefe');
  }

  async function confirmarCodigo2fa(e) {
    e.preventDefault();
    setErrorCoord('');
    if (!/^\d{6}$/.test(codigo2fa)) { setErrorCoord('El código es de 6 dígitos.'); return; }

    setCargandoCoord(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pedirCodigo.factorId,
      code: codigo2fa,
    });

    if (err) {
      setCargandoCoord(false);
      setCodigo2fa('');
      setErrorCoord(/expired/i.test(err.message)
        ? 'El código venció. Escribe el que aparece ahora.'
        : 'Ese código no es válido.');
      return;
    }

    // Este computador queda confirmado: aquí no se vuelve a pedir.
    await llamarApiJefe('/api/jefe/seguridad', {
      method: 'POST',
      body: JSON.stringify({ accion: 'confiar' }),
    });

    setCargandoCoord(false);
    entrarAlPanel();
  }

  // ---------------- Coordinador: codigo en computador nuevo ----------------
  if (pedirCodigo) {
    return (
      <div className="login-screen">
        <header className="login-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo-hurgo-blanco.svg" alt="Hurgo Transporte Logística" className="login-logotipo" />
        </header>

        <div className="login-wrap">
          <h1>Confirma que eres tú</h1>
          <p>
            No reconocemos este computador. Escribe el código que aparece ahora
            en tu app de autenticación.
          </p>

          <form className="login-form" onSubmit={confirmarCodigo2fa}>
            <input
              inputMode="numeric" maxLength={6} placeholder="000000" autoFocus
              value={codigo2fa}
              onChange={(e) => setCodigo2fa(e.target.value.replace(/\D/g, ''))}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 26,
                letterSpacing: '10px', textAlign: 'center',
              }}
            />

            {errorCoord && <div className="error">{errorCoord}</div>}

            <button className="btn btn-primary" disabled={cargandoCoord}>
              {cargandoCoord ? 'Verificando…' : 'Entrar'}
            </button>
          </form>

          <div className="login-coord-access">
            <button className="link-btn" onClick={async () => {
              await supabase.auth.signOut();
              setPedirCodigo(null); setCodigo2fa(''); setErrorCoord('');
            }}>
              ← Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mostrarCoordLogin) {
    return (
      <div className="login-screen">
        <header className="login-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo-hurgo-blanco.svg" alt="Hurgo Transporte Logística" className="login-logotipo" />
        </header>
      
        <div className="login-wrap">
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
        <header className="login-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo-hurgo-blanco.svg" alt="Hurgo Transporte Logística" className="login-logotipo" />
        </header>
      
        <div className="login-wrap">
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
              <button className="btn btn-primary" disabled={cargandoConductor}>
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

  // ---------------- Celular ya vinculado: solo la huella ----------------
  if (reconocido && !pedirRegistro && !mostrarCoordLogin) {
    const primerNombre = (reconocido.nombre || '').split(' ')[0];
    return (
      <div className="login-screen">
        <header className="login-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo-hurgo-blanco.svg" alt="Hurgo Transporte Logística" className="login-logotipo" />
        </header>
        <div className="login-wrap">

          <div className="login-form" style={{ textAlign: 'center' }}>
            <h1>{primerNombre ? `Hola, ${primerNombre}` : 'Hola'}</h1>
            <span className="plate-badge">{formatearPlaca(reconocido.placa)}</span>

            <div style={{ fontSize: 64, margin: '26px 0 10px' }}>👆</div>
            <p>Pon tu dedo para entrar</p>

            {error && <div className="error">{error}</div>}

            {reconocido.tieneHuella && (
              <button className="btn btn-stamp" onClick={entrarConHuella} disabled={usandoHuella}>
                {usandoHuella ? 'Esperando tu huella…' : 'Entrar con mi huella'}
              </button>
            )}

            {reconocido.tienePin && (
              <button
                type="button"
                className={reconocido.tieneHuella ? 'link-btn' : 'btn btn-stamp'}
                onClick={() => router.push('/entrar-pin')}
              >
                {reconocido.tieneHuella ? 'La huella no funciona, usar mi PIN' : 'Entrar con mi PIN'}
              </button>
            )}

            <button
              type="button"
              className="link-btn"
              onClick={() => { setReconocido(null); setError(''); }}
            >
              No soy yo / usar otra placa
            </button>
          </div>

          <div className="login-coord-access">
            <button className="link-btn" onClick={() => setMostrarCoordLogin(true)}>Acceso coordinador</button>
            <button className="link-btn" onClick={() => router.push('/rastreo')}>Rastrear un envío</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <header className="login-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo-hurgo-blanco.svg" alt="Hurgo Transporte Logística" className="login-logotipo" />
      </header>
    
      <div className="login-wrap">
        <p className="login-saludo">¡Hola, bienvenido!</p>
        <h1>Ingreso de conductor</h1>
        <p>Escribe tu nombre y la placa de tu vehículo</p>

        <div className="login-form">
          <form onSubmit={continuarComoConductor}>
            <label style={{ marginTop: 0 }}>Tu nombre</label>
            <div className="campo-ico">
              <IcoPersona />
              <input
                type="text"
                placeholder="Ej: Carlos Restrepo"
                value={nombreConductor}
                onChange={(e) => setNombreConductor(e.target.value)}
              />
            </div>

            <label>Placa del vehículo</label>
            <div className="campo-ico">
              <IcoCamion />
              <input
                type="text"
                placeholder="Ej: ABC123"
                value={placaConductor}
                onChange={(e) => setPlacaConductor(e.target.value)}
                style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px', fontWeight: 700 }}
                maxLength={8}
              />
            </div>

            {error && <div className="error">{error}</div>}

            <button className="btn-grande" disabled={cargandoConductor || usandoHuella}>
              <IcoDoc />
              <span>{cargandoConductor ? 'Verificando…' : 'Iniciar sesión'}</span>
              <IcoFlecha />
            </button>

            {ofrecerCodigo && (
              <button
                type="button"
                className="fila-opcion"
                onClick={() => router.push('/enrolar')}
              >
                <span className="fila-ico"><IcoLlave /></span>
                <span className="fila-txt">Tengo un código de activación</span>
                <IcoFlecha />
              </button>
            )}
          </form>
        </div>

        <div className="login-coord-access">
          <button className="fila-opcion" onClick={() => router.push('/rastreo')}>
            <span className="fila-ico"><IcoRastreo /></span>
            <span className="fila-txt">Rastrear un envío</span><IcoFlecha />
          </button>
          <button className="fila-opcion" onClick={() => setMostrarCoordLogin(true)}>
            <span className="fila-ico"><IcoEquipo /></span>
            <span className="fila-txt">Acceso coordinador</span><IcoFlecha />
          </button>
          <button className="fila-opcion" onClick={() => router.push('/instalar')}>
            <span className="fila-ico"><IcoAyuda /></span>
            <span className="fila-txt">¿Cómo agrego esta app a mi celular?</span><IcoFlecha />
          </button>
          <button className="fila-opcion" onClick={() => router.push('/')}>
            <span className="fila-ico"><IcoVolver /></span>
            <span className="fila-txt">Volver al inicio</span><IcoFlecha />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatearMostrar(valor) {
  return normalizarPlaca(valor || '');
}

/* ----------------------------------------------------------
   Iconos de linea del ingreso. Dibujados aqui para no sumar
   una libreria entera por ocho trazos.
   ---------------------------------------------------------- */
const Svg = ({ children, className = 'ico-linea' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const IcoPersona = () => <Svg><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></Svg>;
const IcoCamion  = () => <Svg><path d="M3 8h11v8H3z" /><path d="M14 11h3.5l2.5 3v2H14z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></Svg>;
const IcoDoc     = () => <Svg><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></Svg>;
const IcoHuella  = () => <Svg><path d="M12 11v3a6 6 0 0 1-1.2 3.6" /><path d="M8.5 7.6a6 6 0 0 1 8.6 4.6" /><path d="M6.5 14.5A7.8 7.8 0 0 1 6 12a6 6 0 0 1 1.2-3.6" /><path d="M15.5 12v2.5a9 9 0 0 1-.6 3" /></Svg>;
const IcoLlave   = () => <Svg><circle cx="8" cy="12" r="3.2" /><path d="M11.2 12H20m-3 0v3m-2.5-3v2" /></Svg>;
const IcoRastreo = () => <Svg><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4h-4" /></Svg>;
const IcoEquipo  = () => <Svg><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 12a3 3 0 0 0 0-6" /><path d="M18.5 19a5 5 0 0 0-2.2-4.1" /></Svg>;
const IcoAyuda   = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.3" /><path d="M12 17h.01" /></Svg>;
const IcoVolver  = () => <Svg><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>;
const IcoFlecha  = () => <Svg className="ico-flecha"><path d="m9 6 6 6-6 6" /></Svg>;

