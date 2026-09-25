import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { supabaseServicio } from '@/lib/supabase/servicio';
import type { Empresa } from '@/lib/reclamos/servicio';

/**
 * Utilidades de la API pública que reciben las tres webs (estáticas, en
 * Vercel o en cPanel): CORS por empresa, lectura segura del cuerpo,
 * anonimización de la IP y límite de envíos.
 */

/** Cabeceras CORS: solo se refleja el origen si está en la lista de la empresa. */
export function cabecerasCors(origen: string | null, empresa: Empresa | null): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
  if (origen && empresa?.origenes.includes(origen)) base['Access-Control-Allow-Origin'] = origen;
  return base;
}

export function json(cuerpo: unknown, estado: number, cabeceras: Record<string, string>) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabeceras, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Lee JSON o formulario, con un tope de tamaño. */
export async function leerCuerpo(req: Request): Promise<Record<string, unknown> | null> {
  const largo = Number(req.headers.get('content-length') ?? 0);
  if (largo > 64_000) return null;
  const tipo = req.headers.get('content-type') ?? '';
  try {
    if (tipo.includes('application/json')) {
      const texto = await req.text();
      if (texto.length > 64_000) return null;
      const datos = JSON.parse(texto);
      return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : null;
    }
    if (tipo.includes('form')) return Object.fromEntries(await req.formData());
  } catch {
    return null;
  }
  return null;
}

/** Campos trampa que usan las webs: si vienen rellenos, es un robot. */
export function esRobot(datos: Record<string, unknown>): boolean {
  return ['sitio_web', 'empresa_web', 'hp_website', 'website'].some(
    (k) => typeof datos[k] === 'string' && (datos[k] as string).trim() !== '',
  );
}

/** IP anonimizada (hash con sal): sirve para limitar envíos sin guardar la IP. */
export function hashIp(req: Request): string | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '';
  if (!ip) return null;
  return createHash('sha256')
    .update(`${process.env.IP_SALT ?? ''}:${ip}`)
    .digest('hex')
    .slice(0, 32);
}

/** ¿Superó esta IP el máximo de envíos en la ventana de tiempo? */
export async function excedeLimite(
  tabla: 'mensajes' | 'reclamos',
  ipHash: string | null,
  maximo: number,
  minutos = 10,
): Promise<boolean> {
  if (!ipHash) return false;
  const desde = new Date(Date.now() - minutos * 60_000).toISOString();
  const { count } = await supabaseServicio()
    .from(tabla)
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('creado', desde);
  return (count ?? 0) >= maximo;
}

// ------------------------------------------------------------ validación

// Mensajes de error de zod en español para todo lo que no tenga uno propio.
z.config(z.locales.es());


const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const siNo = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === 'si' || v === 'sí' || v === 'on' || v === '1');

export const esquemaReclamo = z
  .object({
    tipo: z.enum(['reclamo', 'queja']),
    nombre: texto(3, 150),
    tipo_documento: z.enum(['DNI', 'CE', 'Pasaporte', 'RUC']),
    numero_documento: z.string().trim().regex(/^[A-Za-z0-9-]{6,15}$/, 'Número de documento no válido'),
    domicilio: opcional(250),
    telefono: opcional(30),
    correo: z.email().max(150),
    menor_edad: siNo.default(false),
    apoderado: opcional(150),
    bien_tipo: z.enum(['producto', 'servicio']),
    monto: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v, ctx) => {
        if (v === undefined || v === '') return null;
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
        if (!Number.isFinite(n) || n < 0 || n > 1e9) {
          ctx.addIssue({ code: 'custom', message: 'Monto no válido' });
          return z.NEVER;
        }
        return Math.round(n * 100) / 100;
      }),
    bien_descripcion: texto(3, 2000),
    detalle: texto(10, 4000),
    pedido: texto(5, 2000),
    // El valor por defecto va DENTRO de la comprobación: en zod 4 `.default()`
    // se salta lo que venga después, y una casilla ausente contaría como aceptada.
    acepta: siNo.default(false).refine((v) => v, 'Debe aceptar la declaración para registrar la hoja.'),
  })
  .superRefine((d, ctx) => {
    if (d.tipo_documento === 'DNI' && !/^\d{8}$/.test(d.numero_documento)) {
      ctx.addIssue({ code: 'custom', path: ['numero_documento'], message: 'El DNI tiene 8 dígitos' });
    }
    if (d.tipo_documento === 'RUC' && !/^\d{11}$/.test(d.numero_documento)) {
      ctx.addIssue({ code: 'custom', path: ['numero_documento'], message: 'El RUC tiene 11 dígitos' });
    }
    if (d.menor_edad && !d.apoderado) {
      ctx.addIssue({ code: 'custom', path: ['apoderado'], message: 'Indique el padre, madre o apoderado' });
    }
  });

export const esquemaMensaje = z
  .object({
    tipo: z.enum(['contacto', 'cotizacion']).default('contacto'),
    nombre: texto(2, 150),
    empresa: opcional(150),
    correo: z
      .union([z.email().max(150), z.literal('')])
      .optional()
      .transform((v) => (v ? v : null)),
    telefono: opcional(30),
    asunto: opcional(200),
    mensaje: opcional(4000),
    pagina: opcional(300),
    datos: z
      .record(z.string().max(60), z.union([z.string().max(1000), z.number(), z.boolean()]))
      .optional()
      .transform((r) =>
        Object.fromEntries(
          Object.entries(r ?? {})
            .slice(0, 25)
            .map(([k, v]) => [k, String(v).trim()])
            .filter(([, v]) => v),
        ),
      ),
  })
  .refine((d) => d.correo || d.telefono, { message: 'Indique un correo o un teléfono', path: ['correo'] });

/** Primer error legible de zod, para devolverlo al formulario. */
export function primerError(error: z.ZodError): { campo: string; mensaje: string } {
  const e = error.issues[0];
  return { campo: String(e?.path?.[0] ?? ''), mensaje: e?.message ?? 'Datos no válidos' };
}
