import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor } from '../../../lib/guiasServidor';

// GET -> rutas activas que el conductor puede elegir al crear una guía
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { data, error } = await supabaseAdmin
    .from('rutas')
    .select('id, nombre, origen_ciudad, destino_ciudad')
    .eq('activa', true)
    .order('origen_ciudad', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ rutas: data || [] });
}
