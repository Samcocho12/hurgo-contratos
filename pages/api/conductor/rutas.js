import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor } from '../../../lib/guiasServidor';

// GET -> rutas del conductor = sus contratos firmados (el título indica la ruta)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { data, error } = await supabaseAdmin
    .from('contratos')
    .select('id, titulo, firmado_en')
    .eq('conductor_placa', auth.conductor.placa)
    .eq('estado', 'firmado')
    .order('firmado_en', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ rutas: data || [] });
}
