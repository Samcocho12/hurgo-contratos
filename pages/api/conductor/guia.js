import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor } from '../../../lib/guiasServidor';
import { normalizarNumeroGuia } from '../../../lib/guias';

// GET ?numero=HG... -> detalle de una guía del conductor
//
// Solo lectura. Marcar el estado de una guía es del coordinador: el
// conductor consulta sus guías pero no las modifica.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { conductor } = auth;

  const numero = normalizarNumeroGuia(req.query.numero);

  const { data: guia, error } = await supabaseAdmin
    .from('guias')
    .select('*, guia_eventos(*)')
    .eq('numero', numero)
    .eq('conductor_placa', conductor.placa)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!guia) return res.status(404).json({ error: 'No encontramos esa guía entre las tuyas.' });

  const eventos = (guia.guia_eventos || [])
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
  delete guia.guia_eventos;
  return res.status(200).json({ guia, eventos });
}
