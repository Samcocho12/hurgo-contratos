import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor, textoLimpio } from '../../../lib/guiasServidor';
import { ESTADOS_CONDUCTOR, ESTADOS_FINALES, esAvanceValido, normalizarNumeroGuia } from '../../../lib/guias';

// GET  ?numero=HG...  -> detalle de una guía del conductor
// POST { numero, estado, ubicacion, nota, recibido_por } -> registra un nuevo estado
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { conductor } = auth;

  const numero = normalizarNumeroGuia(req.method === 'GET' ? req.query.numero : req.body?.numero);

  const { data: guia, error } = await supabaseAdmin
    .from('guias')
    .select('*, guia_eventos(*), rutas(nombre, origen_ciudad, destino_ciudad)')
    .eq('numero', numero)
    .eq('conductor_placa', conductor.placa)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!guia) return res.status(404).json({ error: 'No encontramos esa guía entre las tuyas.' });

  if (req.method === 'GET') {
    const eventos = (guia.guia_eventos || []).sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
    delete guia.guia_eventos;
    return res.status(200).json({ guia, eventos });
  }

  if (req.method === 'POST') {
    const estado = String(req.body?.estado || '');
    const nota = textoLimpio(req.body?.nota, 300) || null;
    const recibidoPor = textoLimpio(req.body?.recibido_por, 120) || null;

    if (ESTADOS_FINALES.includes(guia.estado)) {
      return res.status(409).json({ error: 'Esta guía ya está cerrada y no se puede actualizar.' });
    }
    if (!ESTADOS_CONDUCTOR.includes(estado)) {
      return res.status(400).json({ error: 'Selecciona un estado válido.' });
    }
    if (!esAvanceValido(guia.estado, estado)) {
      return res.status(409).json({ error: 'Ese estado ya quedó marcado. Solo puedes avanzar.' });
    }
    if (estado === 'entregada' && !recibidoPor) {
      return res.status(400).json({ error: 'Escribe el nombre de quien recibió el envío.' });
    }

    const { error: insertError } = await supabaseAdmin.from('guia_eventos').insert({
      guia_id: guia.id,
      estado,
      ubicacion: estado === 'recogiendo' ? guia.origen_ciudad : estado === 'entregada' ? guia.destino_ciudad : null,
      nota,
      recibido_por: estado === 'entregada' ? recibidoPor : null,
      autor: 'conductor',
      autor_detalle: conductor.placa,
    });
    if (insertError) return res.status(500).json({ error: insertError.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
