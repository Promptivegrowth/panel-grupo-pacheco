import { cargarEmpresa } from '@/lib/reclamos/servicio';
import { EMPRESAS, type EmpresaUI } from '@/lib/empresas';
import { cabecerasCors, esRobot, esquemaPostulacion, excedeLimite, hashIp, json, primerError } from '@/lib/publico';
import { CV_MAXIMO, registrarPostulacion, tipoCv } from '@/lib/postulaciones';

/**
 * POST /api/publico/{empresa}/postulacion  (multipart/form-data)
 * Postulación a una vacante de «Trabaja con nosotros» con el CV adjunto
 * (campo `cv`: PDF o Word, hasta 4 MB). Sin `empleo_id` es espontánea.
 * Responde { ok, correoEnviado } o { ok: false, error, campo }.
 */

type Contexto = { params: Promise<{ empresa: string }> };

// Formulario + CV: un poco más que el CV para los campos de texto.
const CUERPO_MAXIMO = CV_MAXIMO + 64_000;

const conEmpleos = (id: string) => EMPRESAS[id as EmpresaUI['id']]?.modulos.includes('empleos') ?? false;

export async function OPTIONS(req: Request, { params }: Contexto) {
  const empresa = await cargarEmpresa((await params).empresa);
  return new Response(null, { status: 204, headers: cabecerasCors(req.headers.get('origin'), empresa) });
}

export async function POST(req: Request, { params }: Contexto) {
  const empresa = await cargarEmpresa((await params).empresa);
  const cors = cabecerasCors(req.headers.get('origin'), empresa);
  if (!empresa || !conEmpleos(empresa.id)) return json({ ok: false, error: 'Empresa no encontrada.' }, 404, cors);

  if (Number(req.headers.get('content-length') ?? 0) > CUERPO_MAXIMO) {
    return json({ ok: false, error: 'El CV no puede pesar más de 4 MB.', campo: 'cv' }, 413, cors);
  }
  let formulario: FormData;
  try {
    formulario = await req.formData();
  } catch {
    return json({ ok: false, error: 'No se recibieron datos válidos.' }, 400, cors);
  }

  const datos: Record<string, unknown> = {};
  for (const [k, v] of formulario) if (typeof v === 'string') datos[k] = v;
  if (esRobot(datos)) return json({ ok: true }, 200, cors);

  const ipHash = hashIp(req);
  if (await excedeLimite('postulaciones', ipHash, 5)) {
    return json({ ok: false, error: 'Demasiados envíos seguidos. Inténtelo de nuevo en unos minutos.' }, 429, cors);
  }

  const validado = esquemaPostulacion.safeParse(datos);
  if (!validado.success) {
    const { campo, mensaje } = primerError(validado.error);
    return json({ ok: false, error: mensaje, campo }, 422, cors);
  }

  const archivo = formulario.get('cv');
  if (!(archivo instanceof File) || archivo.size === 0) {
    return json({ ok: false, error: 'Adjunte su CV en PDF o Word.', campo: 'cv' }, 422, cors);
  }
  if (archivo.size > CV_MAXIMO) {
    return json({ ok: false, error: 'El CV no puede pesar más de 4 MB.', campo: 'cv' }, 413, cors);
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoCv(bytes, archivo.name);
  if (!tipo) return json({ ok: false, error: 'El CV debe ser un archivo PDF o Word (.doc, .docx).', campo: 'cv' }, 422, cors);

  const p = validado.data;
  try {
    const { correoEnviado } = await registrarPostulacion(
      empresa,
      {
        empleo_id: p.empleo_id,
        puesto: p.puesto,
        area_interes: p.area_interes,
        nombre: p.nombre,
        tipo_documento: p.tipo_documento,
        numero_documento: p.numero_documento.toUpperCase(),
        correo: p.correo,
        telefono: p.telefono,
        ubigeo: p.ubigeo,
        departamento: p.departamento,
        provincia: p.provincia,
        distrito: p.distrito,
        estudios: p.estudios,
        carrera: p.carrera,
        experiencia: p.experiencia,
        experiencia_bpm: p.experiencia_bpm,
        disponibilidad: p.disponibilidad,
        pretension: p.pretension,
        linkedin: p.linkedin,
        presentacion: p.presentacion,
      },
      { bytes, tipo },
      ipHash,
    );
    return json({ ok: true, correoEnviado }, 201, cors);
  } catch (err) {
    console.error('Error registrando postulación:', err instanceof Error ? err.message : err);
    return json({ ok: false, error: 'No pudimos enviar su postulación. Inténtelo nuevamente.' }, 500, cors);
  }
}
