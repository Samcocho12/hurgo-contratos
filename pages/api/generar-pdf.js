import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

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

    let pdfDoc;
    let font, fontBold;

    if (contrato.contrato_original_url) {
      // Parte del PDF que subió el coordinador y le agrega una página de firma al final
      const original = await fetch(contrato.contrato_original_url);
      if (!original.ok) throw new Error('No se pudo descargar el PDF original');
      const originalBytes = await original.arrayBuffer();
      pdfDoc = await PDFDocument.load(originalBytes);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    } else {
      // Sin PDF original: arma un documento simple desde el texto guardado
      pdfDoc = await PDFDocument.create();
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let page = pdfDoc.addPage([595, 842]);
      let y = 792;
      page.drawText(contrato.titulo, { x: 50, y, size: 16, font: fontBold });
      y -= 25;
      const lineas = envolverTexto(contrato.contenido || '', font, 11, 495);
      for (const linea of lineas) {
        if (y < 100) { page = pdfDoc.addPage([595, 842]); y = 792; }
        page.drawText(linea, { x: 50, y, size: 11, font });
        y -= 16;
      }
    }

    // Página final con la firma, agregada siempre al documento
    const sigPage = pdfDoc.addPage([595, 842]);
    let y = 792;
    sigPage.drawText('HURGO CONTRATOS · Constancia de firma', { x: 50, y, size: 12, font: fontBold, color: rgb(0.6, 0.2, 0.18) });
    y -= 40;
    sigPage.drawText(contrato.titulo, { x: 50, y, size: 14, font: fontBold });
    y -= 30;
    sigPage.drawText(`Conductor: ${contrato.conductor_nombre || ''}`, { x: 50, y, size: 11, font });
    y -= 18;
    sigPage.drawText(`Firmado el: ${new Date().toLocaleString('es-CO')}`, { x: 50, y, size: 11, font });
    y -= 30;

    const firmaBytes = Buffer.from(firmaPng.split(',')[1], 'base64');
    const firmaImg = await pdfDoc.embedPng(firmaBytes);
    const firmaDims = firmaImg.scale(0.35);
    sigPage.drawImage(firmaImg, { x: 50, y: y - firmaDims.height, width: firmaDims.width, height: firmaDims.height });
    sigPage.drawLine({
      start: { x: 50, y: y - firmaDims.height - 4 },
      end: { x: 250, y: y - firmaDims.height - 4 },
      thickness: 0.5, color: rgb(0.3, 0.3, 0.3),
    });
    sigPage.drawText('Firma del conductor', { x: 50, y: y - firmaDims.height - 16, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

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
