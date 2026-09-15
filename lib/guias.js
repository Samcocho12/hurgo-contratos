// Utilidades compartidas del módulo de guías (servidor y navegador).

export const ESTADOS_GUIA = {
  creada:     { label: 'Guía creada', corto: 'Creada',     publico: 'Recibimos los datos de tu envío. Pronto pasaremos a recogerlo.' },
  recogiendo: { label: 'Recogiendo',  corto: 'Recogiendo', publico: 'El conductor está cargando tu envío.' },
  en_camino:  { label: 'En camino',   corto: 'En camino',  publico: 'Tu envío va en camino a la ciudad de destino.' },
  entregada:  { label: 'Entregado',   corto: 'Entregado',  publico: 'Tu envío fue entregado.' },
  cancelada:  { label: 'Cancelada',   corto: 'Cancelada',  publico: 'Esta guía fue cancelada.' },
};

// Los pasos que se dibujan en la "carretera" de progreso.
export const PASOS_RUTA = ['creada', 'recogiendo', 'en_camino', 'entregada'];
export const ESTADOS_FINALES = ['entregada', 'cancelada'];

// Los 3 estados que marca el conductor (en orden).
export const ESTADOS_CONDUCTOR = ['recogiendo', 'en_camino', 'entregada'];

// Solo se puede avanzar: el nuevo estado debe ir después del actual.
export function esAvanceValido(estadoActual, estadoNuevo) {
  return PASOS_RUTA.indexOf(estadoNuevo) > PASOS_RUTA.indexOf(estadoActual);
}

// Paso de la ruta en el que va la guía, según el último evento "de ruta".
export function pasoActual(eventos = []) {
  const orden = [...eventos].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
  let paso = 0;
  for (const e of orden) {
    const i = PASOS_RUTA.indexOf(e.estado);
    if (i >= 0) paso = i;
  }
  return paso;
}

export function nombreRuta(ruta) {
  if (!ruta) return '';
  const trayecto = `${ruta.origen_ciudad} › ${ruta.destino_ciudad}`;
  return ruta.nombre ? `${trayecto} · ${ruta.nombre}` : trayecto;
}

// "hg 1234-5678 90" -> "HG1234567890". Si escriben solo los dígitos, se agrega HG.
export function normalizarNumeroGuia(valor) {
  const limpio = String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^\d+$/.test(limpio)) return 'HG' + limpio;
  return limpio;
}

export function esNumeroGuiaValido(numero) {
  return /^HG\d{10}$/.test(numero);
}

// "HG1234567890" -> "HG 1234 5678 90" (solo para mostrar)
export function formatearNumeroGuia(numero) {
  const n = normalizarNumeroGuia(numero);
  const digitos = n.slice(2);
  return `${n.slice(0, 2)} ${digitos.replace(/(\d{4})(?=\d)/g, '$1 ')}`.trim();
}

export function formatearFecha(iso, conHora = true) {
  if (!iso) return '—';
  const opciones = { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' };
  if (conHora) Object.assign(opciones, { hour: 'numeric', minute: '2-digit' });
  return new Date(iso).toLocaleString('es-CO', opciones);
}

export function formatearFechaCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export function formatearPesos(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  return Number(valor).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

// "carlos andrés restrepo" -> "Carlos A." (para mostrar al público)
export function enmascararNombre(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (partes.length === 1) return cap(partes[0]);
  return `${cap(partes[0])} ${partes[1].charAt(0).toUpperCase()}.`;
}

export function telefonoParaWhatsApp(telefono) {
  const d = String(telefono || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) return '57' + d; // celular colombiano
  return d;
}

export function urlRastreo(numero) {
  const origen = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origen}/rastreo/${numero}`;
}

export function linkWhatsAppRastreo({ numero, destinatarioNombre, destinatarioTelefono }) {
  const primerNombre = String(destinatarioNombre || '').trim().split(/\s+/)[0] || '';
  const texto =
    `Hola${primerNombre ? ' ' + primerNombre : ''}, te enviamos un paquete con Hurgo Transporte. ` +
    `Tu número de guía es ${formatearNumeroGuia(numero)}. ` +
    `Puedes seguirlo aquí: ${urlRastreo(numero)}`;
  const tel = telefonoParaWhatsApp(destinatarioTelefono);
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
