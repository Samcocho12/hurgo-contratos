// Llama a las rutas /api/jefe/* adjuntando el token de la sesion de
// Supabase Auth del coordinador. El servidor lo valida con service_role.
import { supabase } from './supabaseClient';

export async function llamarApiJefe(ruta, opciones = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) {
    return { ok: false, status: 401, datos: { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' } };
  }

  let resp;
  try {
    resp = await fetch(ruta, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opciones.headers || {}),
      },
    });
  } catch {
    return { ok: false, status: 0, datos: { error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' } };
  }

  let datos = {};
  try { datos = await resp.json(); } catch { /* sin cuerpo */ }

  return { ok: resp.ok, status: resp.status, datos };
}
