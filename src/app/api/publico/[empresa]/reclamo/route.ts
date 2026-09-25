import { cargarEmpresa, registrarReclamo } from '@/lib/reclamos/servicio';
import {
  cabecerasCors,
  esRobot,
  esquemaReclamo,
  excedeLimite,
  hashIp,
  json,
  leerCuerpo,
  primerError,
} from '@/lib/publico';

/**
 * POST /api/publico/{empresa}/reclamo
 * Registra una hoja del Libro de Reclamaciones desde la web de la empresa.
 * Responde { ok, codigo, vence, correoEnviado } o { ok: false, error, campo }.
 */

type Contexto = { params: Promise<{ empresa: string }> };

export async function OPTIONS(req: Request, { params }: Contexto) {
  const empresa = await cargarEmpresa((await params).empresa);
  return new Response(null, { status: 204, headers: cabecerasCors(req.headers.get('origin'), empresa) });
}

export async function POST(req: Request, { params }: Contexto) {
  const empresa = await cargarEmpresa((await params).empresa);
  const cors = cabecerasCors(req.headers.get('origin'), empresa);
  if (!empresa) return json({ ok: false, error: 'Empresa no encontrada.' }, 404, cors);

  const datos = await leerCuerpo(req);
  if (!datos) return json({ ok: false, error: 'No se recibieron datos válidos.' }, 400, cors);

  // Robot: se responde como si todo fuera bien, sin guardar nada.
  if (esRobot(datos)) return json({ ok: true, codigo: null }, 200, cors);

  const ipHash = hashIp(req);
  if (await excedeLimite('reclamos', ipHash, 3)) {
    return json({ ok: false, error: 'Demasiados envíos seguidos. Inténtelo de nuevo en unos minutos.' }, 429, cors);
  }

  const validado = esquemaReclamo.safeParse(datos);
  if (!validado.success) {
    const { campo, mensaje } = primerError(validado.error);
    return json({ ok: false, error: mensaje, campo }, 422, cors);
  }

  // `acepta` solo sirve para validar; no es una columna.
  const { acepta, ...reclamo } = validado.data;
  void acepta;

  try {
    const r = await registrarReclamo(empresa, reclamo, ipHash);
    return json({ ok: true, ...r }, 201, cors);
  } catch (err) {
    console.error('Error registrando reclamo:', err);
    return json(
      { ok: false, error: 'No pudimos registrar su reclamo. Inténtelo nuevamente o comuníquese por teléfono.' },
      500,
      cors,
    );
  }
}
