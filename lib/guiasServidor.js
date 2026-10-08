// SOLO para pages/api/** (usa la service_role).
import { supabaseAdmin } from './supabaseAdmin';
import { leerSesion } from './sesion';

// Identifica al conductor por la COOKIE DE SESION FIRMADA.
//
// ANTES: leia la placa de la cabecera x-hurgo-placa, que el cliente
// manda y por tanto puede inventar. Cualquiera podia pedir las guias
// de cualquier placa desde una terminal.
//
// AHORA: la placa sale de un token firmado con SESION_SECRET que el
// servidor emitio. El navegador no puede fabricarlo ni modificarlo.
//
// Sigue exigiendo contrato firmado para habilitar guias.
export async function autenticarConductor(req) {
  const sesion = await leerSesion(req);

  if (!sesion || sesion.rol !== 'conductor' || sesion.provisional) {
    return { status: 401, error: 'Tu sesión se cerró. Vuelve a ingresar con tu placa.' };
  }

  const placa = sesion.placa;

  const { data: conductor } = await supabaseAdmin
    .from('conductores')
    .select('placa, nombre, activo, aprobado')
    .eq('placa', placa)
    .maybeSingle();

  if (!conductor) {
    return { status: 401, error: 'Esta placa no está registrada. Vuelve a ingresar.' };
  }
  if (conductor.activo === false) {
    return { status: 403, error: 'Tu acceso está desactivado. Habla con tu coordinador.' };
  }
  if (conductor.aprobado === false) {
    return {
      status: 403,
      error: 'Tu registro está esperando la confirmación de tu coordinador.',
      pendienteAprobacion: true,
    };
  }

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id')
    .eq('conductor_placa', placa)
    .eq('estado', 'firmado')
    .order('firmado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!contrato) {
    return { status: 403, error: 'Las guías se activan cuando firmes tu contrato.' };
  }

  return { conductor, sesion };
}

export function textoLimpio(valor, max = 120) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}
