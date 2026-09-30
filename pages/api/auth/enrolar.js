// ============================================================
// POST /api/auth/enrolar   { placa, codigo }
//
// Canjea el codigo de un solo uso que entrego el coordinador.
// Devuelve una sesion PROVISIONAL de 15 minutos, que solo sirve
// para registrar la passkey y definir el PIN. No da acceso a
// contratos hasta que el enrolamiento se complete.
// ============================================================
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { crearSesionConductor, vincularDispositivo } from '../../../lib/sesion';
import { registrar, estaBloqueado, registrarFallo, limpiarFallos } from '../../../lib/auditoria';
import { normalizarPlaca } from '../../../lib/placa';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const placa = normalizarPlaca(req.body?.placa || '');
  const codigo = String(req.body?.codigo || '').trim();

  if (!placa || !codigo) {
    return res.status(400).json({ error: 'Falta la placa o el codigo.' });
  }

  // Bloqueo por intentos fallidos
  const minutosBloqueo = await estaBloqueado(placa);
  if (minutosBloqueo) {
    return res.status(429).json({
      error: `Demasiados intentos. Espera ${minutosBloqueo} minuto(s) e intenta de nuevo.`,
    });
  }

  const { data: conductor } = await supabaseAdmin
    .from('conductores')
    .select('placa, nombre, activo, enrolamiento_hash, enrolamiento_expira')
    .eq('placa', placa)
    .maybeSingle();

  // Mensaje identico en todos los fallos: no revelamos si la placa existe.
  const generico = 'Placa o codigo incorrecto. Pide un codigo nuevo a tu coordinador.';

  if (!conductor || !conductor.activo || !conductor.enrolamiento_hash) {
    await registrarFallo(placa);
    await registrar(req, {
      actorTipo: 'conductor', actorId: placa,
      accion: 'enrolamiento_fallido', detalle: { motivo: 'sin codigo vigente' },
    });
    return res.status(401).json({ error: generico });
  }

  if (new Date(conductor.enrolamiento_expira) < new Date()) {
    await registrar(req, {
      actorTipo: 'conductor', actorId: placa, accion: 'enrolamiento_fallido',
      detalle: { motivo: 'codigo vencido' },
    });
    return res.status(401).json({ error: 'El codigo vencio. Pide uno nuevo a tu coordinador.' });
  }

  const valido = await bcrypt.compare(codigo, conductor.enrolamiento_hash);
  if (!valido) {
    const bloqueo = await registrarFallo(placa);
    await registrar(req, {
      actorTipo: 'conductor', actorId: placa, accion: 'enrolamiento_fallido',
      detalle: { motivo: 'codigo incorrecto' },
    });
    return res.status(401).json({
      error: bloqueo ? `Codigo incorrecto. Espera ${bloqueo} minuto(s).` : generico,
    });
  }

  // QUEMA el codigo: un solo uso, no se puede repetir.
  await supabaseAdmin
    .from('conductores')
    .update({ enrolamiento_hash: null, enrolamiento_expira: null })
    .eq('placa', placa);

  await limpiarFallos(placa);
  await vincularDispositivo(req, res, placa, req.headers['user-agent']);
  await crearSesionConductor(res, placa, { provisional: true });

  await registrar(req, {
    actorTipo: 'conductor', actorId: placa, accion: 'enrolamiento_ok',
  });

  return res.status(200).json({ ok: true, nombre: conductor.nombre });
}
