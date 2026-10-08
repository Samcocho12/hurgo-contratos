// ============================================================
// GET /api/conductor/contratos          -> lista los contratos del conductor
// GET /api/conductor/contratos?id=UUID  -> devuelve UNO, si es suyo
//
// La placa NUNCA viene del cliente: sale de la cookie firmada.
// Asi no sirve de nada pedir el contrato de otro.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirConductor } from '../../../lib/sesion';
import { registrar } from '../../../lib/auditoria';
import { firmarContrato, firmarAdjuntos } from '../../../lib/archivos';

// Campos que puede ver el conductor. No se devuelve 'select(*)' para no
// filtrar columnas internas si algun dia se agregan.
const CAMPOS = 'id, titulo, contenido, estado, creado_en, visto_en, firmado_en, firma_png, pdf_firmado_url, contrato_original_url, conductor_nombre';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const sesion = await exigirConductor(req, res);
  if (!sesion) return;

  // Puerta de aprobacion: sin el visto bueno del coordinador no hay datos.
  const { data: estado } = await supabaseAdmin
    .from('conductores')
    .select('aprobado, nombre')
    .eq('placa', sesion.placa)
    .maybeSingle();

  if (!estado || estado.aprobado === false) {
    return res.status(403).json({
      error: 'Tu registro está esperando la confirmación de tu coordinador.',
      pendienteAprobacion: true,
    });
  }

  const { id } = req.query;

  // ---------- UNO SOLO ----------
  if (id) {
    const { data: contrato, error } = await supabaseAdmin
      .from('contratos')
      .select(CAMPOS + ', conductor_placa')
      .eq('id', id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!contrato) return res.status(404).json({ error: 'Contrato no encontrado.' });

    // La validacion que faltaba: ¿es suyo?
    if (contrato.conductor_placa !== sesion.placa) {
      await registrar(req, {
        actorTipo: 'conductor', actorId: sesion.placa,
        accion: 'acceso_denegado', objetivo: String(id),
        detalle: { motivo: 'contrato de otra placa' },
      });
      // 404 y no 403: no confirmamos que ese contrato exista.
      return res.status(404).json({ error: 'Contrato no encontrado.' });
    }

    // Primera vez que lo abre -> queda como visto.
    if (contrato.estado === 'pendiente') {
      await supabaseAdmin
        .from('contratos')
        .update({ estado: 'visto', visto_en: new Date().toISOString() })
        .eq('id', contrato.id)
        .eq('estado', 'pendiente');
      contrato.estado = 'visto';
    }

    // Anexos del contrato (solo se llega aqui si el contrato es suyo).
    const { data: anexos } = await supabaseAdmin
      .from('contrato_anexos')
      .select('*')
      .eq('contrato_id', contrato.id)
      .order('creado_en', { ascending: true });

    delete contrato.conductor_placa;

    // Los enlaces se firman aqui y duran minutos: no se guardan asi.
    const conEnlaces = await firmarContrato(contrato);
    const anexosFirmados = await firmarAdjuntos(anexos, 'url');

    return res.status(200).json({ contrato: { ...conEnlaces, anexos: anexosFirmados } });
  }

  // ---------- LISTA ----------
  const { data, error } = await supabaseAdmin
    .from('contratos')
    .select('id, titulo, estado, creado_en, firmado_en')
    .eq('conductor_placa', sesion.placa)
    .order('creado_en', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ contratos: data || [] });
}
