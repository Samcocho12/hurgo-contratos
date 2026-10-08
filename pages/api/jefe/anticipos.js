// ============================================================
// /api/jefe/anticipos   (solo coordinadores autenticados)
//
// GET    -> todos los anticipos con sus soportes
// PATCH  { id, accion, ... } -> aprobar | rechazar | pagar | legalizar
//
// Quien decide sobre el dinero es el coordinador, y cada decision queda
// en la auditoria con su correo.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirCoordinador } from '../../../lib/sesion';
import { registrar } from '../../../lib/auditoria';
import { firmarAdjuntos, BUCKET_ANTICIPOS } from '../../../lib/archivos';

const texto = (v, max = 300) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const coordinador = await exigirCoordinador(req, res);
  if (!coordinador) return;

  // ---------------------------------------------------------- GET
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('anticipos')
      .select('*, anticipo_soportes(*)')
      .order('creado_en', { ascending: false })
      .limit(300);

    if (error) return res.status(500).json({ error: error.message });

    const anticipos = await Promise.all((data || []).map(async (a) => {
      const soportes = (a.anticipo_soportes || [])
        .sort((x, y) => new Date(x.creado_en) - new Date(y.creado_en));
      delete a.anticipo_soportes;
      const gastado = soportes.reduce((acc, s) => acc + Number(s.monto || 0), 0);
      return { ...a, soportes: await firmarAdjuntos(soportes, 'archivo_url', BUCKET_ANTICIPOS), gastado };
    }));

    return res.status(200).json({ anticipos });
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // ---------------------------------------------------------- PATCH
  const { id, accion } = req.body || {};
  if (!id || !accion) return res.status(400).json({ error: 'Falta el anticipo o la acción.' });

  const { data: anticipo } = await supabaseAdmin
    .from('anticipos').select('*').eq('id', id).maybeSingle();
  if (!anticipo) return res.status(404).json({ error: 'Anticipo no encontrado.' });

  const ahora = new Date().toISOString();
  let cambios = null;

  if (accion === 'aprobar') {
    if (anticipo.estado !== 'solicitado') {
      return res.status(409).json({ error: 'Esta solicitud ya fue revisada.' });
    }
    const monto = Number(req.body?.monto ?? anticipo.monto_solicitado);
    if (!(monto > 0)) return res.status(400).json({ error: 'Escribe un monto válido.' });

    cambios = {
      estado: 'aprobado',
      monto_aprobado: monto,
      revisado_por: coordinador.email,
      revisado_en: ahora,
    };
  }

  else if (accion === 'rechazar') {
    if (anticipo.estado !== 'solicitado') {
      return res.status(409).json({ error: 'Esta solicitud ya fue revisada.' });
    }
    const motivo = texto(req.body?.motivo);
    if (!motivo) return res.status(400).json({ error: 'Explica por qué lo rechazas.' });

    cambios = {
      estado: 'rechazado',
      motivo_rechazo: motivo,
      revisado_por: coordinador.email,
      revisado_en: ahora,
    };
  }

  else if (accion === 'pagar') {
    if (anticipo.estado !== 'aprobado') {
      return res.status(409).json({ error: 'Solo se marca como pagado un anticipo aprobado.' });
    }
    cambios = {
      estado: 'pagado',
      pagado_en: ahora,
      metodo_pago: texto(req.body?.metodo, 40) || 'transferencia',
      referencia_pago: texto(req.body?.referencia, 120),
    };
  }

  else if (accion === 'legalizar') {
    if (anticipo.estado !== 'pagado') {
      return res.status(409).json({ error: 'Solo se cierra un anticipo que ya fue pagado.' });
    }
    cambios = {
      estado: 'legalizado',
      legalizado_en: ahora,
      nota_cierre: texto(req.body?.nota, 400),
    };
  }

  else {
    return res.status(400).json({ error: 'Acción no reconocida.' });
  }

  const { error } = await supabaseAdmin
    .from('anticipos')
    .update({ ...cambios, actualizado_en: ahora })
    .eq('id', anticipo.id)
    .eq('estado', anticipo.estado);   // evita dos decisiones a la vez

  if (error) return res.status(500).json({ error: error.message });

  await registrar(req, {
    actorTipo: 'coordinador', actorId: coordinador.email,
    accion: `anticipo_${accion}`, objetivo: anticipo.conductor_placa,
    detalle: { id: anticipo.id, ...cambios },
  });

  return res.status(200).json({ ok: true });
}
