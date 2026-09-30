import 'server-only';

/**
 * Archivos adjuntos de los mensajes (solicitudes de cotización): tipos
 * permitidos, límites y validación por la firma real del archivo.
 */

/** Tope del envío completo: el cuerpo de una función de Vercel admite 4,5 MB. */
export const ADJUNTOS_MAXIMO = 4 * 1024 * 1024;
export const ADJUNTOS_CANTIDAD = 3;

export type Adjunto = { ruta: string; nombre: string; tipo: string; tamano: number };

type Tipo = { ext: string; mime: string };

const ZIP: Record<string, Tipo> = {
  docx: { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
};
const OLE: Record<string, Tipo> = {
  doc: { ext: 'doc', mime: 'application/msword' },
  xls: { ext: 'xls', mime: 'application/vnd.ms-excel' },
};

/**
 * Tipo real por la firma del archivo: PDF, JPG, PNG, Word y Excel. Los de
 * Office comparten firma (ZIP u OLE), así que en ellos manda la extensión.
 */
export function tipoAdjunto(bytes: Uint8Array, nombre: string): Tipo | null {
  const empieza = (...firma: number[]) => firma.every((b, i) => bytes[i] === b);
  const ext = nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (empieza(0x25, 0x50, 0x44, 0x46)) return { ext: 'pdf', mime: 'application/pdf' };
  if (empieza(0xff, 0xd8, 0xff)) return { ext: 'jpg', mime: 'image/jpeg' };
  if (empieza(0x89, 0x50, 0x4e, 0x47)) return { ext: 'png', mime: 'image/png' };
  if (empieza(0x50, 0x4b, 0x03, 0x04)) return ZIP[ext] ?? null;
  if (empieza(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return OLE[ext] ?? null;
  return null;
}

/** Nombre seguro para guardar y descargar (sin tildes, espacios ni rutas). */
export function nombreSeguro(nombre: string, ext: string): string {
  const base = nombre
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'adjunto'}.${ext}`;
}

export const pesoLegible = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
