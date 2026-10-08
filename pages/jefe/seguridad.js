import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { llamarApiJefe } from '../../lib/apiJefe';
import PanelLayout from '../../components/PanelLayout';

export default function Seguridad() {
  const router = useRouter();
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // Alta del segundo factor
  const [activando, setActivando] = useState(false);
  const [factor, setFactor] = useState(null);   // { id, qr, secret }
  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [verSecreto, setVerSecreto] = useState(false);

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
    const { ok, datos } = await llamarApiJefe('/api/jefe/seguridad');
    if (!ok) { setError(datos.error || 'No se pudo cargar.'); return; }
    setEstado(datos);
  }

  // ---------------------------------------------- activar
  async function empezarAlta() {
    setError(''); setAviso('');
    setActivando(true);

    // Limpia intentos a medias: un factor sin confirmar estorba al siguiente.
    const { data: lista } = await supabase.auth.mfa.listFactors();
    for (const f of (lista?.all || [])) {
      if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    // issuer es el nombre que muestra la app de autenticacion. Sin el,
    // Supabase usa la Site URL del proyecto.
    const { data, error: err } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'Hurgo Transporte',
      friendlyName: `Hurgo ${new Date().toLocaleDateString('es-CO')}`,
    });
    setActivando(false);

    if (err) { setError(traducir(err.message)); return; }
    setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmarCodigo(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(codigo)) { setError('El código es de 6 dígitos.'); return; }

    setVerificando(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: codigo,
    });

    if (err) {
      setVerificando(false);
      setError(traducir(err.message));
      return;
    }

    // Este computador queda de confianza: aquí no se vuelve a pedir.
    await llamarApiJefe('/api/jefe/seguridad', {
      method: 'POST',
      body: JSON.stringify({ accion: 'confiar' }),
    });

    setVerificando(false);
    setFactor(null); setCodigo('');
    setAviso('Listo. Desde ahora te pedimos el código solo en computadores nuevos.');
    cargar();
  }

  async function desactivar() {
    if (!window.confirm(
      '¿Quitar la verificación en dos pasos?\n\nTu cuenta aprueba conductores y dinero: ' +
      'sin esto, basta con tu correo y contraseña para entrar.'
    )) return;

    const { data: lista } = await supabase.auth.mfa.listFactors();
    for (const f of (lista?.all || [])) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    setAviso('Quedó desactivada.');
    cargar();
  }

  async function revocar(id) {
    if (!window.confirm('¿Quitar este computador de la lista?\n\nLa próxima vez que entres desde ahí te pediremos el código.')) return;
    const { ok, datos } = await llamarApiJefe('/api/jefe/seguridad', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'revocar', id }),
    });
    if (!ok) { alert(datos.error || 'No se pudo.'); return; }
    cargar();
  }

  function traducir(mensaje) {
    const m = String(mensaje || '').toLowerCase();
    if (m.includes('invalid') && m.includes('code')) return 'Ese código no es válido. Revisa que sea el actual.';
    if (m.includes('expired')) return 'El código venció. Escribe el que aparece ahora.';
    if (m.includes('rate') || m.includes('too many')) return 'Demasiados intentos. Espera un momento.';
    if (m.includes('mfa') && m.includes('disabled')) return 'La verificación en dos pasos no está habilitada en Supabase. Actívala en Authentication.';
    return mensaje || 'No se pudo completar.';
  }

  return (
    <PanelLayout
      activo="/jefe/seguridad"
      titulo="Seguridad"
      descripcion="Protege tu cuenta de coordinación con un segundo paso al entrar."
    >
      <button className="back-link solo-movil" onClick={() => router.push('/jefe')}>← Volver</button>

      {error && <div className="error">{error}</div>}
      {aviso && (
        <div className="card" style={{ background: '#E4F5EC', color: '#14633F' }}>{aviso}</div>
      )}

      {estado && (
        <>
          {/* -------------------- estado -------------------- */}
          <div className="card">
            <div className="card-row">
              <div>
                <div className="card-title">Verificación en dos pasos</div>
                <div className="card-meta">{estado.correo}</div>
                <div className="card-meta" style={{ marginTop: 6, maxWidth: '60ch' }}>
                  Además de tu contraseña, pedimos un código de 6 dígitos que cambia
                  cada 30 segundos en tu celular. Solo al entrar desde un computador nuevo.
                </div>
              </div>
              <span className={`status status-${estado.activo ? 'firmado' : 'pendiente'}`}>
                {estado.activo ? 'Activa' : 'Sin activar'}
              </span>
            </div>

            {!estado.activo && !factor && (
              <div className="card-foot">
                <button className="btn btn-stamp btn-sm" onClick={empezarAlta} disabled={activando}>
                  {activando ? 'Preparando…' : 'Activar'}
                </button>
              </div>
            )}

            {estado.activo && (
              <div className="card-foot">
                <button className="btn btn-danger btn-sm" onClick={desactivar}>Desactivar</button>
              </div>
            )}
          </div>

          {/* -------------------- alta -------------------- */}
          {factor && (
            <div className="card">
              <div className="card-title">1. Escanea este código</div>
              <div className="card-meta" style={{ marginBottom: 12 }}>
                Abre Google Authenticator (o Authy, o Microsoft Authenticator) en tu
                celular, toca el + y escanea.
              </div>

              <div style={{ background: '#fff', padding: 14, borderRadius: 14, textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={factor.qr} alt="Código QR" style={{ width: 200, height: 200 }} />
              </div>

              <button className="link-btn" onClick={() => setVerSecreto(!verSecreto)}>
                {verSecreto ? 'Ocultar el código manual' : 'No puedo escanear, mostrar el código'}
              </button>
              {verSecreto && (
                <div className="card-meta" style={{
                  fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
                  background: '#F4F6FB', padding: 10, borderRadius: 10,
                }}>
                  {factor.secret}
                </div>
              )}

              <form onSubmit={confirmarCodigo} style={{ marginTop: 18 }}>
                <div className="card-title">2. Escribe el código que aparece</div>
                <input
                  inputMode="numeric" maxLength={6} placeholder="000000"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 24,
                    letterSpacing: '8px', textAlign: 'center', marginTop: 10,
                  }}
                />
                <button className="btn btn-stamp" disabled={verificando}>
                  {verificando ? 'Verificando…' : 'Confirmar y activar'}
                </button>
                <button type="button" className="link-btn" onClick={() => {
                  setFactor(null); setCodigo(''); setError('');
                }}>
                  Cancelar
                </button>
              </form>
            </div>
          )}

          {/* -------------------- computadores -------------------- */}
          {estado.activo && (
            <>
              <h2 className="seccion-titulo">Computadores de confianza</h2>
              <p className="page-sub" style={{ marginTop: -6 }}>
                Donde ya confirmaste el código. No te lo volvemos a pedir ahí por 90 días.
              </p>

              {estado.equipos.length === 0 && (
                <div className="card"><div className="card-meta">Ninguno por ahora.</div></div>
              )}

              {estado.equipos.map((e) => (
                <div className="card" key={e.id}>
                  <div className="card-row">
                    <div>
                      <div className="card-title" style={{ fontSize: 14.5 }}>
                        {resumirNavegador(e.etiqueta)}
                      </div>
                      <div className="card-meta">
                        {e.ip && `IP ${e.ip} · `}
                        último uso {e.ultimo_uso
                          ? new Date(e.ultimo_uso).toLocaleDateString('es-CO')
                          : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="card-foot">
                    <button className="btn btn-ghost btn-sm" onClick={() => revocar(e.id)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </PanelLayout>
  );
}

// El user-agent completo no le dice nada a nadie: se resume.
function resumirNavegador(ua = '') {
  const s = String(ua);
  const navegador = /Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
    : /Firefox/.test(s) ? 'Firefox'
    : /Chrome/.test(s) ? 'Chrome'
    : /Safari/.test(s) ? 'Safari' : 'Navegador';
  const sistema = /Windows/.test(s) ? 'Windows'
    : /Android/.test(s) ? 'Android'
    : /iPhone|iPad/.test(s) ? 'iPhone'
    : /Mac OS/.test(s) ? 'Mac'
    : /Linux/.test(s) ? 'Linux' : '';
  return sistema ? `${navegador} en ${sistema}` : navegador;
}
