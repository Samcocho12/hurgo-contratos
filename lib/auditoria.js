// ============================================================
// Auditoria (append-only) y control de intentos fallidos.
// ============================================================
import { supabaseAdmin } from './supabaseAdmin';
import { ipDe } from './sesion';

export async function registrar(req, { actorTipo, actorId, accion, objetivo = null, detalle = null }) {
  try {
    await supabaseAdmin.from('auditoria').insert({
      actor_tipo: actorTipo,
      actor_id: actorId,
      accion,
      objetivo,
      ip: ipDe(req),
      user_agent: (req.headers['user-agent'] || '').slice(0, 300),
      detalle,
    });
  } catch (e) {
    // La auditoria nunca debe tumbar la operacion principal.
    console.error('No se pudo registrar auditoria:', e.message);
  }
}

// ------------------------------------------------------------
// Bloqueo creciente: 5 fallos seguidos y empieza a costar caro.
// ------------------------------------------------------------
const ESPERAS_MINUTOS = { 5: 1, 6: 5, 7: 15, 8: 60 };

export function tiempoBloqueo(intentos) {
  if (intentos < 5) return 0;
  return ESPERAS_MINUTOS[Math.min(intentos, 8)] ?? 60;
}

export async function estaBloqueado(placa) {
  const { data } = await supabaseAdmin
    .from('conductores')
    .select('bloqueado_hasta')
    .eq('placa', placa)
    .maybeSingle();

  if (!data?.bloqueado_hasta) return null;
  const hasta = new Date(data.bloqueado_hasta);
  if (hasta <= new Date()) return null;

  return Math.ceil((hasta - new Date()) / 60000); // minutos restantes
}

export async function registrarFallo(placa) {
  const { data } = await supabaseAdmin
    .from('conductores')
    .select('intentos_fallidos')
    .eq('placa', placa)
    .maybeSingle();

  const intentos = (data?.intentos_fallidos || 0) + 1;
  const minutos = tiempoBloqueo(intentos);

  await supabaseAdmin
    .from('conductores')
    .update({
      intentos_fallidos: intentos,
      bloqueado_hasta: minutos
        ? new Date(Date.now() + minutos * 60000).toISOString()
        : null,
    })
    .eq('placa', placa);

  return minutos;
}

export async function limpiarFallos(placa) {
  await supabaseAdmin
    .from('conductores')
    .update({ intentos_fallidos: 0, bloqueado_hasta: null })
    .eq('placa', placa);
}
