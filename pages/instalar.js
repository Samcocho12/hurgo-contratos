import { useRouter } from 'next/router';

export default function Instalar() {
  const router = useRouter();

  return (
    <div className="login-screen">
      <div className="login-wrap" style={{ maxWidth: 440, textAlign: 'left' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Hurgo Transporte Logística" className="login-logo" style={{ margin: '0 auto 20px' }} />
        <h1 style={{ textAlign: 'center' }}>Agregar a tu pantalla de inicio</h1>
        <p style={{ textAlign: 'center' }}>Así te queda como un ícono, sin buscar el link cada vez.</p>

        <div style={{ marginTop: 28 }}>
          <div className="plate-badge" style={{ marginBottom: 8 }}>ANDROID</div>
          <ol style={{ paddingLeft: 20, lineHeight: 1.9, color: 'var(--ink)' }}>
            <li>Abre esta página en <strong>Chrome</strong>.</li>
            <li>Toca los <strong>3 puntos</strong> arriba a la derecha.</li>
            <li>Toca <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.</li>
            <li>Confirma. Listo — ya tienes el ícono de Hurgo en tu celular.</li>
          </ol>
        </div>

        <div style={{ marginTop: 28 }}>
          <div className="plate-badge" style={{ marginBottom: 8 }}>IPHONE</div>
          <ol style={{ paddingLeft: 20, lineHeight: 1.9, color: 'var(--ink)' }}>
            <li>Abre esta página en <strong>Safari</strong> (no funciona en Chrome en iPhone).</li>
            <li>Toca el botón de <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
            <li>Busca y toca <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.</li>
            <li>Toca <strong>&quot;Agregar&quot;</strong>. Listo — ya tienes el ícono de Hurgo en tu iPhone.</li>
          </ol>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 28 }} onClick={() => router.push('/login')}>
          Ya lo agregué, continuar
        </button>
      </div>
    </div>
  );
}
