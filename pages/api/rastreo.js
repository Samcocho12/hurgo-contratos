import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { enmascararNombre, esNumeroGuiaValido, normalizarNumeroGuia } from '../../lib/guias';

// Rastreo público: devuelve SOLO lo que un cliente necesita ver.
// Nunca expone teléfonos, direcciones, valores ni datos del conductor.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const numero = normalizarNumeroGuia(req.query.numero);
  if (!esNumeroGuiaValido(numero)) {
    return res.status(400).json({ error: 'El número de guía empieza por HG y tiene 10 dígitos.' });
  }

  const { data: guia, error } = await supabaseAdmin
    .from('guias')
    .select('id, numero, estado, origen_ciudad, destino_ciudad, destinatario_nombre, unidades, recibido_por, creado_en, entregado_en')
    .eq('numero', numero)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'No pudimos consultar la guía. Intenta de nuevo en un momento.' });
  if (!guia) {
    return res.status(404).json({ error: 'No encontramos una guía con ese número. Revisa que esté completo.' });
  }

  const { data: eventos } = await supabaseAdmin
    .from('guia_eventos')
    .select('estado, ubicacion, nota, creado_en')
    .eq('guia_id', guia.id)
    .order('creado_en', { ascending: false });

  return res.status(200).json({
    guia: {
      numero: guia.numero,
      estado: guia.estado,
      origen_ciudad: guia.origen_ciudad,
      destino_ciudad: guia.destino_ciudad,
      destinatario: enmascararNombre(guia.destinatario_nombre),
      unidades: guia.unidades,
      recibido_por: guia.recibido_por ? enmascararNombre(guia.recibido_por) : null,
      creado_en: guia.creado_en,
      entregado_en: guia.entregado_en,
    },
    eventos: eventos || [],
  });
}
