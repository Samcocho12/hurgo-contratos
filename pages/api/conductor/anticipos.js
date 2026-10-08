// ============================================================
// /api/conductor/anticipos   (conductor autenticado)
//
// GET            -> sus anticipos, con los soportes de cada uno
// POST           -> solicita un anticipo { monto, motivo, destino }
// POST ?soporte=1-> agrega un soporte { anticipoId, descripcion, monto, archivo }
//
// Un conductor solo ve y toca sus propios anticipos: la placa sale de
// la cookie de sesion, nunca de lo que mande el navegador.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor, textoLimpio } from '../../../lib/guiasServidor';
import { registrar } from '../../../lib/auditoria';
import { firmarAdjuntos, BUCKET_ANTICIPOS } from '../../../lib/archivos';

const MONTO_MAXIMO = 20_000_000; // tope de cordura, no una regla de negocio

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { conductor } = auth;

  // ---------------------------------------------------------- GET
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('anticipos')
      .select('*, anticipo_soportes(*)')
      .eq('conductor_placa', conductor.placa)
      .order('creado_en', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });

    const anticipos = await Promise.all((data || []).map(async (a) => {
      const soportes = (a.anticipo_soportes || [])
        .sort((x, y) => new Date(x.creado_en) - new Date(y.creado_en));
      delete a.anticipo_soportes;
      const gastado = soportes.reduce((t, s) => t + Number(s.monto || 0), 0);
      return { ...a, soportes: await firmarAdjuntos(soportes, 'archivo_url', BUCKET_ANTICIPOS), gastado };
    }));

    return res.status(200).json({ anticipos });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // ---------------------------------------------- POST: nuevo soporte
  if (req.query.soporte) {
    const anticipoId = req.body?.anticipoId;
    const descripcion = textoLimpio(req.body?.descripcion, 160);
    const monto = Number(req.body?.monto);

    if (!anticipoId) return res.status(400).json({ error: 'Falta el anticipo.' });
    if (!descripcion) return res.status(400).json({ error: 'Escribe en qué gastaste.' });
    if (!(monto >= 0) || monto > MONTO_MAXIMO) {
      return res.status(400).json({ error: 'Escribe un valor válido.' });
    }

    // Tiene que ser suyo y estar pagado: antes no hay nada que legalizar.
    const { data: anticipo } = await supabaseAdmin
      .from('anticipos')
      .select('id, estado')
      .eq('id', anticipoId)
      .eq('conductor_placa', conductor.placa)
      .maybeSingle();

    if (!anticipo) return res.status(404).json({ error: 'Anticipo no encontrado.' });
    if (anticipo.estado !== 'pagado') {
      return res.status(409).json({
        error: anticipo.estado === 'legalizado'
          ? 'Este anticipo ya quedó cerrado.'
          : 'Podrás subir soportes cuando el anticipo esté pagado.',
      });
    }

    const { error } = await supabaseAdmin.from('anticipo_soportes').insert({
      anticipo_id: anticipo.id,
      descripcion,
      monto,
      archivo_url: textoLimpio(req.body?.archivo, 500) || null,
    });
    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin
      .from('anticipos')
      .update({ actualizado_en: new Date().toISOString() })
      .eq('id', anticipo.id);

    return res.status(201).json({ ok: true });
  }

  // ---------------------------------------------- POST: nueva solicitud
  const monto = Number(req.body?.monto);
  const motivo = textoLimpio(req.body?.motivo, 600);
  const destino = textoLimpio(req.body?.destino, 200) || null;

  if (!(monto > 0) || monto > MONTO_MAXIMO) {
    return res.status(400).json({ error: 'Escribe cuánto necesitas.' });
  }
  if (!motivo || motivo.length < 5) {
    return res.status(400).json({ error: 'Explica para qué es el anticipo.' });
  }

  // Un anticipo abierto a la vez: evita pedir de más por error.
  const { data: abierto } = await supabaseAdmin
    .from('anticipos')
    .select('id, estado')
    .eq('conductor_placa', conductor.placa)
    .in('estado', ['solicitado', 'aprobado', 'pagado'])
    .limit(1)
    .maybeSingle();

  if (abierto) {
    return res.status(409).json({
      error: abierto.estado === 'pagado'
        ? 'Primero sube los soportes del anticipo anterior.'
        : 'Ya tienes una solicitud en curso. Espera la respuesta de tu coordinador.',
    });
  }

  const { data: creado, error } = await supabaseAdmin
    .from('anticipos')
    .insert({
      conductor_placa: conductor.placa,
      conductor_nombre: conductor.nombre,
      monto_solicitado: monto,
      motivo,
      destino,
      estado: 'solicitado',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await registrar(req, {
    actorTipo: 'conductor', actorId: conductor.placa,
    accion: 'anticipo_solicitado', objetivo: creado.id,
    detalle: { monto, destino },
  });

  return res.status(201).json({ ok: true, anticipo: creado });
}
