// ============================================================
// /api/jefe/contratos   (solo coordinadores autenticados)
//
// GET    ?vista=resumen|activos|firmados  -> contratos + datos de apoyo
// POST   { titulo, placa, archivo, anexos[] } -> crea el contrato
// DELETE { id }                           -> elimina del archivo
//
// Reemplaza las consultas que las paginas del coordinador hacian
// directamente contra Supabase desde el navegador.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirCoordinador } from '../../../lib/sesion';
import { registrar } from '../../../lib/auditoria';
import { normalizarPlaca } from '../../../lib/placa';
import { firmarContratos } from '../../../lib/archivos';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const coordinador = await exigirCoordinador(req, res);
  if (!coordinador) return;

  // ---------------------------------------------------------- GET
  if (req.method === 'GET') {
    const vista = String(req.query.vista || 'activos');

    if (vista === 'firmados') {
      const { data: contratos, error } = await supabaseAdmin
        .from('contratos')
        .select('*')
        .eq('estado', 'firmado')
        .order('firmado_en', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });

      // Cuantas guias cuelgan de cada contrato (para avisar al eliminar)
      const { data: guias } = await supabaseAdmin
        .from('guias').select('contrato_id').not('contrato_id', 'is', null);

      const guiasPorContrato = {};
      for (const g of guias || []) {
        guiasPorContrato[g.contrato_id] = (guiasPorContrato[g.contrato_id] || 0) + 1;
      }

      return res.status(200).json({
        contratos: await firmarContratos(contratos),
        guiasPorContrato,
      });
    }

    // resumen y activos comparten la misma consulta base
    const { data: contratos, error } = await supabaseAdmin
      .from('contratos')
      .select('*')
      .order('creado_en', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const respuesta = { contratos: contratos || [] };

    if (vista === 'resumen') {
      const { data: guias } = await supabaseAdmin
        .from('guias').select('estado').limit(1000);
      respuesta.guias = guias || [];
    } else {
      const { data: conductores } = await supabaseAdmin
        .from('conductores')
        .select('placa, nombre')
        .eq('aprobado', true)
        .eq('activo', true)
        .order('nombre', { ascending: true });
      respuesta.conductores = conductores || [];
    }

    return res.status(200).json(respuesta);
  }

  // ---------------------------------------------------------- POST
  if (req.method === 'POST') {
    const titulo = String(req.body?.titulo || '').trim().slice(0, 200);
    const placa = normalizarPlaca(String(req.body?.placa || ''));
    const archivo = String(req.body?.archivo || '');          // ruta en el bucket
    const anexos = Array.isArray(req.body?.anexos) ? req.body.anexos.slice(0, 10) : [];

    if (!titulo) return res.status(400).json({ error: 'Escribe el titulo del contrato.' });
    if (!archivo) return res.status(400).json({ error: 'Falta el PDF del contrato.' });

    const { data: conductor } = await supabaseAdmin
      .from('conductores')
      .select('placa, nombre, aprobado, activo')
      .eq('placa', placa)
      .maybeSingle();

    if (!conductor) return res.status(404).json({ error: 'Ese conductor no existe.' });
    if (!conductor.aprobado || conductor.activo === false) {
      return res.status(400).json({ error: 'Ese conductor no esta activo o no ha sido confirmado.' });
    }

    // Se guarda la RUTA dentro del bucket, no una URL publica.
    const { data: creado, error } = await supabaseAdmin
      .from('contratos')
      .insert({
        titulo,
        conductor_nombre: conductor.nombre,
        conductor_placa: conductor.placa,
        contrato_original_url: archivo,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    for (const anexo of anexos) {
      if (!anexo?.ruta) continue;
      await supabaseAdmin.from('contrato_anexos').insert({
        contrato_id: creado.id,
        url: String(anexo.ruta),
        nombre: String(anexo.nombre || 'anexo.pdf').slice(0, 200),
      });
    }

    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'contrato_enviado', objetivo: creado.id,
      detalle: { titulo, placa },
    });

    return res.status(201).json({ ok: true, contrato: creado });
  }

  // ---------------------------------------------------------- DELETE
  if (req.method === 'DELETE') {
    const id = String(req.body?.id || '');
    if (!id) return res.status(400).json({ error: 'Falta el contrato.' });

    const { data: previo } = await supabaseAdmin
      .from('contratos').select('titulo, conductor_placa').eq('id', id).maybeSingle();

    const { error } = await supabaseAdmin.from('contratos').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'contrato_eliminado', objetivo: id, detalle: previo || null,
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
}
