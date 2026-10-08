// ============================================================
// POST /api/conductor/archivos   { nombre }
//
// Permiso de subida firmado para los soportes de un anticipo: fotos de
// recibos o PDF. El archivo va directo al almacenamiento y el navegador
// nunca necesita una llave de Supabase.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor } from '../../../lib/guiasServidor';

const BUCKET = 'anticipos';
// Solo lo que se puede incrustar en el PDF de legalizacion. HEIC y
// webp quedan fuera a proposito: el celular convierte a JPG al elegir
// "Camara" o al tomar la foto desde la app.
const EXTENSIONES = ['.jpg', '.jpeg', '.png', '.pdf'];

function nombreSeguro(nombre) {
  return String(nombre || 'soporte.jpg')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-120);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { conductor } = auth;

  const nombre = nombreSeguro(req.body?.nombre);
  const extension = nombre.slice(nombre.lastIndexOf('.')).toLowerCase();

  if (!EXTENSIONES.includes(extension)) {
    return res.status(400).json({
      error: 'Sube la foto como JPG o PNG, o un PDF.',
    });
  }

  // Cada conductor escribe bajo su propia carpeta.
  const ruta = `${conductor.placa}/${Date.now()}-${nombre}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(ruta);

  if (error) return res.status(500).json({ error: error.message });

  // Se devuelve la RUTA: el enlace para verlo se firma al momento de
  // mostrarlo, no se guarda uno permanente.
  return res.status(200).json({
    ruta,
    signedUrl: data.signedUrl,
    url: ruta,
  });
}
