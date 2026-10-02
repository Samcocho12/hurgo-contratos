import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { llamarApiConductor } from '../lib/apiConductor';
import { formatearPlaca } from '../lib/placa';

// Respaldo cuando la huella no funciona.
// Solo sirve en un celular ya vinculado: el servidor rechaza el PIN
// desde cualquier otro, aunque sea el correcto.
export default function EntrarConPin() {
  const router = useRouter();
  const [datosCelular, setDatosCelular] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    (async () => {
      const { ok, datos } = await llamarApiConductor('/api/auth/estado');
      if (!ok || !datos.reconocido) { router.replace('/login'); return; }
      setDatosCelular(datos);
    })();
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) { setError('El PIN es de 4 dígitos.'); return; }

    setCargando(true);
    const { ok, datos } = await llamarApiConductor('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ accion: 'verificar', placa: datosCelular.placa, pin }),
    });
    setCargando(false);

    if (!ok) {
      setPin('');
      setError(datos.error || 'PIN incorrecto.');
      return;
    }

    localStorage.setItem('hurgo_rol', 'conductor');
    localStorage.setItem('hurgo_placa', datosCelular.placa);
    router.push('/conductor');
  }

  if (!datosCelular) return null;

  return (
    <div className="login-screen">
      <div className="login-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Hurgo Transporte" className="login-logo" />

        <form className="login-form" onSubmit={entrar} style={{ textAlign: 'center' }}>
          <h1 className="page-title">Tu PIN</h1>
          <span className="plate-badge">{formatearPlaca(datosCelular.placa)}</span>

          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            autoFocus
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 30, letterSpacing: '14px',
              textAlign: 'center', marginTop: 20,
            }}
          />

          {error && <div className="error">{error}</div>}

          <button className="btn btn-stamp" disabled={cargando}>
            {cargando ? 'Verificando…' : 'Entrar'}
          </button>

          <button type="button" className="link-btn" onClick={() => router.push('/login')}>
            Volver
          </button>
        </form>
      </div>
    </div>
  );
}
