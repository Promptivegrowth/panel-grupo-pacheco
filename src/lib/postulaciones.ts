import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseServicio } from '@/lib/supabase/servicio';
import { EMPRESAS, type EmpresaUI } from '@/lib/empresas';
import { enviarCorreo, plantilla, escaparHtml as esc } from '@/lib/correo';
import { fechaLima, aISO } from '@/lib/reclamos/plazos';
import type { Empresa } from '@/lib/reclamos/servicio';

/**
 * Postulaciones a «Trabaja con nosotros»: validación del CV, registro y
 * avisos. El CV se guarda en el bucket privado `postulaciones`.
 */

/** Tope del CV: el cuerpo de una función de Vercel admite hasta 4,5 MB. */
export const CV_MAXIMO = 4 * 1024 * 1024;

export const ESTADOS = ['nueva', 'revisada', 'preseleccionada', 'descartada'] as const;
export type EstadoPostulacion = (typeof ESTADOS)[number];

export const NOMBRE_ESTADO: Record<EstadoPostulacion, string> = {
  nueva: 'Nueva',
  revisada: 'Revisada',
  preseleccionada: 'Preseleccionada',
  descartada: 'Descartada',
};

export const TONO_ESTADO: Record<EstadoPostulacion, 'marca' | 'neutro' | 'ok' | 'peligro'> = {
  nueva: 'marca',
  revisada: 'neutro',
  preseleccionada: 'ok',
  descartada: 'peligro',
};

export const ESPONTANEA = 'Postulación espontánea';

type TipoCv = { ext: 'pdf' | 'doc' | 'docx'; mime: string };

/**
 * Tipo real del archivo por su firma (no por la extensión que diga el
 * navegador): PDF, Word 97-2003 o Word moderno.
 */
export function tipoCv(bytes: Uint8Array, nombre: string): TipoCv | null {
  const empieza = (...firma: number[]) => firma.every((b, i) => bytes[i] === b);
  if (empieza(0x25, 0x50, 0x44, 0x46)) return { ext: 'pdf', mime: 'application/pdf' };
  if (empieza(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return { ext: 'doc', mime: 'application/msword' };
  // Un .docx es un ZIP; se exige además la extensión para no aceptar cualquier ZIP.
  if (empieza(0x50, 0x4b, 0x03, 0x04) && /\.docx$/i.test(nombre)) {
    return { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  return null;
}

export type NuevaPostulacion = {
  empleo_id: string | null;
  puesto: string | null;
  area_interes: string | null;
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  correo: string;
  telefono: string;
  ubigeo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  estudios: string;
  carrera: string | null;
  experiencia: string;
  experiencia_bpm: boolean;
  disponibilidad: string;
  pretension: number | null;
  linkedin: string | null;
  presentacion: string | null;
};

type Vacante = { id: string; titulo: string; correo_postulacion: string };

/** La vacante debe ser de la empresa, estar publicada y no haber cerrado. */
async function vacanteVigente(empresaId: string, id: string | null): Promise<Vacante | null> {
  if (!id) return null;
  const { data } = await supabaseServicio()
    .from('empleos')
    .select('id, titulo, correo_postulacion, publicado, fecha_cierre')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle();
  if (!data?.publicado) return null;
  if (data.fecha_cierre && data.fecha_cierre < aISO(fechaLima())) return null;
  return data;
}

const ui = (id: string): EmpresaUI => EMPRESAS[id as EmpresaUI['id']];

const nombreArchivo = (nombre: string, ext: string) =>
  `CV-${nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}.${ext}`;

export async function registrarPostulacion(
  empresa: Empresa,
  datos: NuevaPostulacion,
  cv: { bytes: Uint8Array; tipo: TipoCv },
  ipHash: string | null,
): Promise<{ correoEnviado: boolean }> {
  const sb = supabaseServicio();
  const vacante = await vacanteVigente(empresa.id, datos.empleo_id);
  // Sin vacante vigente (espontánea, o la cerraron mientras postulaba) se
  // guarda igual, con el título que vio el postulante.
  const puesto = vacante?.titulo ?? datos.puesto ?? ESPONTANEA;

  const id = randomUUID();
  const ruta = `${empresa.id}/${fechaLima().getUTCFullYear()}/${id}.${cv.tipo.ext}`;
  const { error: errCv } = await sb.storage.from('postulaciones').upload(ruta, cv.bytes, {
    contentType: cv.tipo.mime,
  });
  if (errCv) throw new Error(`No se pudo guardar el CV: ${errCv.message}`);

  const fila = {
    ...datos,
    id,
    empresa_id: empresa.id,
    empleo_id: vacante?.id ?? null,
    puesto,
    area_interes: vacante ? null : datos.area_interes,
    cv_path: ruta,
    cv_nombre: nombreArchivo(datos.nombre, cv.tipo.ext),
    ip_hash: ipHash,
  };
  const { error } = await sb.from('postulaciones').insert(fila);
  if (error) {
    await sb.storage.from('postulaciones').remove([ruta]);
    throw new Error(`No se pudo guardar la postulación: ${error.message}`);
  }

  const destino = vacante?.correo_postulacion ?? empresa.correo_contacto;
  const [aviso, acuse] = await Promise.all([
    destino ? enviarAviso(empresa, fila, destino, cv) : Promise.resolve({ enviado: false as const, motivo: 'Sin correo de destino.' }),
    enviarAcuse(empresa, fila),
  ]);
  const ahora = new Date().toISOString();
  const errores = [aviso, acuse].filter((r) => !r.enviado).map((r) => ('motivo' in r ? r.motivo : ''));
  await sb
    .from('postulaciones')
    .update({
      correo_aviso: aviso.enviado ? ahora : null,
      correo_acuse: acuse.enviado ? ahora : null,
      correo_error: errores.length ? [...new Set(errores)].join(' · ') : null,
    })
    .eq('id', id);

  return { correoEnviado: acuse.enviado };
}

type FilaCorreo = NuevaPostulacion & { puesto: string; cv_nombre: string };

function enviarAviso(empresa: Empresa, p: FilaCorreo, destino: string, cv: { bytes: Uint8Array; tipo: TipoCv }) {
  return enviarCorreo(empresa.id, {
    para: [destino],
    responderA: p.correo,
    asunto: `Nueva postulación: ${p.puesto} · ${p.nombre}`,
    html: plantilla({
      color: ui(empresa.id).color,
      titulo: 'Nueva postulación',
      subtitulo: p.puesto,
      parrafos: ['Llegó una postulación desde la web. El CV va adjunto y la postulación queda guardada en el portal.'],
      filas: [
        ['Nombre', p.nombre],
        ['Documento', `${p.tipo_documento} ${p.numero_documento}`],
        ['Correo', p.correo],
        ['Teléfono', p.telefono],
        ['Reside en', `${p.distrito}, ${p.provincia}, ${p.departamento}`],
        ['Área de interés', p.area_interes ?? ''],
        ['Estudios', [p.estudios, p.carrera].filter(Boolean).join(' · ')],
        ['Experiencia', `${p.experiencia}${p.experiencia_bpm ? ' · con experiencia en BPM/BPA' : ''}`],
        ['Disponibilidad', p.disponibilidad],
        ['Pretensión salarial', p.pretension == null ? '' : `S/ ${p.pretension.toLocaleString('es-PE')}`],
        ['LinkedIn', p.linkedin ?? ''],
        ['Presentación', p.presentacion ?? ''],
      ],
      pie: 'Aviso automático del portal del Grupo Pacheco.',
    }),
    texto: `Nueva postulación a ${p.puesto}: ${p.nombre} (${p.correo}, ${p.telefono}).`,
    adjuntos: [{ nombre: p.cv_nombre, contenido: cv.bytes, tipo: cv.tipo.mime }],
  });
}

function enviarAcuse(empresa: Empresa, p: FilaCorreo) {
  return enviarCorreo(empresa.id, {
    para: [p.correo],
    asunto: `Recibimos su postulación · ${empresa.nombre}`,
    html: plantilla({
      color: ui(empresa.id).color,
      titulo: 'Gracias por postular',
      subtitulo: p.puesto,
      parrafos: [
        `Hola, ${esc(p.nombre)}:`,
        `Recibimos su postulación y su CV. Nuestro equipo revisará su perfil y se pondrá en contacto con usted de ser necesario.`,
      ],
      pie: `${esc(empresa.razon_social)}<br>${esc(empresa.direccion)}`,
    }),
    texto: `Recibimos su postulación a ${p.puesto}. Nuestro equipo se pondrá en contacto con usted de ser necesario.`,
  });
}
