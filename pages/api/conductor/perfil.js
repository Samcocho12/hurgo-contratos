// ============================================================
// /api/conductor/perfil   (conductor autenticado)
//
// GET   -> sus datos, su celular vinculado y como entra
// PATCH -> cambiar su PIN { pinActual, pinNuevo }
//
// No devuelve hashes ni permite cambiar nombre, cedula o placa: eso lo
// administra el coordinador.
// ============================================================
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { autenticarConductor } from '../../../lib/guiasServidor';
import { registrar } from '../../../lib/auditoria';

const LARGO_PIN = 4;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await autenticarConductor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { conductor } = auth;

  // ---------------------------------------------------------- GET
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('conductores')
      .select('placa, nombre, cedula, celular, creado_en, enrolado_en, pin_hash')
      .eq('placa', conductor.placa)
      .maybeSingle();

    const { data: passkeys } = await supabaseAdmin
      .from('passkeys')
      .select('dispositivo, creado_en, ultimo_uso')
      .eq('conductor_placa', conductor.placa);

    const { data: dispositivos } = await supabaseAdmin
      .from('dispositivos')
      .select('etiqueta, creado_en, ultimo_uso')
      .eq('conductor_placa', conductor.placa)
      .eq('revocado', false)
      .order('ultimo_uso', { ascending: false });

    return res.status(200).json({
      perfil: {
        placa: data?.placa,
        nombre: data?.nombre || '',
        cedula: data?.cedula || '',
        celular: data?.celular || '',
        desde: data?.creado_en,
        tienePin: Boolean(data?.pin_hash),
        huellas: (passkeys || []).length,
        dispositivos: dispositivos || [],
      },
    });
  }

  // ---------------------------------------------------------- PATCH
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const pinActual = String(req.body?.pinActual || '').trim();
  const pinNuevo = String(req.body?.pinNuevo || '').trim();
  const regla = new RegExp(`^\\d{${LARGO_PIN}}$`);

  if (!regla.test(pinNuevo)) {
    return res.status(400).json({ error: `El PIN nuevo debe tener ${LARGO_PIN} dígitos.` });
  }
  if (pinActual === pinNuevo) {
    return res.status(400).json({ error: 'El PIN nuevo tiene que ser distinto al actual.' });
  }

  const { data } = await supabaseAdmin
    .from('conductores')
    .select('pin_hash, cedula, celular, placa')
    .eq('placa', conductor.placa)
    .maybeSingle();

  // Si ya tenía PIN, hay que saberlo para cambiarlo.
  if (data?.pin_hash) {
    if (!(await bcrypt.compare(pinActual, data.pin_hash))) {
      await registrar(req, {
        actorTipo: 'conductor', actorId: conductor.placa, accion: 'pin_cambio_fallido',
      });
      return res.status(401).json({ error: 'El PIN actual no es correcto.' });
    }
  }

  // Mismas reglas que al definirlo la primera vez.
  const cola = (v) => String(v || '').replace(/\D/g, '').slice(-LARGO_PIN);
  if (/^(\d)\1+$/.test(pinNuevo)) {
    return res.status(400).json({ error: 'No uses el mismo dígito repetido.' });
  }
  if ('0123456789'.includes(pinNuevo) || '9876543210'.includes(pinNuevo)) {
    return res.status(400).json({ error: 'No uses dígitos consecutivos.' });
  }
  if ([cola(data?.cedula), cola(data?.celular), cola(data?.placa)].includes(pinNuevo)) {
    return res.status(400).json({ error: 'No uses datos tuyos como PIN.' });
  }

  const { error } = await supabaseAdmin
    .from('conductores')
    .update({ pin_hash: await bcrypt.hash(pinNuevo, 12) })
    .eq('placa', conductor.placa);

  if (error) return res.status(500).json({ error: 'No se pudo cambiar el PIN.' });

  await registrar(req, {
    actorTipo: 'conductor', actorId: conductor.placa, accion: 'pin_cambiado',
  });

  return res.status(200).json({ ok: true });
}
