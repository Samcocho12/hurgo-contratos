// ============================================================
// POST /api/auth/ingresar   { placa, nombre? }
//
// Ingreso del conductor. Emite la cookie de sesion firmada que
// reemplaza a localStorage + la cabecera x-hurgo-placa.
//
// NIVEL ACTUAL: valida que la placa exista y este activa. Es la
// misma fuerza que el login de hoy (debil a proposito: esta etapa
// solo MUEVE la sesion a un mecanismo que el cliente no puede
// falsificar, sin cambiarle la experiencia al conductor).
//
// La sesion queda marcada { debil: true }. Cuando entren las
// passkeys, las rutas sensibles van a exigir debil === false y
// este camino quedara solo para quien aun no se ha enrolado.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { crearSesionConductor } from '../../../lib/sesion';
import { registrar, estaBloqueado, registrarFallo, limpiarFallos } from '../../../lib/auditoria';
import { normalizarPlaca } from '../../../lib/placa';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const placa = normalizarPlaca(String(req.body?.placa || ''));
  const nombre = String(req.body?.nombre || '').trim().slice(0, 120);

  if (placa.length < 5) {
    return res.status(400).json({ error: 'Escribe una placa valida.' });
  }

  const minutos = await estaBloqueado(placa);
  if (minutos) {
    return res.status(429).json({ error: `Demasiados intentos. Espera ${minutos} minuto(s).` });
  }

  const { data: conductor } = await supabaseAdmin
    .from('conductores')
    .select('placa, nombre, activo')
    .eq('placa', placa)
    .maybeSingle();

  if (!conductor || conductor.activo === false) {
    await registrarFallo(placa);
    await registrar(req, {
      actorTipo: 'conductor', actorId: placa, accion: 'ingreso_fallido',
    });
    return res.status(401).json({ error: 'Esta placa no esta registrada. Habla con tu coordinador.' });
  }

  // Si el conductor completa su nombre la primera vez, se guarda.
  if (nombre && !conductor.nombre) {
    await supabaseAdmin.from('conductores').update({ nombre }).eq('placa', placa);
  }

  await limpiarFallos(placa);
  await crearSesionConductor(res, placa, { provisional: false, debil: true });
  await registrar(req, { actorTipo: 'conductor', actorId: placa, accion: 'ingreso_ok' });

  return res.status(200).json({
    ok: true,
    conductor: { placa: conductor.placa, nombre: nombre || conductor.nombre || '' },
  });
}
