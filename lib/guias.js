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

// La ruta de una guía es el título del contrato firmado.
export function nombreRuta(contrato) {
  return contrato?.titulo || contrato?.ruta_nombre || '';
}

// HG + 10 dígitos aleatorios (no consecutivos, para que no se puedan adivinar guías ajenas).
export function generarNumeroGuia() {
  const azar = new Uint32Array(10);
  globalThis.crypto.getRandomValues(azar);
  let digitos = String(1 + (azar[0] % 9));
  for (let i = 1; i < 10; i++) digitos += String(azar[i] % 10);
  return 'HG' + digitos;
}

const recortar = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Limpia y valida los datos del formulario de guía.
// Devuelve { guia } o { error }.
export function validarDatosGuia(b) {
  const guia = {
    remitente_nombre: recortar(b.remitente_nombre),
    remitente_telefono: recortar(b.remitente_telefono, 20) || null,
    origen_ciudad: recortar(b.origen_ciudad, 80),
    origen_direccion: recortar(b.origen_direccion, 200) || null,
    destinatario_nombre: recortar(b.destinatario_nombre),
    destinatario_telefono: recortar(b.destinatario_telefono, 20),
    destino_ciudad: recortar(b.destino_ciudad, 80),
    destino_direccion: recortar(b.destino_direccion, 200),
    contenido: recortar(b.contenido, 200),
    unidades: parseInt(b.unidades, 10),
    peso_kg: b.peso_kg === '' || b.peso_kg == null ? null : Number(String(b.peso_kg).replace(',', '.')),
    valor_declarado: b.valor_declarado === '' || b.valor_declarado == null
      ? null
      : Number(String(b.valor_declarado).replace(/\D/g, '')),
    observaciones: recortar(b.observaciones, 500) || null,
  };

  const faltan = [];
  if (!guia.remitente_nombre) faltan.push('nombre del remitente');
  if (!guia.origen_ciudad) faltan.push('ciudad de origen');
  if (!guia.destinatario_nombre) faltan.push('nombre del destinatario');
  if (guia.destinatario_telefono.replace(/\D/g, '').length < 7) faltan.push('celular del destinatario');
  if (!guia.destino_ciudad) faltan.push('ciudad de destino');
  if (!guia.destino_direccion) faltan.push('dirección de entrega');
  if (!guia.contenido) faltan.push('qué se envía');
  if (!Number.isInteger(guia.unidades) || guia.unidades < 1) faltan.push('unidades (mínimo 1)');
  if (faltan.length) return { error: `Revisa estos campos: ${faltan.join(', ')}.` };
  if (guia.peso_kg !== null && !(guia.peso_kg > 0)) return { error: 'El peso debe ser un número mayor que 0.' };
  if (guia.valor_declarado !== null && Number.isNaN(guia.valor_declarado)) {
    return { error: 'El valor declarado debe ser un número.' };
  }
  return { guia };
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
