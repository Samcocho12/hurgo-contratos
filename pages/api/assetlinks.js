// Sirve el Digital Asset Links para verificar la TWA de Android.
// Se accede vía /.well-known/assetlinks.json gracias al rewrite de next.config.js

const ASSETLINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.hurgotransporte.contratos',
      sha256_cert_fingerprints: [
        'REEMPLAZAR_CON_SHA256_DE_LA_CLAVE_DE_FIRMA_DE_APPS',
        'REEMPLAZAR_CON_SHA256_DE_LA_CLAVE_DE_CARGA',
      ],
    },
  },
];

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(JSON.stringify(ASSETLINKS, null, 2));
}
