// ============================================================
// GET /api/auth/estado
//
// Se llama al abrir /login. Reconoce el celular por la cookie de
// dispositivo y responde a quien pertenece, para que el conductor
// no tenga que escribir su placa nunca mas en ese telefono.
//
// La placa sale de la cookie que el servidor emitio, no de lo que
// escriba el usuario: ademas de comodo, es mas seguro.
// ============================================================
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { leerSesion, placaDelDispositivo } from '../../../lib/sesion';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  // ¿Ya hay una sesion abierta y fuerte? Entonces entra directo.
  const sesion = await leerSesion(req);
  if (sesion?.rol === 'conductor' && !sesion.provisional && !sesion.debil) {
    const { data } = await supabaseAdmin
      .from('conductores').select('nombre, activo').eq('placa', sesion.placa).maybeSingle();

    if (data && data.activo !== false) {
      return res.status(200).json({
        sesionActiva: true,
        placa: sesion.placa,
        nombre: data.nombre || '',
      });
    }
  }

  // Si no hay sesion, ¿reconocemos el celular?
  const placa = await placaDelDispositivo(req);
  if (!placa) return res.status(200).json({ reconocido: false });

  const { data: conductor } = await supabaseAdmin
    .from('conductores')
    .select('nombre, activo, pin_hash')
    .eq('placa', placa)
    .maybeSingle();

  if (!conductor || conductor.activo === false) {
    return res.status(200).json({ reconocido: false });
  }

  const { data: passkey } = await supabaseAdmin
    .from('passkeys')
    .select('id')
    .eq('conductor_placa', placa)
    .limit(1)
    .maybeSingle();

  return res.status(200).json({
    reconocido: true,
    placa,
    nombre: conductor.nombre || '',
    tieneHuella: Boolean(passkey),
    tienePin: Boolean(conductor.pin_hash),
  });
}
