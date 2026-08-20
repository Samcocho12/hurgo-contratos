import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

// Coordenadas calibradas para la plantilla oficial de Hurgo Transporte
// ("Contrato de Vinculación Transitoria..."), medidas sobre el renglón
// "Firma:" de la sección "POR EL VINCULADO:" en la última página del
// documento (tamaño carta, 612x792pt). Si el equipo cambia la plantilla,
// estos números hay que recalibrarlos.
const FIRMA_PLANTILLA = {
  x: 85,        // inicio del renglón de firma
  anchoMax: 195, // ancho disponible del renglón (85 a ~290)
  yLinea: 201,   // altura de la línea, medida desde abajo de la página
  altoMax: 13,   // espacio disponible arriba de la línea sin chocar con "Documento de Identidad"
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { contratoId, firmaPng } = req.body;
  if (!contratoId || !firmaPng) {
    return res.status(400).json({ error: 'Falta contratoId o firmaPng' });
  }

  try {
    const { data: contrato, error: fetchError } = await supabaseAdmin
      .from('contratos')
      .select('*')
      .eq('id', contratoId)
      .single();
    if (fetchError || !contrato) throw new Error('Contrato no encontrado');

    const firmaBytes = Buffer.from(firmaPng.split(',')[1], 'base64');
    let pdfDoc;
    let font;

    if (contrato.contrato_original_url) {
      // Parte del PDF que subió el coordinador (la plantilla ya llena) y
      // coloca la firma directamente sobre el renglón "Firma:" del
      // conductor, en la última página — sin agregar hojas nuevas.
      const original = await fetch(contrato.contrato_original_url);
      if (!original.ok) throw new Error('No se pudo descargar el PDF original');
      const originalBytes = await original.arrayBuffer();
      pdfDoc = await PDFDocument.load(originalBytes);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const paginas = pdfDoc.getPages();
      const ultimaPagina = paginas[paginas.length - 1];
      const { width: anchoPagina } = ultimaPagina.getSize();

      const firmaImg = await pdfDoc.embedPng(firmaBytes);
      const escala = Math.min(
        FIRMA_PLANTILLA.anchoMax / firmaImg.width,
        FIRMA_PLANTILLA.altoMax / firmaImg.height
      );
      const anchoFirma = firmaImg.width * escala;
      const altoFirma = firmaImg.height * escala;

      // Si la plantilla es de tamaño distinto a carta (612pt de ancho),
      // ajusta proporcionalmente la posición horizontal.
      const factorAncho = anchoPagina / 612;

      ultimaPagina.drawImage(firmaImg, {
        x: FIRMA_PLANTILLA.x * factorAncho,
        y: FIRMA_PLANTILLA.yLinea,
        width: anchoFirma,
        height: altoFirma,
      });

      ultimaPagina.drawText(
        `Firmado electrónicamente el ${new Date().toLocaleString('es-CO')} · Placa ${contrato.conductor_placa || ''}`,
        { x: FIRMA_PLANTILLA.x * factorAncho, y: FIRMA_PLANTILLA.yLinea - 20, size: 6.5, font, color: rgb(0.4, 0.4, 0.4) }
      );
    } else {
      // Sin PDF original: arma un documento simple desde el texto guardado,
      // con la firma al final (caso de contratos sin plantilla).
      pdfDoc = await PDFDocument.create();
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let page = pdfDoc.addPage([595, 842]);
      let y = 792;
      page.drawText(contrato.titulo, { x: 50, y, size: 16, font: fontBold });
      y -= 25;
      const lineas = envolverTexto(contrato.contenido || '', font, 11, 495);
      for (const linea of lineas) {
        if (y < 150) { page = pdfDoc.addPage([595, 842]); y = 792; }
        page.drawText(linea, { x: 50, y, size: 11, font });
        y -= 16;
      }
      y -= 20;
      page.drawText(`Conductor: ${contrato.conductor_nombre || ''} · Placa: ${contrato.conductor_placa || ''}`, { x: 50, y, size: 10, font });
      y -= 14;
      page.drawText(`Firmado el: ${new Date().toLocaleString('es-CO')}`, { x: 50, y, size: 10, font });
      y -= 30;

      const firmaImg = await pdfDoc.embedPng(firmaBytes);
      const firmaDims = firmaImg.scale(0.35);
      page.drawImage(firmaImg, { x: 50, y: y - firmaDims.height, width: firmaDims.width, height: firmaDims.height });
      page.drawLine({
        start: { x: 50, y: y - firmaDims.height - 4 },
        end: { x: 250, y: y - firmaDims.height - 4 },
        thickness: 0.5, color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText('Firma del conductor', { x: 50, y: y - firmaDims.height - 16, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    }

    const pdfBytes = await pdfDoc.save();

    const rutaArchivo = `${contrato.id}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('contratos-firmados')
      .upload(rutaArchivo, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlFirmada } = await supabaseAdmin.storage
      .from('contratos-firmados')
      .createSignedUrl(rutaArchivo, 60 * 60 * 24 * 365);

    return res.status(200).json({ rutaArchivo: urlFirmada?.signedUrl || rutaArchivo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

function envolverTexto(texto, font, size, maxWidth) {
  const resultado = [];
  const parrafos = texto.split('\n');
  for (const parrafo of parrafos) {
    if (parrafo.trim() === '') { resultado.push(''); continue; }
    const palabras = parrafo.split(' ');
    let lineaActual = '';
    for (const palabra of palabras) {
      const prueba = lineaActual ? lineaActual + ' ' + palabra : palabra;
      if (font.widthOfTextAtSize(prueba, size) > maxWidth) {
        resultado.push(lineaActual);
        lineaActual = palabra;
      } else {
        lineaActual = prueba;
      }
    }
    if (lineaActual) resultado.push(lineaActual);
  }
  return resultado;
}
