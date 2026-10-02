import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { startRegistration } from '@simplewebauthn/browser';
import { llamarApiConductor } from '../lib/apiConductor';
import { normalizarPlaca, formatearPlaca } from '../lib/placa';

// Enrolamiento en 3 pasos:
//   1. placa + codigo que entrego el coordinador
//   2. registrar huella (opcional si el celular no la soporta)
//   3. definir PIN de respaldo
export default function Enrolar() {
  const router = useRouter();

  // ?nuevo=1 -> viene de registrarse: ya tiene sesion, se salta el codigo.
  const [paso, setPaso] = useState(1);
  const [reciénRegistrado, setReciénRegistrado] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.nuevo === '1') {
      setReciénRegistrado(true);
      setPlaca(localStorage.getItem('hurgo_placa') || '');
      setNombre(localStorage.getItem('hurgo_nombre') || '');
      setPaso(2);
    }
  }, [router.isReady]);
  const [placa, setPlaca] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  // ---------------------------------------------- Paso 1: código
  async function canjearCodigo(e) {
    e.preventDefault();
    setError('');
    const placaLimpia = normalizarPlaca(placa);
    if (placaLimpia.length < 5) { setError('Ingresa la placa completa.'); return; }
    if (!/^\d{6}$/.test(codigo.trim())) { setError('El código es de 6 dígitos.'); return; }

    setCargando(true);
    const { ok, datos } = await llamarApiConductor('/api/auth/enrolar', {
      method: 'POST',
      body: JSON.stringify({ placa: placaLimpia, codigo: codigo.trim() }),
    });
    setCargando(false);

    if (!ok) { setError(datos.error || 'No se pudo validar el código.'); return; }
    setNombre(datos.nombre || '');
    setPaso(2);
  }

  // ---------------------------------------------- Paso 2: huella
  async function registrarHuella() {
    setError(''); setAviso('');
    setCargando(true);
    try {
      const r1 = await llamarApiConductor('/api/auth/passkey', {
        method: 'POST',
        body: JSON.stringify({ accion: 'registro-opciones' }),
      });
      if (!r1.ok) throw new Error(r1.datos?.error || 'No se pudo iniciar el registro.');

      // Abre el lector de huella / rostro del celular.
      const respuesta = await startRegistration({ optionsJSON: r1.datos.opciones });

      const r2 = await llamarApiConductor('/api/auth/passkey', {
        method: 'POST',
        body: JSON.stringify({ accion: 'registro-verificar', respuesta }),
      });
      if (!r2.ok) throw new Error(r2.datos?.error || 'No se pudo guardar la huella.');

      setCargando(false);
      setPaso(3);
    } catch (err) {
      setCargando(false);
      const msg = String(err?.message || '');
      if (/NotAllowed|cancel/i.test(msg)) {
        setError('Cancelaste el registro de la huella. Puedes intentar de nuevo.');
      } else if (/NotSupported|not supported/i.test(msg)) {
        setAviso('Este celular no permite huella. Continúa con el PIN.');
        setPaso(3);
      } else {
        setError(msg || 'No se pudo registrar la huella.');
      }
    }
  }

  // ---------------------------------------------- Paso 3: PIN
  async function guardarPin(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) { setError('El PIN debe tener 4 dígitos.'); return; }
    if (pin !== pin2) { setError('Los dos PIN no coinciden.'); return; }

    setCargando(true);
    const { ok, datos } = await llamarApiConductor('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ accion: 'definir', pin }),
    });
    setCargando(false);

    if (!ok) { setError(datos.error || 'No se pudo guardar el PIN.'); return; }

    localStorage.setItem('hurgo_rol', 'conductor');
    localStorage.setItem('hurgo_placa', normalizarPlaca(placa));
    if (nombre) localStorage.setItem('hurgo_nombre', nombre);
    router.push('/conductor');
  }

  return (
    <div className="login-screen">
      <div className="login-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Hurgo Transporte" className="login-logo" />

        {/* ----------------------------------- PASO 1 */}
        {paso === 1 && (
          <form className="login-form" onSubmit={canjearCodigo}>
            <h1 className="page-title">Activa tu acceso</h1>
            <p className="page-sub">
              Escribe la placa de tu vehículo y el código de 6 dígitos que te dio tu coordinador.
            </p>

            <label>Placa del vehículo</label>
            <input
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              placeholder="ABC123"
              maxLength={8}
              style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '2px', fontWeight: 700 }}
            />

            <label>Código de activación</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: '6px', textAlign: 'center' }}
            />

            {error && <div className="error">{error}</div>}

            <button className="btn btn-stamp" disabled={cargando}>
              {cargando ? 'Validando…' : 'Continuar'}
            </button>

            <button type="button" className="link-btn" onClick={() => router.push('/login')}>
              Volver al ingreso
            </button>
          </form>
        )}

        {/* ----------------------------------- PASO 2 */}
        {paso === 2 && (
          <div className="login-form">
            <h1 className="page-title">Hola{nombre ? `, ${nombre.split(' ')[0]}` : ''}</h1>
            <p className="page-sub">
              {reciénRegistrado
                ? 'Falta un paso: registra tu huella para proteger tu cuenta. Se queda en este celular, la empresa no la puede ver ni copiar.'
                : 'Registra tu huella para entrar rápido. Tu huella se queda en este celular: la empresa no la puede ver ni copiar.'}
            </p>

            <div style={{ fontSize: 56, textAlign: 'center', margin: '18px 0' }}>👆</div>

            {error && <div className="error">{error}</div>}
            {aviso && <div className="card" style={{ background: 'rgba(255,196,0,.08)' }}>{aviso}</div>}

            <button className="btn btn-stamp" onClick={registrarHuella} disabled={cargando}>
              {cargando ? 'Esperando tu huella…' : 'Registrar mi huella'}
            </button>

            <button type="button" className="link-btn" onClick={() => setPaso(3)}>
              Mi celular no tiene huella, usar solo PIN
            </button>

            {!reciénRegistrado && (
              <button type="button" className="link-btn" onClick={() => router.push('/login')}>
                Volver
              </button>
            )}
          </div>
        )}

        {/* ----------------------------------- PASO 3 */}
        {paso === 3 && (
          <form className="login-form" onSubmit={guardarPin}>
            <h1 className="page-title">Crea tu PIN</h1>
            <p className="page-sub">
              Cuatro dígitos para cuando la huella no funcione. Solo sirve en este celular.
              No se lo digas a nadie, ni a tu coordinador.
            </p>
            {reciénRegistrado && (
              <div className="card" style={{ background: 'rgba(255,196,0,.08)', textAlign: 'left' }}>
                Este es el último paso. Sin PIN ni huella no vas a poder firmar contratos.
              </div>
            )}

            <label>PIN de 4 dígitos</label>
            <input
              type="password" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric" maxLength={4} placeholder="••••"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 24, letterSpacing: '10px', textAlign: 'center' }}
            />

            <label>Repite el PIN</label>
            <input
              type="password" value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric" maxLength={4} placeholder="••••"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 24, letterSpacing: '10px', textAlign: 'center' }}
            />

            {error && <div className="error">{error}</div>}

            <button className="btn btn-stamp" disabled={cargando}>
              {cargando ? 'Guardando…' : 'Terminar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
