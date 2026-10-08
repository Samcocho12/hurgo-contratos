// ============================================================
// /api/jefe/guias   (solo coordinadores autenticados)
//
// GET                   -> listado de guias
// GET ?rutas=1          -> contratos firmados (rutas para crear guia)
// GET ?numero=HG...     -> una guia con sus eventos y su contrato
// POST   { guia, contratoId, numero } -> crea la guia y su primer evento
// PATCH  { guiaId, estado, nota, recibido_por } -> registra un evento
// DELETE { guiaId }     -> elimina la guia
//
// Mantiene exactamente las mismas columnas y estados que usaban las
// paginas: el estado de la guia lo lleva la base a partir del evento,
// aqui no se toca a mano.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirCoordinador } from '../../../lib/sesion';
import { registrar } from '../../../lib/auditoria';
import { enlaceFirmado, BUCKET_FIRMADOS } from '../../../lib/archivos';

const texto = (v, max = 160) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

const CAMPOS_GUIA = [
  'remitente_nombre', 'remitente_telefono', 'origen_ciudad', 'origen_direccion',
  'destinatario_nombre', 'destinatario_telefono', 'destino_ciudad', 'destino_direccion',
  'contenido', 'observaciones',
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const coordinador = await exigirCoordinador(req, res);
  if (!coordinador) return;

  // ---------------------------------------------------------- GET
  if (req.method === 'GET') {
    // --- una guia concreta
    const numero = texto(req.query.numero, 40);
    if (numero) {
      const { data, error } = await supabaseAdmin
        .from('guias')
        .select('*, guia_eventos(*), contratos(id, titulo, pdf_firmado_url)')
        .eq('numero', numero)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'No existe una guía con ese número.' });

      const eventos = (data.guia_eventos || [])
        .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
      delete data.guia_eventos;

      // El contrato firmado que cuelga de la guia tambien va con enlace
      // firmado y de vida corta.
      if (data.contratos?.pdf_firmado_url) {
        data.contratos = {
          ...data.contratos,
          pdf_firmado_url: await enlaceFirmado(data.contratos.pdf_firmado_url, BUCKET_FIRMADOS),
        };
      }

      return res.status(200).json({ guia: data, eventos });
    }

    // --- rutas disponibles (contratos firmados)
    if (req.query.rutas) {
      const { data, error } = await supabaseAdmin
        .from('contratos')
        .select('id, titulo, conductor_placa, conductor_nombre, firmado_en')
        .eq('estado', 'firmado')
        .order('firmado_en', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });

      // Ultimo origen/destino de cada ruta, para precargar el formulario
      const { data: previas } = await supabaseAdmin
        .from('guias')
        .select('contrato_id, origen_ciudad, destino_ciudad, creado_en')
        .order('creado_en', { ascending: false })
        .limit(500);

      const ultimaPorContrato = {};
      for (const g of previas || []) {
        if (g.contrato_id && !ultimaPorContrato[g.contrato_id]) {
          ultimaPorContrato[g.contrato_id] = {
            origen_ciudad: g.origen_ciudad || '',
            destino_ciudad: g.destino_ciudad || '',
          };
        }
      }

      return res.status(200).json({ contratos: data || [], ultimaPorContrato });
    }

    // --- listado
    const { data, error } = await supabaseAdmin
      .from('guias')
      .select('numero, estado, contrato_id, ruta_nombre, conductor_placa, conductor_nombre, origen_ciudad, destino_ciudad, destinatario_nombre, creado_en, actualizado_en')
      .order('actualizado_en', { ascending: false })
      .limit(500);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ guias: data || [] });
  }

  // ---------------------------------------------------------- POST
  if (req.method === 'POST') {
    const entrada = req.body?.guia || {};
    const contratoId = req.body?.contratoId;
    const numero = texto(req.body?.numero, 40);

    if (!numero) return res.status(400).json({ error: 'Falta el número de guía.' });
    if (!contratoId) return res.status(400).json({ error: 'Selecciona la ruta.' });

    // La placa y el conductor salen del contrato, no de lo que mande el cliente.
    const { data: contrato } = await supabaseAdmin
      .from('contratos')
      .select('id, titulo, conductor_placa, conductor_nombre, estado')
      .eq('id', contratoId)
      .maybeSingle();

    if (!contrato || contrato.estado !== 'firmado') {
      return res.status(400).json({ error: 'Esa ruta no corresponde a un contrato firmado.' });
    }

    const fila = {
      numero,
      contrato_id: contrato.id,
      ruta_nombre: contrato.titulo,
      conductor_placa: contrato.conductor_placa,
      conductor_nombre: contrato.conductor_nombre,
      estado: 'creada',
      unidades: Number(entrada.unidades) || 1,
      peso_kg: entrada.peso_kg ? Number(entrada.peso_kg) : null,
      valor_declarado: entrada.valor_declarado ? Number(entrada.valor_declarado) : null,
    };
    for (const campo of CAMPOS_GUIA) {
      fila[campo] = texto(entrada[campo], campo.includes('direccion') || campo === 'observaciones' ? 400 : 160);
    }

    const { data: creada, error } = await supabaseAdmin
      .from('guias').insert(fila).select('id, numero').single();

    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin.from('guia_eventos').insert({
      guia_id: creada.id,
      estado: 'creada',
      ubicacion: fila.origen_ciudad,
      autor: 'coordinador',
      autor_detalle: coordinador.email,
    });

    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'guia_creada', objetivo: creada.numero,
    });

    return res.status(201).json({ ok: true, guia: creada });
  }

  // ---------------------------------------------------------- PATCH
  if (req.method === 'PATCH') {
    const guiaId = req.body?.guiaId;
    const estado = texto(req.body?.estado, 30);
    if (!guiaId || !estado) return res.status(400).json({ error: 'Falta la guía o el estado.' });

    const { data: guia } = await supabaseAdmin
      .from('guias').select('id, numero, origen_ciudad, destino_ciudad')
      .eq('id', guiaId).maybeSingle();
    if (!guia) return res.status(404).json({ error: 'Guía no encontrada.' });

    const { error } = await supabaseAdmin.from('guia_eventos').insert({
      guia_id: guia.id,
      estado,
      ubicacion: estado === 'recogiendo' ? guia.origen_ciudad
        : estado === 'entregada' ? guia.destino_ciudad : null,
      nota: texto(req.body?.nota, 400),
      recibido_por: estado === 'entregada' ? texto(req.body?.recibido_por) : null,
      autor: 'coordinador',
      autor_detalle: coordinador.email,
    });
    if (error) return res.status(500).json({ error: error.message });

    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'guia_actualizada', objetivo: guia.numero, detalle: { estado },
    });

    return res.status(200).json({ ok: true });
  }

  // ---------------------------------------------------------- DELETE
  if (req.method === 'DELETE') {
    const guiaId = req.body?.guiaId;
    if (!guiaId) return res.status(400).json({ error: 'Falta la guía.' });

    const { data: previa } = await supabaseAdmin
      .from('guias').select('numero').eq('id', guiaId).maybeSingle();

    const { error } = await supabaseAdmin.from('guias').delete().eq('id', guiaId);
    if (error) return res.status(500).json({ error: error.message });

    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'guia_eliminada', objetivo: previa?.numero || String(guiaId),
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
}
