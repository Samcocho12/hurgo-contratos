// ============================================================
// POST /api/auth/registrar   { placa, nombre, cedula, celular }
//
// Registro inicial del conductor (primera vez que se ve esa placa).
//
// TRANSITORIO. Hoy el conductor se auto-registra, igual que antes,
// pero al menos: pasa por el servidor, se valida, se audita y no se
// puede sobrescribir un registro existente desde el navegador.
//
// En la fase de passkeys esto se reemplaza: el COORDINADOR registra
// al conductor y le entrega un codigo de enrolamiento. Mientras el
// auto-registro siga abierto, cualquiera que vea una placa en la
// calle puede crear ese conductor.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { crearSesionConductor } from '../../../lib/sesion';
import { registrar } from '../../../lib/auditoria';
import { normalizarPlaca } from '../../../lib/placa';

const soloDigitos = (v) => String(v || '').replace(/\D/g, '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const placa = normalizarPlaca(String(req.body?.placa || ''));
  const nombre = String(req.body?.nombre || '').trim().slice(0, 120);
  const cedula = soloDigitos(req.body?.cedula).slice(0, 15);
  const celular = soloDigitos(req.body?.celular).slice(0, 15);

  if (placa.length < 5) return res.status(400).json({ error: 'Ingresa la placa completa del vehiculo.' });
  if (nombre.length < 3) return res.status(400).json({ error: 'Escribe tu nombre completo.' });
  if (cedula.length < 6) return res.status(400).json({ error: 'Ingresa un numero de cedula valido.' });
  if (celular.length < 10) return res.status(400).json({ error: 'Ingresa un numero de celular valido.' });

  // Si la placa ya existe, NO se sobrescribe desde aqui.
  const { data: existente } = await supabaseAdmin
    .from('conductores')
    .select('placa')
    .eq('placa', placa)
    .maybeSingle();

  if (existente) {
    await registrar(req, {
      actorTipo: 'conductor', actorId: placa, accion: 'registro_duplicado',
    });
    return res.status(409).json({
      error: 'Esta placa ya esta registrada. Ingresa con ella o habla con tu coordinador.',
    });
  }

  const { error } = await supabaseAdmin
    .from('conductores')
    .insert({ placa, nombre, cedula, celular, activo: true });

  if (error) return res.status(500).json({ error: 'No se pudo completar el registro.' });

  await crearSesionConductor(res, placa, { provisional: false, debil: true });
  await registrar(req, { actorTipo: 'conductor', actorId: placa, accion: 'registro_nuevo' });

  return res.status(201).json({ ok: true, conductor: { placa, nombre } });
}
