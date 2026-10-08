// ============================================================
// Enlaces de archivos: siempre firmados y de vida corta.
//
// Antes se guardaba la URL publica del bucket, que sirve para siempre
// y a cualquiera que la tenga. Ahora se guarda solo la RUTA dentro del
// bucket y el enlace se firma en el momento en que alguien pide ver el
// documento, con unos minutos de vigencia.
//
// Las filas viejas guardaron la URL completa: parsearUbicacion las
// entiende igual, asi que no hay que migrar nada a mano.
// ============================================================
import { supabaseAdmin } from './supabaseAdmin';

export const BUCKET_ORIGINALES = 'contratos-originales';
export const BUCKET_FIRMADOS = 'contratos-firmados';
export const BUCKET_ANTICIPOS = 'anticipos';

// 10 minutos: alcanza de sobra para abrir o descargar un PDF, y un
// enlace reenviado por error deja de servir enseguida.
const VIGENCIA = 600;

// Acepta una ruta ("anexos/123-x.pdf") o una URL de Supabase, publica
// o firmada, y devuelve { bucket, ruta }.
export function parsearUbicacion(valor, bucketPorDefecto = BUCKET_ORIGINALES) {
  const texto = String(valor || '').trim();
  if (!texto) return null;

  if (!texto.startsWith('http')) {
    return { bucket: bucketPorDefecto, ruta: texto };
  }

  // .../storage/v1/object/public/<bucket>/<ruta>
  // .../storage/v1/object/sign/<bucket>/<ruta>?token=...
  const m = texto.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;

  try {
    return { bucket: m[1], ruta: decodeURIComponent(m[2]) };
  } catch {
    return { bucket: m[1], ruta: m[2] };
  }
}

// Devuelve un enlace firmado y de vida corta, o null si no se puede.
export async function enlaceFirmado(valor, bucketPorDefecto = BUCKET_ORIGINALES, segundos = VIGENCIA) {
  const ubicacion = parsearUbicacion(valor, bucketPorDefecto);
  if (!ubicacion) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(ubicacion.bucket)
    .createSignedUrl(ubicacion.ruta, segundos);

  if (error) {
    console.error('No se pudo firmar', ubicacion.bucket, ubicacion.ruta, error.message);
    return null;
  }
  return data?.signedUrl || null;
}

// Descarga el archivo desde el servidor, sin pasar por una URL publica.
export async function descargarArchivo(valor, bucketPorDefecto = BUCKET_ORIGINALES) {
  const ubicacion = parsearUbicacion(valor, bucketPorDefecto);
  if (!ubicacion) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(ubicacion.bucket)
    .download(ubicacion.ruta);

  if (error || !data) {
    console.error('No se pudo descargar', ubicacion.ruta, error?.message);
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

// Firma los enlaces de un contrato antes de mandarlo al navegador.
export async function firmarContrato(contrato) {
  if (!contrato) return contrato;

  const [original, firmado] = await Promise.all([
    contrato.contrato_original_url
      ? enlaceFirmado(contrato.contrato_original_url, BUCKET_ORIGINALES) : null,
    contrato.pdf_firmado_url
      ? enlaceFirmado(contrato.pdf_firmado_url, BUCKET_FIRMADOS) : null,
  ]);

  return {
    ...contrato,
    contrato_original_url: original,
    pdf_firmado_url: firmado,
  };
}

export async function firmarContratos(lista) {
  return Promise.all((lista || []).map(firmarContrato));
}

// Firma los enlaces de una lista con un campo de archivo (anexos, soportes).
export async function firmarAdjuntos(lista, campo = 'url', bucket = BUCKET_ORIGINALES) {
  return Promise.all((lista || []).map(async (fila) => ({
    ...fila,
    [campo]: fila[campo] ? await enlaceFirmado(fila[campo], bucket) : null,
  })));
}
