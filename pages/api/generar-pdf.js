import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ubicarZonaFirma } from '../../lib/ubicarFirma';
import { exigirConductor } from '../../lib/sesion';
import { registrar } from '../../lib/auditoria';
import { descargarArchivo, enlaceFirmado, BUCKET_FIRMADOS } from '../../lib/archivos';

function fechaColombia() {
  return new Date()
    .toLocaleString('es-CO', {
      timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    .replace(/[\u00A0\u202F]/g, ' '); // la fuente del PDF no admite espacios especiales
}

// PLANTILLA ANTERIOR (hoja vertical). Se mantiene por si llega un contrato viejo.
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
const NOMBRE_PLANTILLA = { x: 165, y: 236, anchoMax: 250 };
const CEDULA_PLANTILLA = { x: 171, y: 219, anchoMax: 160 };

// Dibuja texto en una sola línea, reduciendo el tamaño de letra si hace
// falta para que no se salga del ancho disponible de la línea.
function dibujarTextoAjustado(pagina, texto, { x, y, anchoMax }, font, colorTexto) {
  if (!texto) return;
  let size = 10;
  while (size > 6 && font.widthOfTextAtSize(texto, size) > anchoMax) size -= 0.5;
  pagina.drawText(texto, { x, y, size, font, color: colorTexto });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  res.setHeader('Cache-Control', 'no-store');

  // ---- GUARDIA 1: tiene que haber una sesion de conductor valida.
  // Antes esta ruta era publica: cualquiera podia estampar una firma
  // en cualquier contrato sin estar logueado.
  // exigirFuerte: firmar requiere huella o PIN, nunca el ingreso por placa.
  // Es lo que ata la firma a una persona y no a un dato publico.
  const sesion = await exigirConductor(req, res, { exigirFuerte: true });
  if (!sesion) return;

  const { contratoId, firmaPng } = req.body;
  if (!contratoId || !firmaPng) {
    return res.status(400).json({ error: 'Falta contratoId o firmaPng' });
  }

  // La firma tiene que ser una imagen PNG en base64, no cualquier cosa.
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(firmaPng)) {
    return res.status(400).json({ error: 'La firma no tiene un formato valido.' });
  }
  if (firmaPng.length > 2_000_000) {
    return res.status(413).json({ error: 'La firma es demasiado grande.' });
  }

  try {
    const { data: contrato, error: fetchError } = await supabaseAdmin
      .from('contratos')
      .select('*')
      .eq('id', contratoId)
      .single();
    if (fetchError || !contrato) throw new Error('Contrato no encontrado');

    // ---- GUARDIA 2: el contrato tiene que ser de ESTE conductor.
    if (contrato.conductor_placa !== sesion.placa) {
      await registrar(req, {
        actorTipo: 'conductor', actorId: sesion.placa,
        accion: 'firma_rechazada', objetivo: contratoId,
        detalle: { motivo: 'el contrato es de otra placa' },
      });
      return res.status(403).json({ error: 'Este contrato no te pertenece.' });
    }

    // ---- GUARDIA 3: un contrato firmado no se vuelve a firmar.
    if (contrato.estado === 'firmado') {
      return res.status(409).json({ error: 'Este contrato ya fue firmado.' });
    }

    // Trae la cédula guardada del conductor (vive en la tabla conductores, por placa)
    let cedulaConductor = '';
    if (contrato.conductor_placa) {
      const { data: conductorData } = await supabaseAdmin
        .from('conductores')
        .select('cedula')
        .eq('placa', contrato.conductor_placa)
        .maybeSingle();
      cedulaConductor = conductorData?.cedula || '';
    }

    const firmaBytes = Buffer.from(firmaPng.split(',')[1], 'base64');
    let pdfDoc;
    let font;

    if (contrato.contrato_original_url) {
      // Parte del PDF que subió el coordinador (la plantilla ya llena) y
      // coloca la firma directamente sobre el renglón "Firma:" del
      // conductor, en la última página — sin agregar hojas nuevas.
      // Se baja desde el servidor: el bucket es privado y no hay URL
      // publica que seguir.
      const originalBytes = await descargarArchivo(contrato.contrato_original_url);
      if (!originalBytes) throw new Error('No se pudo descargar el PDF original');
      pdfDoc = await PDFDocument.load(originalBytes);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const paginas = pdfDoc.getPages();
      const firmaImg = await pdfDoc.embedPng(firmaBytes);
      const gris = rgb(0.35, 0.35, 0.4);

      // Busca en el propio PDF la casilla de firma del conductor.
      const zona = await ubicarZonaFirma(originalBytes, paginas);

      if (zona) {
        const pagina = paginas[zona.indicePagina];

        // La firma ocupa casi todo el ancho disponible y puede bajar hasta
        // `pisoLibre`: así se ve del tamaño de una firma de verdad y no de un
        // sello diminuto perdido dentro del recuadro.
        const altoMax = zona.y + zona.alto - zona.pisoLibre;
        const escala = Math.min(
          (zona.ancho * 0.92) / firmaImg.width,
          altoMax / firmaImg.height
        );
        const anchoFirma = firmaImg.width * escala;
        const altoFirma = firmaImg.height * escala;

        // Se cuelga del borde de arriba de la casilla para no tocar el título.
        const yFirma = zona.y + zona.alto - altoFirma;
        pagina.drawImage(firmaImg, {
          x: zona.x + (zona.ancho - anchoFirma) / 2,
          y: yFirma,
          width: anchoFirma,
          height: altoFirma,
        });

        // Sello de firma electrónica, donde la plantilla deje sitio.
        if (zona.sello) {
          const s = zona.sello.size;
          const ySello = Math.min(zona.sello.y, yFirma - s - 2);
          pagina.drawText('Firmado electrónicamente', {
            x: zona.sello.x, y: ySello, size: s, font, color: gris,
          });
          pagina.drawText(`${fechaColombia()} · Placa ${contrato.conductor_placa || ''}`, {
            x: zona.sello.x, y: ySello - s - 1, size: s, font, color: gris,
          });
        }
      } else {
        // Plantilla anterior (hoja vertical): coordenadas fijas en la última página.
        const ultimaPagina = paginas[paginas.length - 1];
        const { width: anchoPagina } = ultimaPagina.getSize();
        const escala = Math.min(
          FIRMA_PLANTILLA.anchoMax / firmaImg.width,
          FIRMA_PLANTILLA.altoMax / firmaImg.height
        );
        const factorAncho = anchoPagina / 612;
        const colorTexto = rgb(0.1, 0.1, 0.15);
        dibujarTextoAjustado(
          ultimaPagina, contrato.conductor_nombre || '',
          { x: NOMBRE_PLANTILLA.x * factorAncho, y: NOMBRE_PLANTILLA.y, anchoMax: NOMBRE_PLANTILLA.anchoMax },
          font, colorTexto
        );
        dibujarTextoAjustado(
          ultimaPagina, cedulaConductor,
          { x: CEDULA_PLANTILLA.x * factorAncho, y: CEDULA_PLANTILLA.y, anchoMax: CEDULA_PLANTILLA.anchoMax },
          font, colorTexto
        );
        ultimaPagina.drawImage(firmaImg, {
          x: FIRMA_PLANTILLA.x * factorAncho,
          y: FIRMA_PLANTILLA.yLinea,
          width: firmaImg.width * escala,
          height: firmaImg.height * escala,
        });
        ultimaPagina.drawText(
          `Firmado electrónicamente el ${fechaColombia()} · Placa ${contrato.conductor_placa || ''}`,
          { x: FIRMA_PLANTILLA.x * factorAncho, y: FIRMA_PLANTILLA.yLinea - 20, size: 6.5, font, color: gris }
        );
      }
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
      page.drawText(`Firmado el: ${fechaColombia()}`, { x: 50, y, size: 10, font });
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

    // ---- El SERVIDOR marca la firma. Antes lo hacia el navegador con la
    // anon key, asi que cualquiera podia poner un contrato en 'firmado'.
    const { error: updError } = await supabaseAdmin
      .from('contratos')
      .update({
        estado: 'firmado',
        firma_png: firmaPng,
        pdf_firmado_url: rutaArchivo,   // la ruta; el enlace se firma al pedirlo
        firmado_en: new Date().toISOString(),
      })
      .eq('id', contrato.id)
      .eq('estado', contrato.estado); // evita doble firma simultanea
    if (updError) throw updError;

    await registrar(req, {
      actorTipo: 'conductor', actorId: sesion.placa,
      accion: 'firma', objetivo: contrato.id,
      detalle: { titulo: contrato.titulo },
    });

    // Para que el conductor vea su PDF recien firmado sin recargar.
    const enlace = await enlaceFirmado(rutaArchivo, BUCKET_FIRMADOS);
    return res.status(200).json({ ok: true, rutaArchivo: enlace || rutaArchivo });
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
