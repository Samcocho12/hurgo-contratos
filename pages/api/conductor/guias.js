import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor } from '../../../lib/guiasServidor';

// GET -> guías que coordinación le asignó al conductor.
// (El conductor no crea guías: solo cambia su estado en /api/conductor/guia.)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { data, error } = await supabaseAdmin
    .from('guias')
    .select('numero, estado, contrato_id, ruta_nombre, origen_ciudad, destino_ciudad, destinatario_nombre, creado_en, actualizado_en')
    .eq('conductor_placa', auth.conductor.placa)
    .order('creado_en', { ascending: false })
    .limit(300);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ guias: data || [] });
}
