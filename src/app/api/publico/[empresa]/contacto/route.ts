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

/**
 * POST /api/publico/{empresa}/contacto
 * Guarda un mensaje de contacto o cotización y avisa por correo.
 * El mensaje queda guardado aunque el correo falle: nunca se pierde.
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
  const { error } = await supabaseServicio()
    .from('mensajes')
    .insert({ ...m, empresa_id: empresa.id, ip_hash: ipHash });
  if (error) {
    console.error('Error guardando mensaje:', error.message);
    return json({ ok: false, error: 'No pudimos enviar su mensaje. Inténtelo nuevamente.' }, 500, cors);
  }

  // El aviso por correo no bloquea la respuesta si falla.
  const aviso = await avisarMensaje(empresa, m);
  if (!aviso.enviado) console.warn(`Aviso de contacto no enviado (${empresa.id}):`, aviso.motivo);

  return json({ ok: true }, 201, cors);
}
