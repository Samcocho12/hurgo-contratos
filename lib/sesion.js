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

// Coordinador autenticado con Supabase Auth (token Bearer).
export async function exigirCoordinador(req, res) {
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
  return data.user;
}
