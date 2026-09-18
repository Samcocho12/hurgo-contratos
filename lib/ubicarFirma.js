// SOLO servidor. Busca dentro del PDF el bloque "POR EL VINCULADO" y
// devuelve dónde poner la firma del conductor.
//
// Plantilla actual (manifiesto + contrato, hojas horizontales a dos columnas):
//
//   P O R  E L  V I N C U L A D O ,
//                                        <- aquí va la firma
//   ______________________________       <- línea de firma
//   Firma
//   Nombre completo: ...                 <- el texto que buscamos
//   Documento de identidad: ...
//
// Todas las distancias son relativas a "Nombre completo:", así la firma
// queda bien aunque el bloque cambie de página o de posición.

// Medidas tomadas de la plantilla (en puntos PDF).
export const MEDIDAS_BLOQUE = {
  lineaSobreNombre: 14.2, // la línea de firma está 14.2 pt arriba de la base de "Nombre completo"
  anchoLinea: 105,
  cruceLinea: 3.5,        // la firma baja un poco sobre la línea, como una firma a mano
  altoMax: 15,            // alto máximo, sin tocar el título "POR EL VINCULADO"
  separacionSello: 5,     // espacio entre el fin de la línea y el sello de firma electrónica
};

// Posición de "Nombre completo:" en la plantilla actual, por si no se puede leer el texto.
const RESPALDO_HORIZONTAL = { x: 400.9, y: 575.3 };

let pdfjs = null;
function cargarPdfjs() {
  if (pdfjs) return pdfjs;
  // El worker se carga en el mismo proceso (no hay hilos en el servidor).
  require('pdfjs-dist/legacy/build/pdf.worker.js');
  pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  return pdfjs;
}

const compacto = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

// Devuelve { indicePagina, x, y } con la base de "Nombre completo:" del vinculado, o null.
export async function buscarBloqueVinculado(pdfBytes) {
  try {
    const lib = cargarPdfjs();
    const doc = await lib.getDocument({
      data: new Uint8Array(pdfBytes).slice(), // copia: pdf-lib sigue usando el original
      disableFontFace: true,
      isEvalSupported: false,
      verbosity: 0,
    }).promise;

    // Se busca desde la última página: el bloque de firmas está al final.
    for (let n = doc.numPages; n >= 1; n--) {
      const pagina = await doc.getPage(n);
      const { items } = await pagina.getTextContent();
      const textos = items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));

      const titulos = textos.filter((t) => compacto(t.str).includes('VINCULADO'));
      const nombres = textos.filter((t) => compacto(t.str).startsWith('NOMBRECOMPLETO'));

      for (const nombre of nombres) {
        // El "Nombre completo" correcto tiene el título "POR EL VINCULADO" encima, en la misma columna.
        const tieneTitulo = titulos.some(
          (t) => Math.abs(t.x - nombre.x) < 20 && t.y > nombre.y && t.y - nombre.y < 45
        );
        if (tieneTitulo) {
          await doc.destroy();
          return { indicePagina: n - 1, x: nombre.x, y: nombre.y };
        }
      }
    }
    await doc.destroy();
  } catch (err) {
    console.error('No se pudo leer el texto del PDF para ubicar la firma:', err);
  }
  return null;
}

export function ubicacionRespaldo(pagina, indicePagina) {
  const { width, height } = pagina.getSize();
  if (width > height) return { indicePagina, ...RESPALDO_HORIZONTAL };
  return null; // hoja vertical: plantilla anterior
}
