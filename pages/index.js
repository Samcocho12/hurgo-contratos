import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { EMPRESA } from '../lib/empresa';

const PERFILES = [
  {
    titulo: 'Conductores',
    icono: 'conductor',
    puntos: [
      'Firman su contrato desde el celular, sin imprimir nada.',
      'Ven las guías de su ruta y marcan cuando recogen, salen y entregan.',
    ],
  },
  {
    titulo: 'Coordinación',
    icono: 'coordinacion',
    puntos: [
      'Sube los contratos de cada ruta y guarda los firmados en PDF.',
      'Crea las guías, las asigna y ve el avance de cada envío.',
    ],
  },
  {
    titulo: 'Clientes',
    icono: 'cliente',
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
  const [lista, setLista] = useState(false);

  // Quien ya inició sesión entra directo a su panel.
  useEffect(() => {
    const rol = localStorage.getItem('hurgo_rol');
    if (rol === 'jefe') { router.replace('/jefe'); return; }
    if (rol === 'conductor') { router.replace('/conductor'); return; }
    setLista(true);
  }, []);

  const { contacto } = EMPRESA;
  const hayContacto = contacto.whatsapp || contacto.correo || contacto.ciudad;

  return (
    <div className={`landing${lista ? ' landing-lista' : ''}`}>
      <Head>
        <title>Hurgo Transporte Logística · Contratos y envíos</title>
        <meta name="description" content="La app de Hurgo Transporte Logística: contratos firmados desde el celular y guías de envío con rastreo en línea." />
      </Head>

      <header className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-marca">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/isotipo-hurgo-claro.svg" alt="" className="landing-isotipo" />
            <span className="landing-marca-txt">
              <span className="landing-marca-nombre">Hurgo Transporte</span>
              <span className="landing-marca-sub">Logística</span>
            </span>
          </div>

          <h1 className="landing-titulo">Contratos y envíos en un solo lugar</h1>
          <p className="landing-lead">
            La app de Hurgo conecta a conductores, coordinación y clientes: contratos firmados
            desde el celular y guías con seguimiento en línea.
          </p>

          <div className="landing-acciones">
            <Link href="/login" className="btn btn-stamp landing-btn">Ingresar</Link>
            <Link href="/rastreo" className="btn landing-btn landing-btn-claro">Rastrear un envío</Link>
          </div>
        </div>
        <div className="landing-via" aria-hidden="true" />
      </header>

      <main>
        <section className="landing-seccion" aria-labelledby="quienes">
          <div className="landing-contenedor landing-quienes">
            <h2 id="quienes" className="landing-h2">Quiénes somos</h2>
            <div className="landing-texto">
              {EMPRESA.quienesSomos.map((p) => <p key={p}>{p}</p>)}
            </div>
          </div>
        </section>

        <section className="landing-seccion landing-seccion-app" aria-labelledby="app">
          <div className="landing-contenedor">
            <h2 id="app" className="landing-h2">Qué puedes hacer en la app</h2>
            <div className="landing-perfiles">
              {PERFILES.map((p) => (
                <article key={p.titulo} className="landing-perfil">
                  <span className="landing-perfil-icono" aria-hidden="true"><Icono tipo={p.icono} /></span>
                  <h3>{p.titulo}</h3>
                  <ul>
                    {p.puntos.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-seccion landing-seccion-ruta" aria-labelledby="como">
          <div className="landing-contenedor">
            <h2 id="como" className="landing-h2 landing-h2-claro">Cómo funciona</h2>
            <ol className="landing-ruta">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="landing-parada">
                  <span className="landing-parada-num">{i + 1}</span>
                  <div>
                    <h3>{p.titulo}</h3>
                    <p>{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-seccion" aria-labelledby="empezar">
          <div className="landing-contenedor landing-cierre">
            <div>
              <h2 id="empezar" className="landing-h2">¿Trabajas con Hurgo?</h2>
              <p>Conductores y coordinadores ingresan con sus datos.</p>
              <Link href="/login" className="btn btn-primary landing-btn">Ingresar</Link>
            </div>
            <div>
              <h2 className="landing-h2">¿Esperas un envío?</h2>
              <p>Escribe el número de guía que te compartieron.</p>
              <Link href="/rastreo" className="btn btn-ghost landing-btn">Rastrear un envío</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-contenedor landing-footer-inner">
          <div className="landing-marca landing-marca-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/isotipo-hurgo-claro.svg" alt="" className="landing-isotipo" />
            <span className="landing-marca-txt">
              <span className="landing-marca-nombre">Hurgo Transporte</span>
              <span className="landing-marca-sub">Logística</span>
            </span>
          </div>

          {hayContacto && (
            <address className="landing-contacto">
              {contacto.ciudad && <span>{contacto.ciudad}</span>}
              {contacto.whatsapp && (
                <a href={`https://wa.me/${contacto.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>
              )}
              {contacto.correo && <a href={`mailto:${contacto.correo}`}>{contacto.correo}</a>}
            </address>
          )}

          <nav className="landing-footer-links" aria-label="Enlaces">
            <Link href="/instalar">Instalar la app</Link>
            <Link href="/privacidad">Política de privacidad</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Icono({ tipo }) {
  const comun = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (tipo === 'conductor') {
    return (
      <svg {...comun}><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5V16H3z" /><path d="M15 10h3.5l2.5 3v3h-6z" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></svg>
    );
  }
  if (tipo === 'coordinacion') {
    return (
      <svg {...comun}><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
    );
  }
  return (
    <svg {...comun}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
  );
}
