// Llama a las rutas /api/conductor/* y /api/auth/*.
//
// Ya NO manda la placa en una cabecera: la identidad viaja en la cookie
// de sesion firmada (httpOnly), que el navegador envia sola y que el
// JavaScript de la pagina no puede leer ni modificar.
export async function llamarApiConductor(ruta, opciones = {}) {
  let resp;
  try {
    resp = await fetch(ruta, {
      credentials: 'same-origin', // envia la cookie de sesion
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        ...(opciones.headers || {}),
      },
    });
  } catch {
    return { ok: false, status: 0, datos: { error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' } };
  }

  let datos = {};
  try { datos = await resp.json(); } catch { /* respuesta sin cuerpo */ }

  // Sesion vencida o invalida: limpia el rastro viejo y manda al login.
  if (resp.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('hurgo_rol');
    localStorage.removeItem('hurgo_placa');
  }

  return { ok: resp.ok, status: resp.status, datos };
}
