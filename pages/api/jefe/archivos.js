// ============================================================
// POST /api/jefe/archivos   { nombre, carpeta? }
//
// Devuelve una URL firmada de SUBIDA para el bucket de contratos.
// El navegador sube el PDF directo a Supabase con ese permiso de un
// solo uso, sin necesitar la anon key ni que el archivo pase por
// este servidor (las rutas de Next tienen limite de tamano).
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirCoordinador } from '../../../lib/sesion';

const BUCKET = 'contratos-originales';

// Deja solo caracteres seguros para una ruta de almacenamiento.
function nombreSeguro(nombre) {
  return String(nombre || 'documento.pdf')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-120);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const coordinador = await exigirCoordinador(req, res);
  if (!coordinador) return;

  const nombre = nombreSeguro(req.body?.nombre);
  if (!nombre.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'El archivo debe ser un PDF.' });
  }

  const carpeta = req.body?.carpeta === 'anexos' ? 'anexos/' : '';
  const ruta = `${carpeta}${Date.now()}-${nombre}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(ruta);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    ruta,
    token: data.token,
    signedUrl: data.signedUrl,
    bucket: BUCKET,
  });
}
