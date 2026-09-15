// Llama a las rutas /api/conductor/* enviando la placa guardada en el navegador.
export async function llamarApiConductor(ruta, opciones = {}) {
  const placa = typeof window !== 'undefined' ? localStorage.getItem('hurgo_placa') || '' : '';
  let resp;
  try {
    resp = await fetch(ruta, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        'x-hurgo-placa': placa,
        ...(opciones.headers || {}),
      },
    });
  } catch {
    return { ok: false, status: 0, datos: { error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' } };
  }
  let datos = {};
  try { datos = await resp.json(); } catch { /* respuesta sin cuerpo */ }
  return { ok: resp.ok, status: resp.status, datos };
}
