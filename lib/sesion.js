// ============================================================
// Sesiones del lado del servidor.
// El navegador NUNCA guarda el rol ni la placa: todo viaja en
// cookies httpOnly firmadas que el cliente no puede leer ni editar.
// ============================================================
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { supabaseAdmin } from './supabaseAdmin';

const SECRETO = new TextEncoder().encode(process.env.SESION_SECRET);

export const COOKIE_SESION = 'hurgo_sesion';
export const COOKIE_DISPOSITIVO = 'hurgo_dispositivo';
export const COOKIE_COORD_EQUIPO = 'hurgo_equipo';

const DIAS_SESION = 30;
const DIAS_DISPOSITIVO = 730; // 2 anios

if (!process.env.SESION_SECRET) {
  console.warn('Falta SESION_SECRET. Genera una con: openssl rand -base64 48');
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
export function hashToken(valor) {
  return crypto.createHash('sha256').update(valor).digest('hex');
}

export function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim() || null;
}

function leerCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(
    raw.split(';').map((c) => {
      const i = c.indexOf('=');
      return i < 0 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
    }).filter(([k]) => k)
  );
}

function armarCookie(nombre, valor, maxAgeSegundos) {
  const partes = [
    `${nombre}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSegundos}`,
  ];
  return partes.join('; ');
}

function agregarCookie(res, cookie) {
  const previas = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(previas) ? previas : [previas]), cookie]);
}

// ------------------------------------------------------------
// Sesion de conductor
// ------------------------------------------------------------
export async function crearSesionConductor(res, placa, { provisional = false, debil = false } = {}) {
  const token = await new SignJWT({ rol: 'conductor', placa, provisional, debil })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(provisional ? '15m' : `${DIAS_SESION}d`)
    .sign(SECRETO);

  agregarCookie(res, armarCookie(
    COOKIE_SESION,
    token,
    provisional ? 900 : DIAS_SESION * 86400
  ));
}

export function cerrarSesion(res) {
  agregarCookie(res, armarCookie(COOKIE_SESION, '', 0));
}

// Lee y valida la sesion. Devuelve null si no hay o es invalida.
export async function leerSesion(req) {
  const token = leerCookies(req)[COOKIE_SESION];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRETO);
    return payload;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Vinculacion de dispositivo
// El PIN solo se acepta desde un dispositivo registrado aqui.
// ------------------------------------------------------------
export async function vincularDispositivo(req, res, placa, etiqueta) {
  const cookies = leerCookies(req);
  let idDispositivo = cookies[COOKIE_DISPOSITIVO];

  if (!idDispositivo) {
    idDispositivo = crypto.randomUUID();
    agregarCookie(res, armarCookie(COOKIE_DISPOSITIVO, idDispositivo, DIAS_DISPOSITIVO * 86400));
  }

  const token_hash = hashToken(idDispositivo);

  const { data: existente } = await supabaseAdmin
    .from('dispositivos')
    .select('id')
    .eq('token_hash', token_hash)
    .eq('conductor_placa', placa)
    .maybeSingle();

  if (existente) {
    await supabaseAdmin
      .from('dispositivos')
      .update({ ultimo_uso: new Date().toISOString(), revocado: false })
      .eq('id', existente.id);
    return { nuevo: false };
  }

  await supabaseAdmin.from('dispositivos').insert({
    conductor_placa: placa,
    token_hash,
    etiqueta: (etiqueta || '').slice(0, 120),
    ultimo_uso: new Date().toISOString(),
  });

  return { nuevo: true };
}

// ¿A que placa esta vinculado ESTE celular? (null si no lo esta)
// Permite reconocer al conductor sin que escriba nada.
export async function placaDelDispositivo(req) {
  const idDispositivo = leerCookies(req)[COOKIE_DISPOSITIVO];
  if (!idDispositivo) return null;

  const { data } = await supabaseAdmin
    .from('dispositivos')
    .select('conductor_placa')
    .eq('token_hash', hashToken(idDispositivo))
    .eq('revocado', false)
    .order('ultimo_uso', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.conductor_placa || null;
}

// ¿Este navegador es un dispositivo vinculado y vigente de esa placa?
export async function dispositivoAutorizado(req, placa) {
  const idDispositivo = leerCookies(req)[COOKIE_DISPOSITIVO];
  if (!idDispositivo) return false;

  const { data } = await supabaseAdmin
    .from('dispositivos')
    .select('id, revocado')
    .eq('token_hash', hashToken(idDispositivo))
    .eq('conductor_placa', placa)
    .maybeSingle();

  return Boolean(data && !data.revocado);
}

// ------------------------------------------------------------
// Guardias para usar al inicio de cada ruta /api/
// ------------------------------------------------------------

// Conductor con sesion COMPLETA (no provisional).
// exigirFuerte: true -> solo pasa si se autentico con passkey o PIN,
// no con el ingreso debil por placa. Usar en acciones sensibles (firmar).
export async function exigirConductor(req, res, { exigirFuerte = false } = {}) {
  const sesion = await leerSesion(req);
  if (!sesion || sesion.rol !== 'conductor' || sesion.provisional) {
    res.status(401).json({ error: 'Sesion no valida. Vuelve a ingresar.' });
    return null;
  }
  if (exigirFuerte && sesion.debil) {
    res.status(403).json({
      error: 'Para esta accion debes ingresar con tu huella o tu PIN.',
      requiereFuerte: true,
    });
    return null;
  }
  return sesion;
}

// ------------------------------------------------------------
// Coordinador
// ------------------------------------------------------------

// Lee el nivel de autenticacion del token de Supabase. aal2 = ya paso
// el codigo de la app de autenticacion en esta sesion.
function nivelDelToken(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8')
    );
    return payload.aal || 'aal1';
  } catch {
    return 'aal1';
  }
}

// ¿Este computador ya confirmo el codigo antes y sigue vigente?
export async function equipoDeConfianza(req, usuarioId) {
  const id = leerCookies(req)[COOKIE_COORD_EQUIPO];
  if (!id) return false;

  const { data } = await supabaseAdmin
    .from('coordinador_dispositivos')
    .select('id, expira_en, revocado')
    .eq('token_hash', hashToken(id))
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (!data || data.revocado) return false;
  if (new Date(data.expira_en) < new Date()) return false;

  await supabaseAdmin
    .from('coordinador_dispositivos')
    .update({ ultimo_uso: new Date().toISOString() })
    .eq('id', data.id);

  return true;
}

// Marca este computador como de confianza por N dias.
export async function confiarEquipo(req, res, usuario, dias = 90) {
  let id = leerCookies(req)[COOKIE_COORD_EQUIPO];
  if (!id) {
    id = crypto.randomUUID();
    agregarCookie(res, armarCookie(COOKIE_COORD_EQUIPO, id, dias * 86400));
  }

  const expira = new Date(Date.now() + dias * 86400_000).toISOString();
  const token_hash = hashToken(id);

  const { data: existente } = await supabaseAdmin
    .from('coordinador_dispositivos')
    .select('id')
    .eq('token_hash', token_hash)
    .maybeSingle();

  if (existente) {
    await supabaseAdmin
      .from('coordinador_dispositivos')
      .update({
        usuario_id: usuario.id, correo: usuario.email,
        expira_en: expira, revocado: false,
        ultimo_uso: new Date().toISOString(),
      })
      .eq('id', existente.id);
    return;
  }

  await supabaseAdmin.from('coordinador_dispositivos').insert({
    usuario_id: usuario.id,
    correo: usuario.email,
    token_hash,
    etiqueta: (req.headers['user-agent'] || '').slice(0, 120),
    ip: ipDe(req),
    expira_en: expira,
    ultimo_uso: new Date().toISOString(),
  });
}

// Coordinador autenticado con Supabase Auth (token Bearer).
//
// Si tiene la verificacion en dos pasos activa, exige que la sesion
// venga de haber puesto el codigo (aal2) o que este computador ya la
// haya confirmado antes.
export async function exigirCoordinador(req, res, { permitirSinVerificar = false } = {}) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'No autorizado.' });
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Sesion expirada. Vuelve a iniciar sesion.' });
    return null;
  }

  const usuario = data.user;
  if (permitirSinVerificar) return usuario;

  // ¿Tiene segundo factor configurado y confirmado?
  const factores = (usuario.factors || []).filter((f) => f.status === 'verified');
  if (factores.length === 0) return usuario;   // aun no lo ha activado

  if (nivelDelToken(token) === 'aal2') return usuario;
  if (await equipoDeConfianza(req, usuario.id)) return usuario;

  res.status(403).json({
    error: 'Confirma el código de tu app de autenticación para continuar.',
    requiereCodigo: true,
  });
  return null;
}
