// SOLO para pages/api/** (usa la service_role).
import { supabaseAdmin } from './supabaseAdmin';
import { normalizarPlaca } from './placa';

// Identifica al conductor por la placa que manda la app (header x-hurgo-placa)
// y exige que tenga al menos un contrato firmado.
// (Las guías las crea coordinación; el conductor solo las consulta y cambia su estado.)
export async function autenticarConductor(req) {
  const placa = normalizarPlaca(String(req.headers['x-hurgo-placa'] || ''));
  if (placa.length < 5) {
    return { status: 401, error: 'Tu sesión se cerró. Vuelve a ingresar con tu placa.' };
  }

  const { data: conductor } = await supabaseAdmin
    .from('conductores')
    .select('placa, nombre')
    .eq('placa', placa)
    .maybeSingle();
  if (!conductor) {
    return { status: 401, error: 'Esta placa no está registrada. Vuelve a ingresar.' };
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

  return { conductor };
}

export function textoLimpio(valor, max = 120) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}
