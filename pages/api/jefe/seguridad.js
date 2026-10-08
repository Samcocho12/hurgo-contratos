// ============================================================
// /api/jefe/seguridad   (coordinador autenticado)
//
// GET                    -> estado del segundo factor y computadores
// POST  { accion: 'confiar' }    -> marca este computador como de confianza
// PATCH { accion: 'revocar', id }-> quita un computador de la lista
//
// El secreto del segundo factor lo guarda Supabase Auth: aqui solo se
// registra que computadores ya pasaron la verificacion.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirCoordinador, confiarEquipo } from '../../../lib/sesion';
import { registrar } from '../../../lib/auditoria';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Esta ruta se usa justo al terminar de verificar, cuando la sesion
  // todavia puede no contar como verificada: por eso no exige el factor.
  const coordinador = await exigirCoordinador(req, res, { permitirSinVerificar: true });
  if (!coordinador) return;

  const factores = (coordinador.factors || []).filter((f) => f.status === 'verified');

  // ---------------------------------------------------------- GET
  if (req.method === 'GET') {
    const { data: equipos } = await supabaseAdmin
      .from('coordinador_dispositivos')
      .select('id, etiqueta, ip, creado_en, ultimo_uso, expira_en')
      .eq('usuario_id', coordinador.id)
      .eq('revocado', false)
      .gt('expira_en', new Date().toISOString())
      .order('ultimo_uso', { ascending: false });

    return res.status(200).json({
      correo: coordinador.email,
      activo: factores.length > 0,
      equipos: equipos || [],
    });
  }

  // ---------------------------------------------------------- POST
  if (req.method === 'POST' && req.body?.accion === 'confiar') {
    if (factores.length === 0) {
      return res.status(400).json({ error: 'Primero activa la verificación en dos pasos.' });
    }
    await confiarEquipo(req, res, coordinador);
    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'equipo_confiado',
    });
    return res.status(200).json({ ok: true });
  }

  // ---------------------------------------------------------- PATCH
  if (req.method === 'PATCH' && req.body?.accion === 'revocar') {
    const id = req.body?.id;
    if (!id) return res.status(400).json({ error: 'Falta el computador.' });

    const { error } = await supabaseAdmin
      .from('coordinador_dispositivos')
      .update({ revocado: true })
      .eq('id', id)
      .eq('usuario_id', coordinador.id);   // solo los suyos

    if (error) return res.status(500).json({ error: error.message });

    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'equipo_revocado', objetivo: String(id),
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
