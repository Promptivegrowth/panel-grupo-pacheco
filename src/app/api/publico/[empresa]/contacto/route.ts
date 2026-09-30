import { randomUUID } from 'node:crypto';
import { supabaseServicio } from '@/lib/supabase/servicio';
import { avisarMensaje, cargarEmpresa } from '@/lib/reclamos/servicio';
import {
  cabecerasCors,
  esRobot,
  esquemaMensaje,
  excedeLimite,
  hashIp,
  json,
  leerCuerpo,
  primerError,
} from '@/lib/publico';
import { ADJUNTOS_CANTIDAD, ADJUNTOS_MAXIMO, nombreSeguro, tipoAdjunto, type Adjunto } from '@/lib/adjuntos';
import { fechaLima } from '@/lib/reclamos/plazos';

/**
 * POST /api/publico/{empresa}/contacto
 * Guarda un mensaje de contacto o cotización y avisa por correo.
 * El mensaje queda guardado aunque el correo falle: nunca se pierde.
 *
 * Acepta JSON o, si hay archivos, multipart/form-data: los campos igual que
 * en JSON (`datos` como texto JSON) y hasta 3 archivos en `adjuntos` (PDF,
 * Word, Excel, JPG o PNG; 4 MB en total).
 */

type Contexto = { params: Promise<{ empresa: string }> };
type Archivo = { bytes: Uint8Array; nombre: string; mime: string; ext: string };

export async function OPTIONS(req: Request, { params }: Contexto) {
  const empresa = await cargarEmpresa((await params).empresa);
  return new Response(null, { status: 204, headers: cabecerasCors(req.headers.get('origin'), empresa) });
}

/** Lee un envío multipart: campos de texto y archivos ya validados. */
async function leerMultipart(
  req: Request,
): Promise<{ datos: Record<string, unknown>; archivos: Archivo[] } | { error: string; estado: number }> {
  if (Number(req.headers.get('content-length') ?? 0) > ADJUNTOS_MAXIMO + 64_000) {
    return { error: 'Los archivos adjuntos no pueden superar 4 MB en total.', estado: 413 };
  }
  let formulario: FormData;
  try {
    formulario = await req.formData();
  } catch {
    return { error: 'No se recibieron datos válidos.', estado: 400 };
  }

  const datos: Record<string, unknown> = {};
  for (const [k, v] of formulario) if (typeof v === 'string' && k !== 'datos') datos[k] = v;
  const crudo = formulario.get('datos');
  if (typeof crudo === 'string' && crudo) {
    try {
      datos.datos = JSON.parse(crudo);
    } catch {
      return { error: 'No se recibieron datos válidos.', estado: 400 };
    }
  }

  const ficheros = formulario.getAll('adjuntos').filter((f): f is File => f instanceof File && f.size > 0);
  if (ficheros.length > ADJUNTOS_CANTIDAD) return { error: `Puede adjuntar hasta ${ADJUNTOS_CANTIDAD} archivos.`, estado: 422 };
  if (ficheros.reduce((t, f) => t + f.size, 0) > ADJUNTOS_MAXIMO) {
    return { error: 'Los archivos adjuntos no pueden superar 4 MB en total.', estado: 413 };
  }

  const archivos: Archivo[] = [];
  for (const f of ficheros) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const tipo = tipoAdjunto(bytes, f.name);
    if (!tipo) return { error: `«${f.name}» no es un tipo permitido (PDF, Word, Excel, JPG o PNG).`, estado: 422 };
    archivos.push({ bytes, nombre: nombreSeguro(f.name, tipo.ext), mime: tipo.mime, ext: tipo.ext });
  }
  return { datos, archivos };
}

export async function POST(req: Request, { params }: Contexto) {
  const empresa = await cargarEmpresa((await params).empresa);
  const cors = cabecerasCors(req.headers.get('origin'), empresa);
  if (!empresa) return json({ ok: false, error: 'Empresa no encontrada.' }, 404, cors);

  let datos: Record<string, unknown> | null;
  let archivos: Archivo[] = [];
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const r = await leerMultipart(req);
    if ('error' in r) return json({ ok: false, error: r.error, campo: 'adjuntos' }, r.estado, cors);
    datos = r.datos;
    archivos = r.archivos;
  } else {
    datos = await leerCuerpo(req);
  }
  if (!datos) return json({ ok: false, error: 'No se recibieron datos válidos.' }, 400, cors);
  if (esRobot(datos)) return json({ ok: true }, 200, cors);

  const ipHash = hashIp(req);
  if (await excedeLimite('mensajes', ipHash, 5)) {
    return json({ ok: false, error: 'Demasiados envíos seguidos. Inténtelo de nuevo en unos minutos.' }, 429, cors);
  }

  const validado = esquemaMensaje.safeParse(datos);
  if (!validado.success) {
    const { campo, mensaje } = primerError(validado.error);
    return json({ ok: false, error: mensaje, campo }, 422, cors);
  }

  const m = validado.data;
  const sb = supabaseServicio();
  const id = randomUUID();

  // Primero los archivos; si la fila no se guarda, se retiran.
  const adjuntos: Adjunto[] = [];
  const carpeta = `${empresa.id}/${fechaLima().getUTCFullYear()}/${id}`;
  for (const [i, a] of archivos.entries()) {
    const ruta = `${carpeta}/${i + 1}-${a.nombre}`;
    const { error } = await sb.storage.from('mensajes').upload(ruta, a.bytes, { contentType: a.mime });
    if (error) {
      if (adjuntos.length) await sb.storage.from('mensajes').remove(adjuntos.map((x) => x.ruta));
      console.error('Error guardando adjunto:', error.message);
      return json({ ok: false, error: 'No pudimos guardar los archivos adjuntos. Inténtelo nuevamente.' }, 500, cors);
    }
    adjuntos.push({ ruta, nombre: a.nombre, tipo: a.mime, tamano: a.bytes.length });
  }

  const { error } = await sb.from('mensajes').insert({ ...m, id, adjuntos, empresa_id: empresa.id, ip_hash: ipHash });
  if (error) {
    if (adjuntos.length) await sb.storage.from('mensajes').remove(adjuntos.map((x) => x.ruta));
    console.error('Error guardando mensaje:', error.message);
    return json({ ok: false, error: 'No pudimos enviar su mensaje. Inténtelo nuevamente.' }, 500, cors);
  }

  // El aviso por correo no bloquea la respuesta si falla.
  const aviso = await avisarMensaje(
    empresa,
    m,
    archivos.map((a) => ({ nombre: a.nombre, contenido: a.bytes, tipo: a.mime })),
  );
  if (!aviso.enviado) console.warn(`Aviso de contacto no enviado (${empresa.id}):`, aviso.motivo);

  return json({ ok: true }, 201, cors);
}
