import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * Hoja de Reclamación virtual (D.S. 011-2011-PCM, Anexo I). Se genera al
 * registrar el reclamo y se vuelve a generar al responderlo, ya con la
 * sección 4 completa.
 */

export type DatosHoja = {
  empresa: { razon_social: string; ruc: string; direccion: string; color: string };
  codigo: string;
  creado: Date;
  tipo: 'reclamo' | 'queja';
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  domicilio: string | null;
  /** «Distrito, Provincia, Departamento (ubigeo 000000)» */
  ubicacion: string | null;
  telefono: string | null;
  correo: string;
  menor_edad: boolean;
  apoderado: string | null;
  bien_tipo: 'producto' | 'servicio';
  monto: number | null;
  moneda: 'PEN' | 'USD';
  bien_descripcion: string;
  detalle: string;
  pedido: string;
  vence: Date;
  respuesta: string | null;
  respondido: Date | null;
};

const A4 = { ancho: 595.28, alto: 841.89 };
const MARGEN = 42;
const ANCHO_UTIL = A4.ancho - MARGEN * 2;

const tinta = rgb(0.07, 0.09, 0.08);
const gris = rgb(0.42, 0.45, 0.43);
const linea = rgb(0.83, 0.85, 0.83);
const fondo = rgb(0.96, 0.97, 0.96);

function hexARgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Las fuentes estándar del PDF solo cubren WinAnsi (latín occidental): los
 * acentos y la ñ entran, pero no emojis ni otros alfabetos. Lo que no se
 * pueda representar se sustituye para que nunca falle la generación.
 */
function apto(texto: string, fuente: PDFFont): string {
  const normal = texto
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\t/g, '  ');
  let salida = '';
  for (const c of normal) {
    if (c === '\n') {
      salida += c;
      continue;
    }
    try {
      fuente.encodeText(c);
      salida += c;
    } catch {
      salida += '?';
    }
  }
  return salida;
}

function partir(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) {
      lineas.push('');
      continue;
    }
    let actual = '';
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) {
        actual = prueba;
        continue;
      }
      if (actual) lineas.push(actual);
      // Palabra más ancha que la línea (una URL, por ejemplo): se corta.
      let resto = palabra;
      while (fuente.widthOfTextAtSize(resto, tam) > ancho) {
        let corte = resto.length;
        while (corte > 1 && fuente.widthOfTextAtSize(resto.slice(0, corte), tam) > ancho) corte--;
        lineas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      actual = resto;
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

const fechaHora = (d: Date) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

const fecha = (d: Date) =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);

export async function generarHoja(datos: DatosHoja): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Hoja de reclamación ${datos.codigo}`);
  doc.setAuthor(datos.empresa.razon_social);
  doc.setSubject('Libro de Reclamaciones');
  doc.setCreator('Portal Grupo Pacheco');
  doc.setProducer('Portal Grupo Pacheco');

  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const marca = hexARgb(datos.empresa.color);

  let pagina: PDFPage = doc.addPage([A4.ancho, A4.alto]);
  let y = A4.alto - MARGEN;

  const nuevaPagina = () => {
    pagina = doc.addPage([A4.ancho, A4.alto]);
    y = A4.alto - MARGEN;
    pagina.drawText(apto(`Hoja de reclamación ${datos.codigo} (continuación)`, normal), {
      x: MARGEN,
      y: y - 8,
      size: 8,
      font: normal,
      color: gris,
    });
    y -= 24;
  };

  const asegurar = (alto: number) => {
    if (y - alto < MARGEN + 12) nuevaPagina();
  };

  const texto = (t: string, x: number, yy: number, tam: number, fuente: PDFFont, color = tinta) =>
    pagina.drawText(apto(t, fuente), { x, y: yy, size: tam, font: fuente, color });

  // ------------------------------------------------------------ cabecera
  pagina.drawRectangle({ x: 0, y: A4.alto - 6, width: A4.ancho, height: 6, color: marca });

  const anchoCaja = 190;
  const xCaja = A4.ancho - MARGEN - anchoCaja;
  pagina.drawRectangle({
    x: xCaja,
    y: y - 74,
    width: anchoCaja,
    height: 74,
    borderColor: tinta,
    borderWidth: 1.2,
  });
  texto('LIBRO DE RECLAMACIONES', xCaja + 12, y - 18, 10.5, negrita);
  texto('HOJA DE RECLAMACIÓN', xCaja + 12, y - 32, 8.5, normal, gris);
  texto(`N.º ${datos.codigo}`, xCaja + 12, y - 50, 12, negrita, marca);
  texto(`Fecha: ${fechaHora(datos.creado)}`, xCaja + 12, y - 65, 8.5, normal);

  const anchoProveedor = xCaja - MARGEN - 16;
  let yp = y - 14;
  for (const l of partir(apto(datos.empresa.razon_social, negrita), negrita, 13, anchoProveedor)) {
    texto(l, MARGEN, yp, 13, negrita);
    yp -= 16;
  }
  texto(`RUC ${datos.empresa.ruc}`, MARGEN, yp - 2, 9, normal, gris);
  yp -= 14;
  for (const l of partir(apto(datos.empresa.direccion, normal), normal, 9, anchoProveedor)) {
    texto(l, MARGEN, yp - 2, 9, normal, gris);
    yp -= 12;
  }
  y = Math.min(y - 74, yp) - 22;

  // ------------------------------------------------------------ utilidades
  const seccion = (numero: string, titulo: string) => {
    asegurar(40);
    pagina.drawRectangle({ x: MARGEN, y: y - 18, width: ANCHO_UTIL, height: 20, color: tinta });
    texto(`${numero}. ${titulo}`, MARGEN + 8, y - 12, 9, negrita, rgb(1, 1, 1));
    y -= 26;
  };

  const anchoEtiqueta = 150;
  const campo = (etiqueta: string, valor: string) => {
    const lineas = partir(apto(valor || '—', normal), normal, 9.5, ANCHO_UTIL - anchoEtiqueta - 16);
    const rotulo = partir(apto(etiqueta, negrita), negrita, 8.5, anchoEtiqueta - 12);
    const alto = Math.max(lineas.length, rotulo.length, 1) * 13 + 8;
    asegurar(alto);
    pagina.drawLine({
      start: { x: MARGEN, y: y - alto + 4 },
      end: { x: MARGEN + ANCHO_UTIL, y: y - alto + 4 },
      thickness: 0.6,
      color: linea,
    });
    rotulo.forEach((l, i) => texto(l, MARGEN + 4, y - 9 - i * 13, 8.5, negrita, gris));
    lineas.forEach((l, i) => texto(l, MARGEN + anchoEtiqueta, y - 9 - i * 13, 9.5, normal));
    y -= alto;
  };

  const bloque = (titulo: string, contenido: string) => {
    asegurar(30);
    texto(titulo, MARGEN + 4, y - 9, 8.5, negrita, gris);
    y -= 16;
    const lineas = partir(apto(contenido || '—', normal), normal, 9.5, ANCHO_UTIL - 20);
    let i = 0;
    while (i < lineas.length) {
      // El recuadro se parte entre páginas si el texto es largo.
      const caben = Math.max(1, Math.floor((y - MARGEN - 30) / 13));
      const tramo = lineas.slice(i, i + caben);
      const alto = tramo.length * 13 + 12;
      pagina.drawRectangle({ x: MARGEN, y: y - alto, width: ANCHO_UTIL, height: alto, color: fondo });
      tramo.forEach((l, j) => texto(l, MARGEN + 10, y - 14 - j * 13, 9.5, normal));
      y -= alto + 10;
      i += tramo.length;
      if (i < lineas.length) nuevaPagina();
    }
  };

  const casilla = (x: number, marcada: boolean, rotulo: string) => {
    pagina.drawRectangle({ x, y: y - 11, width: 9, height: 9, borderColor: tinta, borderWidth: 0.9 });
    if (marcada) pagina.drawRectangle({ x: x + 2, y: y - 9, width: 5, height: 5, color: marca });
    texto(rotulo, x + 14, y - 9.5, 9.5, marcada ? negrita : normal);
  };

  // ------------------------------------------------------------ 1
  seccion('1', 'IDENTIFICACIÓN DEL CONSUMIDOR RECLAMANTE');
  campo('Nombre completo', datos.nombre);
  campo('Documento de identidad', `${datos.tipo_documento} ${datos.numero_documento}`);
  campo('Domicilio', datos.domicilio ?? '');
  if (datos.ubicacion) campo('Distrito, provincia y departamento', datos.ubicacion);
  campo('Teléfono', datos.telefono ?? '');
  campo('Correo electrónico', datos.correo);
  campo('Menor de edad', datos.menor_edad ? 'Sí' : 'No');
  if (datos.menor_edad) campo('Padre, madre o apoderado', datos.apoderado ?? '');
  y -= 10;

  // ------------------------------------------------------------ 2
  seccion('2', 'IDENTIFICACIÓN DEL BIEN CONTRATADO');
  asegurar(20);
  casilla(MARGEN + 4, datos.bien_tipo === 'producto', 'Producto');
  casilla(MARGEN + 90, datos.bien_tipo === 'servicio', 'Servicio');
  y -= 20;
  campo(
    'Monto reclamado',
    datos.monto != null
      ? `${datos.moneda === 'USD' ? 'US$' : 'S/'} ${datos.monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'No indicado',
  );
  bloque('Descripción', datos.bien_descripcion);

  // ------------------------------------------------------------ 3
  seccion('3', 'DETALLE DE LA RECLAMACIÓN Y PEDIDO DEL CONSUMIDOR');
  asegurar(40);
  casilla(MARGEN + 4, datos.tipo === 'reclamo', 'Reclamo');
  casilla(MARGEN + 90, datos.tipo === 'queja', 'Queja');
  y -= 16;
  for (const l of partir(
    apto(
      'Reclamo: disconformidad relacionada a los productos o servicios. Queja: disconformidad no relacionada a los productos o servicios; o malestar o descontento respecto a la atención al público.',
      normal,
    ),
    normal,
    7.5,
    ANCHO_UTIL - 8,
  )) {
    texto(l, MARGEN + 4, y - 7, 7.5, normal, gris);
    y -= 10;
  }
  y -= 8;
  bloque('Detalle', datos.detalle);
  bloque('Pedido del consumidor', datos.pedido);

  // ------------------------------------------------------------ 4
  seccion('4', 'OBSERVACIONES Y ACCIONES ADOPTADAS POR EL PROVEEDOR');
  if (datos.respuesta && datos.respondido) {
    campo('Respuesta comunicada el', fechaHora(datos.respondido));
    bloque('Respuesta', datos.respuesta);
  } else {
    campo('Estado', 'Pendiente de respuesta');
    campo('Plazo máximo de respuesta', `${fecha(datos.vence)} (15 días hábiles)`);
    y -= 6;
  }

  // ------------------------------------------------------------ constancia y leyendas
  // Se calcula la altura exacta del cierre para no saltar de página si cabe.
  const declaracion = partir(
    apto(
      `El consumidor declaró que la información consignada es verdadera y aceptó recibir la respuesta en el correo electrónico indicado. Hoja registrada por medio virtual el ${fechaHora(datos.creado)} (hora de Lima).`,
      normal,
    ),
    normal,
    8.5,
    ANCHO_UTIL,
  );
  const leyendas = [
    '* La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.',
    '* El proveedor deberá dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles improrrogables.',
  ].map((l) => partir(apto(l, normal), normal, 7.5, ANCHO_UTIL));
  const altoCierre = 4 + declaracion.length * 11.5 + 16 + leyendas.reduce((t, l) => t + l.length * 10 + 3, 0);
  asegurar(altoCierre);

  y -= 4;
  for (const l of declaracion) {
    texto(l, MARGEN, y - 8, 8.5, normal);
    y -= 11.5;
  }
  y -= 10;
  pagina.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + ANCHO_UTIL, y }, thickness: 0.6, color: linea });
  y -= 6;
  for (const lineas of leyendas) {
    for (const l of lineas) {
      texto(l, MARGEN, y - 8, 7.5, normal, gris);
      y -= 10;
    }
    y -= 3;
  }

  // Numeración de páginas
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    const pie = apto(`${datos.codigo} · Página ${i + 1} de ${paginas.length}`, normal);
    p.drawText(pie, {
      x: A4.ancho - MARGEN - normal.widthOfTextAtSize(pie, 7.5),
      y: MARGEN - 18,
      size: 7.5,
      font: normal,
      color: gris,
    });
  });

  return doc.save();
}
