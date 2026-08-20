import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#16215C" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Hurgo Contratos" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
