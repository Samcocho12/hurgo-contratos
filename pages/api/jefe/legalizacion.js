// ============================================================
// GET /api/jefe/legalizacion?id=<anticipo>
//
// Arma un PDF con la legalizacion completa de un anticipo: portada con
// el resumen y el cuadre, y una pagina por recibo con su descripcion y
// su valor encima de la foto.
//
// Sirve para archivar o mandar a contabilidad en un solo archivo, en
// vez de bajar foto por foto.
// ============================================================
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirCoordinador } from '../../../lib/sesion';
import { descargarArchivo, BUCKET_ANTICIPOS } from '../../../lib/archivos';
import { formatearPlaca } from '../../../lib/placa';

const NAVY = rgb(0.086, 0.129, 0.361);
const GRIS = rgb(0.42, 0.45, 0.52);
const VERDE = rgb(0.08, 0.45, 0.28);
const ROJO = rgb(0.72, 0.18, 0.2);

const A4 = [595, 842];
const MARGEN = 48;

// Helvetica solo sabe dibujar Latin-1. Un emoji o una comilla rara escrita
// por el conductor en la descripcion de un gasto tumbaba todo el PDF.
const ARREGLOS = [
  [/[     ​]/g, ' '],
  [/[‘’‚‛]/g, "'"],
  [/[“”„]/g, '"'],
  [/[‐-―]/g, '-'],
  [/…/g, '...'],
  [/[•●·]/g, '-'],
];

function limpiar(valor) {
  let t = String(valor ?? '').normalize('NFC');
  for (const [busca, pone] of ARREGLOS) t = t.replace(busca, pone);
  return t.replace(/[^\x20-\x7E¡-ÿ\n]/g, '');
}

const pesos = (v) =>
  limpiar('$' + Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 }));

const fecha = (d) => d
  ? limpiar(new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }))
  : '-';

// pdf-lib solo entiende PNG y JPG. Un HEIC o un webp se anotan como no
// incrustables en vez de romper el documento entero.
async function incrustar(pdf, bytes, nombre = '') {
  if (!bytes) return null;
  const esPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const esJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  try {
    if (esPng) return await pdf.embedPng(bytes);
    if (esJpg) return await pdf.embedJpg(bytes);
  } catch (e) {
    console.error('No se pudo incrustar', nombre, e.message);
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const coordinador = await exigirCoordinador(req, res);
  if (!coordinador) return;

  try {
    return await armarPdf(req, res);
  } catch (err) {
    // Sin esto, cualquier tropiezo armando el PDF salia como un 500 en HTML
    // y el panel solo podia decir "no se pudo", sin contar que paso.
    console.error('Legalizacion:', err);
    return res.status(500).json({ error: `No se pudo armar el PDF: ${err.message}` });
  }
}

async function armarPdf(req, res) {

  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'Falta el anticipo.' });

  const { data: anticipo } = await supabaseAdmin
    .from('anticipos')
    .select('*, anticipo_soportes(*)')
    .eq('id', id)
    .maybeSingle();

  if (!anticipo) return res.status(404).json({ error: 'Anticipo no encontrado.' });

  const soportes = (anticipo.anticipo_soportes || [])
    .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));

  const entregado = Number(anticipo.monto_aprobado || 0);
  const gastado = soportes.reduce((t, s) => t + Number(s.monto || 0), 0);
  const saldo = entregado - gastado;

  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ---------------------------------------------- portada
  const portada = pdf.addPage(A4);
  const ancho = A4[0];
  let y = A4[1] - MARGEN;

  portada.drawText('HURGO TRANSPORTE LOGISTICA', {
    x: MARGEN, y, size: 11, font: negrita, color: NAVY,
  });
  y -= 26;
  portada.drawText('Legalización de anticipo', {
    x: MARGEN, y, size: 20, font: negrita, color: NAVY,
  });
  y -= 14;
  portada.drawLine({
    start: { x: MARGEN, y }, end: { x: ancho - MARGEN, y },
    thickness: 1.5, color: rgb(0.78, 0.57, 0.16),
  });
  y -= 30;

  const dato = (etiqueta, valor) => {
    portada.drawText(limpiar(etiqueta), { x: MARGEN, y, size: 9, font: normal, color: GRIS });
    portada.drawText(limpiar(valor), {
      x: MARGEN + 150, y, size: 11, font: negrita, color: rgb(0.1, 0.1, 0.15),
    });
    y -= 22;
  };

  dato('Conductor', anticipo.conductor_nombre || '-');
  dato('Placa', formatearPlaca(anticipo.conductor_placa || ''));
  if (anticipo.destino) dato('Ruta', anticipo.destino);
  dato('Solicitado el', fecha(anticipo.creado_en));
  dato('Entregado el', fecha(anticipo.pagado_en));
  if (anticipo.referencia_pago) dato('Referencia', anticipo.referencia_pago);
  if (anticipo.revisado_por) dato('Aprobado por', anticipo.revisado_por);

  y -= 6;
  portada.drawText('Motivo', { x: MARGEN, y, size: 9, font: normal, color: GRIS });
  y -= 15;
  for (const linea of envolver(limpiar(anticipo.motivo || ''), normal, 11, ancho - MARGEN * 2)) {
    portada.drawText(linea, { x: MARGEN, y, size: 11, font: normal });
    y -= 15;
  }

  // ---- tabla de gastos
  y -= 18;
  portada.drawText('Gastos reportados', { x: MARGEN, y, size: 13, font: negrita, color: NAVY });
  y -= 18;

  if (soportes.length === 0) {
    portada.drawText('Sin soportes registrados.', { x: MARGEN, y, size: 10.5, font: normal, color: GRIS });
    y -= 18;
  } else {
    for (const s of soportes) {
      const desc = limpiar(s.descripcion).slice(0, 62);
      portada.drawText(desc, { x: MARGEN, y, size: 10.5, font: normal });
      const texto = pesos(s.monto);
      portada.drawText(texto, {
        x: ancho - MARGEN - negrita.widthOfTextAtSize(texto, 10.5),
        y, size: 10.5, font: negrita,
      });
      y -= 7;
      portada.drawLine({
        start: { x: MARGEN, y }, end: { x: ancho - MARGEN, y },
        thickness: 0.4, color: rgb(0.88, 0.9, 0.94),
      });
      y -= 13;
    }
  }

  // ---- cuadre
  y -= 10;
  const fila = (etiqueta, valor, font = normal, color = rgb(0.1, 0.1, 0.15)) => {
    portada.drawText(limpiar(etiqueta), { x: MARGEN, y, size: 11, font, color });
    const t = pesos(valor);
    portada.drawText(t, {
      x: ancho - MARGEN - font.widthOfTextAtSize(t, 11), y, size: 11, font, color,
    });
    y -= 18;
  };

  fila('Entregado', entregado);
  fila('Gastado', gastado);

  portada.drawLine({
    start: { x: MARGEN, y: y + 6 }, end: { x: ancho - MARGEN, y: y + 6 },
    thickness: 0.8, color: rgb(0.6, 0.63, 0.7),
  });
  y -= 4;

  const etiquetaSaldo = saldo === 0 ? 'Cuadra exacto'
    : saldo > 0 ? 'Saldo por devolver' : 'Excedido';
  fila(etiquetaSaldo, Math.abs(saldo), negrita,
    saldo === 0 ? VERDE : saldo > 0 ? NAVY : ROJO);

  // ---- pie
  portada.drawText(
    limpiar(`Documento generado el ${fecha(new Date())} - ${soportes.length} recibo(s)`),
    { x: MARGEN, y: MARGEN - 12, size: 8, font: normal, color: GRIS }
  );

  // ---------------------------------------------- una pagina por recibo
  for (const [i, s] of soportes.entries()) {
    const pagina = pdf.addPage(A4);
    let py = A4[1] - MARGEN;

    pagina.drawText(`Recibo ${i + 1} de ${soportes.length}`, {
      x: MARGEN, y: py, size: 9, font: normal, color: GRIS,
    });
    py -= 20;
    pagina.drawText(limpiar(s.descripcion) || 'Gasto', {
      x: MARGEN, y: py, size: 15, font: negrita, color: NAVY,
    });
    const valor = pesos(s.monto);
    pagina.drawText(valor, {
      x: ancho - MARGEN - negrita.widthOfTextAtSize(valor, 15),
      y: py, size: 15, font: negrita, color: NAVY,
    });
    py -= 22;

    const bytes = await descargarArchivo(s.archivo_url, BUCKET_ANTICIPOS);
    const imagen = await incrustar(pdf, bytes, s.descripcion);

    if (imagen) {
      const dispoAncho = ancho - MARGEN * 2;
      const dispoAlto = py - MARGEN;
      const escala = Math.min(dispoAncho / imagen.width, dispoAlto / imagen.height, 1);
      const w = imagen.width * escala;
      const h = imagen.height * escala;
      pagina.drawImage(imagen, {
        x: MARGEN + (dispoAncho - w) / 2,
        y: py - h,
        width: w, height: h,
      });
    } else {
      pagina.drawText(
        bytes
          ? 'El recibo está en un formato que no se puede mostrar aquí (PDF o HEIC).'
          : 'No se encontró el archivo del recibo.',
        { x: MARGEN, y: py - 20, size: 10.5, font: normal, color: GRIS }
      );
      pagina.drawText('Puedes verlo desde la app, en el anticipo.', {
        x: MARGEN, y: py - 36, size: 10.5, font: normal, color: GRIS,
      });
    }
  }

  const bytes = await pdf.save();
  const nombre = `legalizacion-${formatearPlaca(anticipo.conductor_placa || '')}-${
    new Date(anticipo.creado_en).toISOString().slice(0, 10)}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(Buffer.from(bytes));
}

// Parte un texto en lineas que caben en el ancho dado.
function envolver(texto, font, size, maxAncho) {
  const salida = [];
  for (const parrafo of String(texto).split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(' ')) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, size) > maxAncho) {
        if (linea) salida.push(linea);
        linea = palabra;
      } else {
        linea = prueba;
      }
    }
    if (linea) salida.push(linea);
  }
  return salida.slice(0, 6);
}
