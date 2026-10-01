// ============================================================
// GET /api/jefe/auditoria?placa=&accion=&limite=
//
// Registro de actividad. Solo lectura: no hay ruta para borrar ni
// editar entradas, ni siquiera para el coordinador. Esa es la razon
// de ser de un log de auditoria.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirCoordinador } from '../../../lib/sesion';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const coordinador = await exigirCoordinador(req, res);
  if (!coordinador) return;

  const limite = Math.min(Number(req.query.limite) || 100, 300);

  let consulta = supabaseAdmin
    .from('auditoria')
    .select('id, ocurrido_en, actor_tipo, actor_id, accion, objetivo, ip, detalle')
    .order('ocurrido_en', { ascending: false })
    .limit(limite);

  if (req.query.placa) consulta = consulta.eq('actor_id', String(req.query.placa).toUpperCase());
  if (req.query.accion) consulta = consulta.eq('accion', String(req.query.accion));

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ eventos: data || [] });
}
