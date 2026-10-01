// ============================================================
// Configuracion de WebAuthn (passkeys) y manejo del "reto".
//
// El reto es un numero al azar que el servidor manda y que el celular
// tiene que firmar. Se guarda en una cookie httpOnly firmada con
// vigencia de 5 minutos: asi no hace falta tabla de sesiones y el
// cliente no puede inventarse uno.
// ============================================================
import { SignJWT, jwtVerify } from 'jose';

const SECRETO = new TextEncoder().encode(process.env.SESION_SECRET);

export const COOKIE_RETO = 'hurgo_reto';
export const NOMBRE_APP = 'Hurgo Transporte';

// Dominio donde viven las passkeys. Si la app cambia de dominio,
// TODOS los conductores tienen que volver a enrolar la huella.
export const RP_ID = process.env.WEBAUTHN_RP_ID || 'hurgo-contratos.vercel.app';

// Origenes aceptados. El de la web, y el de la app Android instalada
// desde Play (la TWA se presenta con android:apk-key-hash:...).
// ANDROID_ORIGIN se configura cuando tengas el SHA-256 de Play Console.
export function origenesPermitidos() {
  const lista = [`https://${RP_ID}`];
  if (process.env.ANDROID_ORIGIN) lista.push(process.env.ANDROID_ORIGIN);
  return lista;
}

// ------------------------------------------------------------
// Cookie del reto
// ------------------------------------------------------------
export async function guardarReto(res, { reto, placa, tipo }) {
  const token = await new SignJWT({ reto, placa, tipo })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(SECRETO);

  const cookie = [
    `${COOKIE_RETO}=${encodeURIComponent(token)}`,
    'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=300',
  ].join('; ');

  const previas = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(previas) ? previas : [previas]), cookie]);
}

export async function leerReto(req, tipoEsperado) {
  const raw = req.headers.cookie || '';
  const par = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_RETO}=`));
  if (!par) return null;

  try {
    const { payload } = await jwtVerify(decodeURIComponent(par.slice(COOKIE_RETO.length + 1)), SECRETO);
    if (payload.tipo !== tipoEsperado) return null;
    return payload;
  } catch {
    return null; // vencido o manipulado
  }
}

export function borrarReto(res) {
  const cookie = `${COOKIE_RETO}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  const previas = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(previas) ? previas : [previas]), cookie]);
}

// ------------------------------------------------------------
// Conversion de llaves para guardar en texto (base64url)
// ------------------------------------------------------------
export const aBase64Url = (bytes) => Buffer.from(bytes).toString('base64url');
export const deBase64Url = (texto) => new Uint8Array(Buffer.from(texto, 'base64url'));

// Etiqueta legible del celular, para que el coordinador sepa cual es.
export function etiquetaDispositivo(userAgent = '') {
  const ua = String(userAgent);
  const m = ua.match(/\(([^;)]+);?\s*([^;)]*)/);
  if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad';
  if (/Android/i.test(ua)) {
    const modelo = ua.match(/Android[^;]*;\s*([^;)]+)/);
    return modelo ? modelo[1].trim().slice(0, 60) : 'Android';
  }
  return (m?.[1] || 'Dispositivo').trim().slice(0, 60);
}
