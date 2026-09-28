import 'server-only';
import nodemailer from 'nodemailer';

/**
 * Envío de correo por empresa. Cada una se configura con una variable de
 * entorno JSON (CORREO_LP, CORREO_QMEDICAL, CORREO_WOLI):
 *
 *   SMTP (p. ej. Microsoft 365):
 *   {"tipo":"smtp","host":"smtp.office365.com","puerto":587,
 *    "usuario":"reclamos@dominio.com","clave":"…",
 *    "remitente":"Laboratorios Pacheco <reclamos@dominio.com>"}
 *
 *   Resend:
 *   {"tipo":"resend","clave":"re_…","remitente":"WOLI <no-reply@wlicargo.com>"}
 *
 * Sin configuración no se lanza error: se devuelve `{ enviado: false }` y el
 * registro queda guardado con el aviso pendiente, para reenviarlo después.
 */

type ConfigSmtp = {
  tipo: 'smtp';
  host: string;
  puerto?: number;
  usuario: string;
  clave: string;
  remitente: string;
};
type ConfigResend = { tipo: 'resend'; clave: string; remitente: string };
type Config = ConfigSmtp | ConfigResend;

export type Adjunto = { nombre: string; contenido: Uint8Array; tipo: string };

export type Mensaje = {
  para: string[];
  asunto: string;
  html: string;
  texto: string;
  responderA?: string;
  adjuntos?: Adjunto[];
};

export type Resultado = { enviado: true } | { enviado: false; motivo: string };

function configDe(empresaId: string): Config | null {
  const bruto = process.env[`CORREO_${empresaId.toUpperCase()}`];
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto) as Config;
    if (c.tipo === 'smtp' && c.host && c.usuario && c.clave && c.remitente) return c;
    if (c.tipo === 'resend' && c.clave && c.remitente) return c;
  } catch {
    // JSON mal formado: se trata como no configurado.
  }
  console.error(`CORREO_${empresaId.toUpperCase()} no es una configuración válida`);
  return null;
}

export function correoConfigurado(empresaId: string): boolean {
  return configDe(empresaId) !== null;
}

/**
 * Diagnóstico para el panel (sin revelar valores): si la variable no existe,
 * no es JSON o le faltan campos.
 */
export function estadoCorreo(empresaId: string): { ok: true } | { ok: false; motivo: string } {
  const nombre = `CORREO_${empresaId.toUpperCase()}`;
  const bruto = process.env[nombre];
  if (!bruto?.trim()) return { ok: false, motivo: `No existe la variable ${nombre} en este entorno.` };
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(bruto);
  } catch {
    return { ok: false, motivo: `La variable ${nombre} existe, pero no es un JSON válido (revise comillas y llaves).` };
  }
  const requeridos = c.tipo === 'smtp' ? ['host', 'usuario', 'clave', 'remitente'] : c.tipo === 'resend' ? ['clave', 'remitente'] : null;
  if (!requeridos) return { ok: false, motivo: `En ${nombre}, «tipo» debe ser "smtp" o "resend".` };
  const faltan = requeridos.filter((k) => typeof c[k] !== 'string' || !(c[k] as string).trim());
  if (faltan.length) return { ok: false, motivo: `En ${nombre} faltan: ${faltan.join(', ')}.` };
  return { ok: true };
}

export async function enviarCorreo(empresaId: string, m: Mensaje): Promise<Resultado> {
  const config = configDe(empresaId);
  if (!config) return { enviado: false, motivo: 'El envío de correo aún no está configurado para esta empresa.' };

  try {
    if (config.tipo === 'smtp') {
      const transporte = nodemailer.createTransport({
        host: config.host,
        port: config.puerto ?? 587,
        secure: (config.puerto ?? 587) === 465,
        requireTLS: (config.puerto ?? 587) !== 465,
        auth: { user: config.usuario, pass: config.clave },
      });
      await transporte.sendMail({
        from: config.remitente,
        to: m.para,
        replyTo: m.responderA,
        subject: m.asunto,
        html: m.html,
        text: m.texto,
        attachments: m.adjuntos?.map((a) => ({
          filename: a.nombre,
          content: Buffer.from(a.contenido),
          contentType: a.tipo,
        })),
      });
      return { enviado: true };
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: config.remitente,
        to: m.para,
        reply_to: m.responderA,
        subject: m.asunto,
        html: m.html,
        text: m.texto,
        attachments: m.adjuntos?.map((a) => ({
          filename: a.nombre,
          content: Buffer.from(a.contenido).toString('base64'),
        })),
      }),
    });
    if (!r.ok) return { enviado: false, motivo: `Resend respondió ${r.status}: ${(await r.text()).slice(0, 300)}` };
    return { enviado: true };
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    console.error(`Error enviando correo (${empresaId}):`, motivo);
    return { enviado: false, motivo };
  }
}

// ------------------------------------------------------------ plantillas

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Plantilla HTML sobria y compatible con clientes de correo (tablas). */
export function plantilla(opciones: {
  color: string;
  titulo: string;
  subtitulo?: string;
  parrafos: string[];
  filas?: [string, string][];
  pie: string;
}): string {
  const filas = (opciones.filas ?? [])
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 14px;border-bottom:1px solid #eceeea;font:600 12px Arial,sans-serif;color:#5b635a;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:8px 14px;border-bottom:1px solid #eceeea;font:400 14px Arial,sans-serif;color:#141813">${esc(v).replace(/\n/g, '<br>')}</td></tr>`,
    )
    .join('');
  const parrafos = opciones.parrafos
    .map((p) => `<p style="margin:0 0 12px;font:400 14px/1.6 Arial,sans-serif;color:#141813">${p}</p>`)
    .join('');
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f3f4f2;padding:24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e3e5e1">
<tr><td style="background:${esc(opciones.color)};height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:24px 26px 6px"><p style="margin:0;font:700 19px Arial,sans-serif;color:#141813">${esc(opciones.titulo)}</p>${
    opciones.subtitulo ? `<p style="margin:6px 0 0;font:600 13px Arial,sans-serif;color:${esc(opciones.color)}">${esc(opciones.subtitulo)}</p>` : ''
  }</td></tr>
<tr><td style="padding:14px 26px 4px">${parrafos}</td></tr>
${filas ? `<tr><td style="padding:0 12px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table></td></tr>` : ''}
<tr><td style="padding:14px 26px;background:#f7f8f6;font:400 12px/1.5 Arial,sans-serif;color:#6b7369">${opciones.pie}</td></tr>
</table></body></html>`;
}

export { esc as escaparHtml };
