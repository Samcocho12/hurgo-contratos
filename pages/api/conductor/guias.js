import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor, generarNumeroGuia, textoLimpio } from '../../../lib/guiasServidor';

// GET  -> guías del conductor
// POST -> crea una guía nueva
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { conductor, contratoId } = auth;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('guias')
      .select('numero, estado, ruta_id, origen_ciudad, destino_ciudad, destinatario_nombre, creado_en, actualizado_en')
      .eq('conductor_placa', conductor.placa)
      .order('creado_en', { ascending: false })
      .limit(300);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ guias: data || [] });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const guia = {
      remitente_nombre: textoLimpio(b.remitente_nombre),
      remitente_telefono: textoLimpio(b.remitente_telefono, 20) || null,
      origen_direccion: textoLimpio(b.origen_direccion, 200) || null,
      destinatario_nombre: textoLimpio(b.destinatario_nombre),
      destinatario_telefono: textoLimpio(b.destinatario_telefono, 20),
      destino_direccion: textoLimpio(b.destino_direccion, 200),
      contenido: textoLimpio(b.contenido, 200),
      unidades: parseInt(b.unidades, 10),
      peso_kg: b.peso_kg === '' || b.peso_kg == null ? null : Number(String(b.peso_kg).replace(',', '.')),
      valor_declarado: b.valor_declarado === '' || b.valor_declarado == null
        ? null
        : Number(String(b.valor_declarado).replace(/\D/g, '')),
      observaciones: textoLimpio(b.observaciones, 500) || null,
    };

    // La ruta define origen y destino.
    const rutaId = textoLimpio(b.ruta_id, 40);
    const { data: ruta } = rutaId
      ? await supabaseAdmin.from('rutas').select('id, origen_ciudad, destino_ciudad, activa').eq('id', rutaId).maybeSingle()
      : { data: null };
    if (!ruta || !ruta.activa) {
      return res.status(400).json({ error: 'Selecciona la ruta en la que vas.' });
    }
    guia.ruta_id = ruta.id;
    guia.origen_ciudad = ruta.origen_ciudad;
    guia.destino_ciudad = ruta.destino_ciudad;

    const faltan = [];
    if (!guia.remitente_nombre) faltan.push('nombre del remitente');
    if (!guia.destinatario_nombre) faltan.push('nombre del destinatario');
    if (guia.destinatario_telefono.replace(/\D/g, '').length < 7) faltan.push('celular del destinatario');
    if (!guia.destino_direccion) faltan.push('dirección de entrega');
    if (!guia.contenido) faltan.push('qué se envía');
    if (!Number.isInteger(guia.unidades) || guia.unidades < 1) faltan.push('unidades (mínimo 1)');
    if (faltan.length) {
      return res.status(400).json({ error: `Revisa estos campos: ${faltan.join(', ')}.` });
    }
    if (guia.peso_kg !== null && !(guia.peso_kg > 0)) {
      return res.status(400).json({ error: 'El peso debe ser un número mayor que 0.' });
    }
    if (guia.valor_declarado !== null && !(guia.valor_declarado >= 0)) {
      return res.status(400).json({ error: 'El valor declarado debe ser un número.' });
    }

    // Reintenta si por casualidad el número aleatorio ya existe.
    let creada = null;
    let ultimoError = null;
    for (let intento = 0; intento < 5 && !creada; intento++) {
      const { data, error } = await supabaseAdmin
        .from('guias')
        .insert({
          ...guia,
          numero: generarNumeroGuia(),
          conductor_placa: conductor.placa,
          conductor_nombre: conductor.nombre,
          contrato_id: contratoId,
          estado: 'creada',
        })
        .select('id, numero')
        .single();
      if (!error) creada = data;
      else {
        ultimoError = error;
        if (error.code !== '23505') break; // 23505 = número repetido
      }
    }
    if (!creada) {
      return res.status(500).json({ error: 'No se pudo crear la guía: ' + (ultimoError?.message || 'error desconocido') });
    }

    await supabaseAdmin.from('guia_eventos').insert({
      guia_id: creada.id,
      estado: 'creada',
      ubicacion: guia.origen_ciudad,
      autor: 'conductor',
      autor_detalle: conductor.placa,
    });

    return res.status(201).json({ numero: creada.numero });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
