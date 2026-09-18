import Head from 'next/head';
import Link from 'next/link';

export default function RastreoMarco({ titulo, children }) {
  return (
    <div className="rastreo">
      <Head>
        <title>{titulo}</title>
        <meta name="description" content="Consulta en qué va tu envío con Hurgo Transporte Logística." />
      </Head>
      <header className="rastreo-header">
        <Link href="/rastreo" className="rastreo-header-inner">
          <span className="app-header-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/isotipo-hurgo-claro.svg" alt="Hurgo Transporte Logística" className="app-header-logo" />
            <span className="app-header-txt">
              <span className="app-header-nombre">Hurgo Transporte</span>
              <span className="app-header-sub">Logística</span>
            </span>
          </span>
          <span className="rastreo-header-txt">Rastreo de envíos</span>
        </Link>
      </header>
      <main className="rastreo-main">{children}</main>
      <footer className="rastreo-footer">
        Hurgo Transporte Logística · <Link href="/privacidad">Política de privacidad</Link>
      </footer>
    </div>
  );
}
