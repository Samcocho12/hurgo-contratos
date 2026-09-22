import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { EMPRESA } from '../lib/empresa';

const PERFILES = [
  {
    titulo: 'Conductores',
    icono: 'camion',
    puntos: [
      'Firman su contrato desde el celular, sin imprimir nada.',
      'Ven las guías de su ruta y marcan cuando recogen, salen y entregan.',
    ],
  },
  {
    titulo: 'Coordinación',
    icono: 'engranaje',
    puntos: [
      'Sube los contratos de cada ruta y guarda los firmados en PDF.',
      'Crea las guías, las asigna y ve el avance de cada envío.',
    ],
  },
  {
    titulo: 'Clientes',
    icono: 'personas',
    puntos: [
      'Siguen su envío con el número de guía, sin instalar nada.',
      'Reciben el enlace de rastreo por WhatsApp.',
    ],
  },
];

const PASOS = [
  { titulo: 'Coordinación sube el contrato', texto: 'El título del contrato indica la ruta del conductor.' },
  { titulo: 'El conductor lo firma', texto: 'Desde su celular, con su nombre y la placa del vehículo.' },
  { titulo: 'Se crean las guías', texto: 'Cada envío de esa ruta queda asignado al conductor.' },
  { titulo: 'El cliente sigue su envío', texto: 'Ve en línea cuando se recoge, va en camino y se entrega.' },
];

export default function Inicio() {
  const router = useRouter();
  const { contacto, redes } = EMPRESA;

  // Quien ya inició sesión entra directo a su panel; los demás, al login.
  function ingresar() {
    const rol = localStorage.getItem('hurgo_rol');
    if (rol === 'jefe') router.push('/jefe');
    else if (rol === 'conductor' && localStorage.getItem('hurgo_placa')) router.push('/conductor');
    else router.push('/login');
  }

  return (
    <div className="inicio">
      <Head>
        <title>Hurgo Transporte Logística · Contratos y envíos</title>
        <meta name="description" content="La app de Hurgo Transporte Logística: contratos firmados desde el celular y guías de envío con rastreo en línea." />
      </Head>

      <header className="inicio-hero">
        <div className="inicio-contenedor">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo-hurgo-blanco.svg" alt="Hurgo Transporte Logística" className="inicio-logo" />

          <h1 className="inicio-titulo">
            <span className="inicio-titulo-fuerte">¡Contratos y envíos</span>
            <span className="inicio-titulo-fino">en un solo <span className="inicio-ambar">lugar!</span></span>
          </h1>
          <p className="inicio-lead">La app de Hurgo conecta a conductores, coordinadores y clientes.</p>

          <div className="inicio-acciones">
            <button type="button" className="inicio-btn inicio-btn-lleno" onClick={ingresar}>Ingresar</button>
            <Link href="/rastreo" className="inicio-btn inicio-btn-borde">Rastrea tu envío</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="inicio-contenedor inicio-intro">
          <article className="inicio-nota">
            <h2><span className="inicio-nota-icono" aria-hidden="true"><Icono tipo="pregunta" /></span>¿Quiénes somos?</h2>
            <p>{EMPRESA.quienesSomos}</p>
          </article>
          <article className="inicio-nota">
            <h2><span className="inicio-nota-icono" aria-hidden="true"><Icono tipo="bombillo" /></span>¿Por qué creamos esta app?</h2>
            <p>{EMPRESA.porQueLaApp}</p>
          </article>
        </section>

        <section className="inicio-contenedor inicio-perfiles-sec" aria-labelledby="que-puedes">
          <h2 id="que-puedes" className="inicio-h2">¿Qué puedes<br />hacer en la app?</h2>
          <div className="inicio-perfiles">
            {PERFILES.map((p) => (
              <article key={p.titulo} className="inicio-perfil">
                <span className="inicio-perfil-icono" aria-hidden="true"><Icono tipo={p.icono} /></span>
                <div className="inicio-perfil-cuerpo">
                  <h3>{p.titulo}</h3>
                  <ul>{p.puntos.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="inicio-como" aria-labelledby="como-funciona">
          <div className="inicio-contenedor">
            <h2 id="como-funciona" className="inicio-h2 inicio-h2-claro">¿Cómo funciona?</h2>
            <ol className="inicio-pasos">
              {PASOS.map((p, i) => (
                <li key={p.titulo}>
                  <span className="inicio-paso-num">{i + 1}</span>
                  <div>
                    <h3>{p.titulo}</h3>
                    <p>{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="inicio-banda" aria-labelledby="trabajas">
          <h2 id="trabajas">¿Trabajas con Hurgo?</h2>
          <p>Conductor o coordinador, ingresa con tus datos.</p>
          <button type="button" className="inicio-enlace" onClick={ingresar}>Ingresar <Flecha /></button>
        </section>

        <section className="inicio-banda" aria-labelledby="esperas">
          <h2 id="esperas">¿Esperas un envío?</h2>
          <p>Escribe el número de guía que te compartieron.</p>
          <Link href="/rastreo" className="inicio-enlace">Rastrea tu envío <Flecha /></Link>
        </section>
      </main>

      <footer className="inicio-pie">
        <div className="inicio-contenedor">
          <div className="inicio-pie-arriba">
            <address className="inicio-contacto">
              <span className="inicio-pie-titulo">Contacto</span>
              {contacto.direccion && <span><Icono tipo="pin" />{contacto.direccion}</span>}
              {contacto.telefono && (
                <a href={`tel:${contacto.telefono.replace(/\s/g, '')}`}><Icono tipo="telefono" />{contacto.telefono}</a>
              )}
              {contacto.correo && <a href={`mailto:${contacto.correo}`}><Icono tipo="correo" />{contacto.correo}</a>}
            </address>
            {redes.instagram && (
              <div className="inicio-redes">
                <span className="inicio-pie-titulo">Redes sociales</span>
                <a href={redes.instagram} target="_blank" rel="noreferrer" aria-label="Instagram de Hurgo Transporte" className="inicio-red">
                  <Icono tipo="instagram" />
                </a>
              </div>
            )}
          </div>

          <div className="inicio-pie-abajo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logotipo-hurgo-blanco.svg" alt="Hurgo Transporte Logística" className="inicio-pie-logo" />
            <nav className="inicio-pie-links" aria-label="Accesos">
              <Link href="/rastreo">Rastrear un envío</Link>
              <Link href="/login">Acceso conductor</Link>
              <Link href="/login?coordinador=1">Acceso coordinador</Link>
              <Link href="/instalar">¿Cómo agrego esta app a mi celular?</Link>
              <Link href="/privacidad">Política de privacidad</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Flecha() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
  );
}

function Icono({ tipo }) {
  switch (tipo) {
    case 'camion':
      return (
        <svg viewBox="0 0 36 28" width="36" height="28" aria-hidden="true">
          <path fill="currentColor" d="M9 4h14a2 2 0 0 1 2 2v13H9z" />
          <path fill="currentColor" d="M26 9h4.6a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .4 1.2V19h-9.6z" />
          <circle cx="14" cy="21.5" r="3.2" fill="currentColor" stroke="#fff" strokeWidth="1.6" />
          <circle cx="29" cy="21.5" r="3.2" fill="currentColor" stroke="#fff" strokeWidth="1.6" />
          <path d="M1 8h6M3 12h4M1 16h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'engranaje':
      return (
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path fill="currentColor" d="M10.3 1.8h3.4l.5 2.5c.6.2 1.2.5 1.7.8l2.2-1.4 2.4 2.4-1.4 2.2c.3.5.6 1.1.8 1.7l2.5.5v3.4l-2.5.5c-.2.6-.5 1.2-.8 1.7l1.4 2.2-2.4 2.4-2.2-1.4c-.5.3-1.1.6-1.7.8l-.5 2.5h-3.4l-.5-2.5c-.6-.2-1.2-.5-1.7-.8l-2.2 1.4-2.4-2.4 1.4-2.2c-.3-.5-.6-1.1-.8-1.7l-2.5-.5v-3.4l2.5-.5c.2-.6.5-1.2.8-1.7L3.7 5.6l2.4-2.4 2.2 1.4c.5-.3 1.1-.6 1.7-.8z" />
          <circle cx="12" cy="12" r="6.2" fill="#fff" />
          <circle cx="12" cy="10.4" r="2" fill="currentColor" />
          <path fill="currentColor" d="M8.4 15.6c.5-1.7 2-2.8 3.6-2.8s3.1 1.1 3.6 2.8z" />
        </svg>
      );
    case 'personas':
      return (
        <svg viewBox="0 0 30 24" width="34" height="27" aria-hidden="true">
          <circle cx="11" cy="7" r="5" fill="currentColor" />
          <path fill="currentColor" d="M1 22c0-5 4.5-8 10-8s10 3 10 8z" />
          <circle cx="21.5" cy="8.5" r="3.8" fill="currentColor" />
          <path fill="currentColor" d="M22.5 22c0-2.6-.9-4.8-2.6-6.4a9 9 0 0 1 1.6-.1c4.4 0 7.5 2.4 7.5 6.5z" />
        </svg>
      );
    case 'pregunta':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 9a3 3 0 1 1 4.2 2.7c-.8.4-1.2 1-1.2 1.8v.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /><circle cx="12" cy="18.5" r="1.6" fill="#fff" /></svg>
      );
    case 'bombillo':
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4" /><path d="M12 6a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z" /><path d="M12 1.5V3M4.5 4.5l1 1M19.5 4.5l-1 1M2 11h1.5M20.5 11H22" /></svg>
      );
    case 'pin':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12zm0-9.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z" /></svg>
      );
    case 'telefono':
      return (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M6.6 2.5 9.4 6c.4.5.4 1.3-.1 1.8L7.7 9.4a13 13 0 0 0 6.9 6.9l1.6-1.6c.5-.5 1.3-.5 1.8-.1l3.5 2.8c.6.5.7 1.4.1 2l-1.8 1.9c-.9.9-2.2 1.2-3.4.8A20 20 0 0 1 3.9 7.6c-.4-1.2-.1-2.5.8-3.4L6.5 2.4c.1 0 .1.1.1.1z" /></svg>
      );
    case 'correo':
      return (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v.4l-10 6.3L2 6.4V6a1 1 0 0 1 1-1zm-1 3.8 10 6.3 10-6.3V18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" /></svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" /></svg>
      );
    default:
      return null;
  }
}
