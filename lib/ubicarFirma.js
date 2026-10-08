// SOLO servidor. Lee el texto del PDF y devuelve la ZONA donde va la firma
// del conductor: un rectangulo en coordenadas de pdf-lib (origen abajo a la
// izquierda) mas el punto donde va el sello de "Firmado electronicamente".
//
// Reconoce los dos formatos que maneja la empresa:
//
//   1) Manifiesto electronico de carga (hoja horizontal). La firma va dentro
//      de la casilla del pie:
//
//        +------------------------------------------+
//        | Firma y Huella del CONDUCTOR o ACEPTACION|
//        |                                          |  <- aqui va la firma
//        +------------------------------------------+
//
//   2) Contrato de vinculacion (bloque "POR EL VINCULADO"):
//
//        P O R  E L  V I N C U L A D O ,
//                                        <- aqui va la firma
//        ______________________________  <- linea de firma
//        Firma
//        Nombre completo: ...            <- el texto que se busca
//
// Todo se mide con respecto al texto encontrado, no con numeros fijos: si el
// formato se mueve de pagina o de posicion, la firma se mueve con el.

// Margen interno de la casilla, para que la firma no toque los bordes.
const AIRE = 3;

let pdfjs = null;
function cargarPdfjs() {
  if (pdfjs) return pdfjs;
  // El worker se carga en el mismo proceso (no hay hilos en el servidor).
  require('pdfjs-dist/legacy/build/pdf.worker.js');
  pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  return pdfjs;
}

const compacto = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

// Encabezados de la casilla de firma del conductor, ya compactados.
const MARCAS_CASILLA = [
  'FIRMAYHUELLADELCONDUCTOR',
  'FIRMAYHUELLACONDUCTOR',
  'FIRMADELCONDUCTOR',
  'FIRMAYSELLODELCONDUCTOR',
  'FIRMAYHUELLADELCONDUCTOR2',
];

// Agrupa los pedacitos de texto en renglones (misma altura) y los ordena de
// izquierda a derecha. pdfjs entrega "Firma", "y", "Huella"... por separado.
function enRenglones(textos) {
  const renglones = [];
  for (const t of [...textos].sort((a, b) => b.y - a.y)) {
    const tolerancia = Math.max(2, t.alto * 0.4);
    const renglon = renglones.find((r) => Math.abs(r.y - t.y) <= tolerancia);
    if (renglon) {
      renglon.items.push(t);
      renglon.y = (renglon.y * (renglon.items.length - 1) + t.y) / renglon.items.length;
    } else {
      renglones.push({ y: t.y, items: [t] });
    }
  }
  for (const r of renglones) r.items.sort((a, b) => a.x - b.x);
  return renglones;
}

// Saca las rayas horizontales de la pagina (bordes de las casillas). Son las
// que permiten meter la firma DENTRO del recuadro y no encima del borde.
function rayasHorizontales(lib, ops) {
  const OPS = lib.OPS;
  const rayas = [];
  const guardar = (y, a, b) => {
    if (Math.abs(b - a) < 12) return; // una raya muy corta no es un borde
    rayas.push({ y, x1: Math.min(a, b), x2: Math.max(a, b) });
  };

  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== OPS.constructPath) continue;
    const [codigos, args] = ops.argsArray[i];
    let k = 0, cx = 0, cy = 0;
    for (const codigo of codigos) {
      if (codigo === OPS.rectangle) {
        const [x, y, w, h] = args.slice(k, k + 4); k += 4;
        guardar(y, x, x + w);          // borde inferior
        guardar(y + h, x, x + w);      // borde superior
        cx = x; cy = y;
      } else if (codigo === OPS.moveTo) {
        cx = args[k]; cy = args[k + 1]; k += 2;
      } else if (codigo === OPS.lineTo) {
        const x = args[k], y = args[k + 1]; k += 2;
        if (Math.abs(y - cy) < 0.8) guardar((y + cy) / 2, cx, x);
        cx = x; cy = y;
      } else if (codigo === OPS.curveTo) { k += 6; }
      else if (codigo === OPS.curveTo2 || codigo === OPS.curveTo3) { k += 4; }
    }
  }
  return rayas;
}

// Lee el texto (y los bordes) de todas las paginas una sola vez.
async function leerTexto(pdfBytes) {
  const lib = cargarPdfjs();
  const doc = await lib.getDocument({
    data: new Uint8Array(pdfBytes).slice(), // copia: pdf-lib sigue usando el original
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const { items } = await pagina.getTextContent();

    let rayas = [];
    try {
      rayas = rayasHorizontales(lib, await pagina.getOperatorList());
    } catch (err) {
      console.error('No se pudieron leer los bordes de la pagina', n, err.message);
    }

    paginas.push({
      rayas,
      textos: items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          ancho: it.width || 0,
          alto: it.height || 8,
        })),
    });
  }
  await doc.destroy();
  return paginas;
}

// ------------------------------------------------------------------
// Formato 1: casilla "Firma y Huella del CONDUCTOR"
// ------------------------------------------------------------------
function zonaEnCasilla(pagina, indicePagina) {
  for (const renglon of enRenglones(pagina.textos)) {
    // Se compacta el renglon entero guardando en que item empieza cada letra,
    // porque el encabezado viene partido en varias palabras sueltas.
    let plano = '';
    const origen = [];
    for (let i = 0; i < renglon.items.length; i++) {
      for (const c of compacto(renglon.items[i].str)) { plano += c; origen.push(i); }
    }

    for (const marca of MARCAS_CASILLA) {
      const pos = plano.indexOf(marca);
      if (pos === -1) continue;

      const primero = renglon.items[origen[pos]];
      // La casilla llega hasta donde termina el ultimo texto de ese renglon
      // que este a la derecha del encabezado ("o ACEPTACION DIGITAL").
      const derecha = renglon.items
        .filter((it) => it.x >= primero.x)
        .reduce((max, it) => Math.max(max, it.x + it.ancho), primero.x + primero.ancho);

      const cuerpo = primero.alto || 8;
      const bajoEncabezado = primero.y - cuerpo * 0.35;

      // Los bordes horizontales que cruzan esta columna por debajo del titulo:
      // el primero es la raya que separa el titulo del espacio para firmar y
      // el segundo es el piso de la casilla.
      const bordes = (pagina.rayas || [])
        .filter((r) => r.y < bajoEncabezado
          && r.x1 <= primero.x + 6 && r.x2 >= primero.x + 24)
        .map((r) => r.y)
        .sort((a, b) => b - a);

      const techo = (bordes.length ? Math.min(bordes[0], bajoEncabezado) : bajoEncabezado) - AIRE * 0.6;

      // Hasta donde se puede bajar: el siguiente borde, o el texto mas alto
      // que quede debajo dentro de la misma columna.
      const estorbos = pagina.textos
        .filter((it) => it.y < techo && it.x + it.ancho > primero.x && it.x < derecha)
        .map((it) => it.y + (it.alto || 8));

      const candidatos = [
        ...bordes.filter((y) => y < techo - 4).slice(0, 1).map((y) => y + AIRE * 0.6),
        ...(estorbos.length ? [Math.max(...estorbos) + AIRE] : []),
      ];
      const piso = candidatos.length ? Math.max(...candidatos) : techo - cuerpo * 2;

      const alto = Math.min(techo - piso, 46);
      if (alto < 7) continue; // casilla demasiado apretada: no es esta

      const anchoZona = Math.max(40, derecha - primero.x - AIRE * 2);
      const base = techo - alto;

      // Estas casillas son muy bajitas: una firma que cabe justo adentro se ve
      // diminuta. Si debajo del recuadro hay papel libre se la deja crecer un
      // poco hacia abajo, como una firma de puño y letra que pisa el renglon.
      const libreAbajo = Math.min(
        ...[
          ...(pagina.rayas || [])
            .filter((r) => r.y < base - 4 && r.x1 <= primero.x + 6 && r.x2 >= primero.x + 24)
            .map((r) => base - r.y),
          ...pagina.textos
            .filter((it) => it.y < base && it.x + it.ancho > primero.x && it.x < derecha)
            .map((it) => base - (it.y + (it.alto || 8))),
          60,
        ]
      );

      const haySitioParaSello = libreAbajo >= 24;
      const desborde = haySitioParaSello
        ? Math.min(alto * 0.8, 12)
        : Math.max(0, Math.min(alto * 0.8, libreAbajo - 2));

      return {
        indicePagina,
        x: primero.x + AIRE,
        y: base,
        ancho: anchoZona,
        alto,
        pisoLibre: base - desborde,
        sello: haySitioParaSello
          ? { x: primero.x, y: base - desborde - 8, size: 5 }
          : null,
      };
    }
  }
  return null;
}

// ------------------------------------------------------------------
// Formato 2: bloque "POR EL VINCULADO" + "Nombre completo:"
// ------------------------------------------------------------------
const BLOQUE = {
  lineaSobreNombre: 14.2, // la linea de firma esta 14.2 pt arriba de "Nombre completo"
  anchoLinea: 105,
  cruceLinea: 3.5,        // la firma baja un poco sobre la linea, como a mano
  altoMax: 15,            // sin tocar el titulo "POR EL VINCULADO"
  separacionSello: 5,
};

function zonaEnVinculado(pagina, indicePagina) {
  const titulos = pagina.textos.filter((t) => compacto(t.str).includes('VINCULADO'));
  const nombres = pagina.textos.filter((t) => compacto(t.str).startsWith('NOMBRECOMPLETO'));

  for (const nombre of nombres) {
    // El "Nombre completo" correcto tiene "POR EL VINCULADO" encima, en la misma columna.
    const tieneTitulo = titulos.some(
      (t) => Math.abs(t.x - nombre.x) < 20 && t.y > nombre.y && t.y - nombre.y < 45
    );
    if (!tieneTitulo) continue;

    const yLinea = nombre.y + BLOQUE.lineaSobreNombre;
    const base = yLinea - BLOQUE.cruceLinea;
    return {
      indicePagina,
      x: nombre.x,
      y: base,
      ancho: BLOQUE.anchoLinea,
      alto: BLOQUE.altoMax,
      // Debajo esta "Firma" y "Nombre completo": no hay papel que invadir.
      pisoLibre: base,
      sello: { x: nombre.x + BLOQUE.anchoLinea + BLOQUE.separacionSello, y: yLinea, size: 4.5 },
    };
  }
  return null;
}

// ------------------------------------------------------------------
// Si no se reconoce el formato: debajo de lo ultimo que haya escrito en la
// ultima pagina, a la derecha. Nunca arriba del documento.
// ------------------------------------------------------------------
function zonaDeRespaldo(pagina, indicePagina, ancho, alto) {
  const margen = Math.min(48, ancho * 0.07);
  const anchoZona = Math.min(220, ancho * 0.3);
  const x = ancho - margen - anchoZona;

  const ultimo = pagina && pagina.textos.length
    ? Math.min(...pagina.textos.map((t) => t.y))
    : alto * 0.25;

  const y = Math.max(margen + 14, Math.min(ultimo - 46, alto * 0.5));

  return {
    indicePagina,
    x,
    y,
    ancho: anchoZona,
    alto: 26,
    pisoLibre: y,
    sello: { x, y: y - 9, size: 5 },
  };
}

// ------------------------------------------------------------------
// Entrada principal. `paginasPdf` son las paginas de pdf-lib, solo para
// conocer el tamano de la hoja si hay que usar el respaldo.
// ------------------------------------------------------------------
export async function ubicarZonaFirma(pdfBytes, paginasPdf) {
  let paginas = null;
  try {
    paginas = await leerTexto(pdfBytes);
  } catch (err) {
    console.error('No se pudo leer el texto del PDF para ubicar la firma:', err);
  }

  if (paginas) {
    // Se busca desde la ultima pagina: el bloque de firmas esta al final.
    for (let i = paginas.length - 1; i >= 0; i--) {
      const zona = zonaEnCasilla(paginas[i], i) || zonaEnVinculado(paginas[i], i);
      if (zona) return zona;
    }
  }

  // No se reconocio nada. En las hojas horizontales se acomoda al final del
  // documento; en las verticales se devuelve null para que siga mandando la
  // plantilla antigua de contrato, que ademas imprime nombre y cedula.
  const indice = paginasPdf.length - 1;
  const { width, height } = paginasPdf[indice].getSize();
  if (width <= height) return null;

  return zonaDeRespaldo(paginas ? paginas[indice] : null, indice, width, height);
}
