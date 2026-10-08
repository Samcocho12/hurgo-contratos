// ============================================================
// PIN de respaldo (cuando la huella no funciona).
//
// POST /api/auth/pin  { accion: 'definir',   pin }
// POST /api/auth/pin  { accion: 'verificar', placa, pin }
//
// REGLA CENTRAL: el PIN SOLO se acepta desde un dispositivo ya
// vinculado. Desde un celular desconocido no sirve ni aunque sea
// correcto -> hay que pedir codigo nuevo al coordinador.
// Por eso 4 digitos son suficientes: no hay ataque remoto posible.
// ============================================================
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import {
  leerSesion, crearSesionConductor, dispositivoAutorizado,
} from '../../../lib/sesion';
import { registrar, estaBloqueado, registrarFallo, limpiarFallos } from '../../../lib/auditoria';
import { normalizarPlaca } from '../../../lib/placa';

const LARGO_PIN = 4; // cambiar a 6 aqui si algun dia lo quieren mas largo

// PINs que no se permiten: obvios o derivados de datos publicos.
function pinDebil(pin, { placa = '', cedula = '', celular = '' }) {
  if (/^(\d)\1+$/.test(pin)) return 'No uses el mismo digito repetido.';

  const asc = '0123456789';
  const desc = '9876543210';
  if (asc.includes(pin) || desc.includes(pin)) return 'No uses digitos consecutivos.';

  const prohibidos = ['1234', '0000', '1111', '2580', '1212', '4321'];
  if (prohibidos.includes(pin)) return 'Ese PIN es demasiado comun.';

  const cola = (v) => String(v || '').replace(/\D/g, '').slice(-LARGO_PIN);
  if (pin === cola(cedula)) return 'No uses los ultimos digitos de tu cedula.';
  if (pin === cola(celular)) return 'No uses los ultimos digitos de tu celular.';
  if (pin === cola(placa)) return 'No uses los digitos de tu placa.';

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const { accion } = req.body || {};

  // --------------------------------------------------------
  // DEFINIR: requiere sesion (provisional del enrolamiento o completa)
  // --------------------------------------------------------
  if (accion === 'definir') {
    const sesion = await leerSesion(req);
    if (!sesion || sesion.rol !== 'conductor') {
      return res.status(401).json({ error: 'Sesion no valida.' });
    }

    const pin = String(req.body?.pin || '').trim();
    if (!new RegExp(`^\\d{${LARGO_PIN}}$`).test(pin)) {
      return res.status(400).json({ error: `El PIN debe tener ${LARGO_PIN} digitos.` });
    }

    const { data: conductor } = await supabaseAdmin
      .from('conductores')
      .select('placa, cedula, celular')
      .eq('placa', sesion.placa)
      .maybeSingle();

    if (!conductor) return res.status(404).json({ error: 'Conductor no encontrado.' });

    const debil = pinDebil(pin, conductor);
    if (debil) return res.status(400).json({ error: debil });

    await supabaseAdmin
      .from('conductores')
      .update({ pin_hash: await bcrypt.hash(pin, 12), enrolado_en: new Date().toISOString() })
      .eq('placa', sesion.placa);

    // El enrolamiento quedo completo: sesion plena.
    await crearSesionConductor(res, sesion.placa, { provisional: false });
    await registrar(req, { actorTipo: 'conductor', actorId: sesion.placa, accion: 'pin_definido' });

    return res.status(200).json({ ok: true });
  }

  // --------------------------------------------------------
  // VERIFICAR: entrar con PIN desde el celular vinculado
  // --------------------------------------------------------
  if (accion === 'verificar') {
    const placa = normalizarPlaca(req.body?.placa || '');
    const pin = String(req.body?.pin || '').trim();
    if (!placa || !pin) return res.status(400).json({ error: 'Falta la placa o el PIN.' });

    // Puerta principal: sin dispositivo vinculado, el PIN no existe.
    if (!(await dispositivoAutorizado(req, placa))) {
      await registrar(req, {
        actorTipo: 'conductor', actorId: placa, accion: 'pin_rechazado',
        detalle: { motivo: 'dispositivo no vinculado' },
      });
      return res.status(403).json({
        error: 'Este celular no esta autorizado para esta placa. Pide un codigo a tu coordinador.',
        requiereEnrolamiento: true,
      });
    }

    const minutosBloqueo = await estaBloqueado(placa);
    if (minutosBloqueo) {
      return res.status(429).json({ error: `Demasiados intentos. Espera ${minutosBloqueo} minuto(s).` });
    }

    const { data: conductor } = await supabaseAdmin
      .from('conductores')
      .select('pin_hash, activo')
      .eq('placa', placa)
      .maybeSingle();

    if (!conductor?.activo || !conductor.pin_hash) {
      return res.status(401).json({ error: 'PIN incorrecto.' });
    }

    if (!(await bcrypt.compare(pin, conductor.pin_hash))) {
      const bloqueo = await registrarFallo(placa);
      await registrar(req, { actorTipo: 'conductor', actorId: placa, accion: 'pin_fallido' });
      return res.status(401).json({
        error: bloqueo ? `PIN incorrecto. Espera ${bloqueo} minuto(s).` : 'PIN incorrecto.',
      });
    }

    await limpiarFallos(placa);
    await crearSesionConductor(res, placa, { provisional: false });
    await registrar(req, { actorTipo: 'conductor', actorId: placa, accion: 'login_pin' });

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Accion no reconocida.' });
}
