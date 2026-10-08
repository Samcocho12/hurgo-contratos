const ASSETLINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.hurgotransporte.contratos',
      sha256_cert_fingerprints: [
        'CE:E8:05:FA:BE:85:17:A5:55:50:99:ED:BF:9A:65:04:39:B4:A1:48:54:A4:CE:27:16:F9:46:1D:DE:0D:12:2C',
        '64:A1:70:56:F5:E9:DE:69:E3:68:AD:BC:FD:F2:6E:12:63:11:74:19:52:C8:8C:B0:D4:03:6E:14:BC:74:09:18',
        '2E:6E:68:A1:37:6D:A9:01:52:EE:FD:CD:09:74:57:C4:E8:F1:66:75:FD:44:5C:DC:8A:E8:02:FB:18:F4:97:C3',
      ],
    },
  },
];

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(JSON.stringify(ASSETLINKS, null, 2));
}
