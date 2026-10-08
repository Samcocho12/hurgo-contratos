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

// Sube un PDF al almacenamiento usando un permiso firmado que emite el
// servidor. El archivo va directo a Supabase (las rutas de Next tienen
// limite de tamano) pero sin que el navegador tenga ninguna llave.
export async function subirPdf(archivo, carpeta) {
  if (!archivo) return { ok: false, error: 'No seleccionaste ningún archivo.' };
  if (archivo.type !== 'application/pdf') {
    return { ok: false, error: 'El archivo debe ser un PDF.' };
  }

  const permiso = await llamarApiJefe('/api/jefe/archivos', {
    method: 'POST',
    body: JSON.stringify({ nombre: archivo.name, carpeta }),
  });
  if (!permiso.ok) {
    return { ok: false, error: permiso.datos?.error || 'No se pudo preparar la subida.' };
  }

  const { signedUrl, ruta } = permiso.datos;

  try {
    const resp = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: archivo,
    });
    if (!resp.ok) return { ok: false, error: 'No se pudo subir el PDF. Intenta de nuevo.' };
  } catch {
    return { ok: false, error: 'Sin conexión al subir el PDF.' };
  }

  return { ok: true, ruta };
}
