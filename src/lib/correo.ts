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
 *   Microsoft 365 por Graph (Microsoft retiró en 2026 el SMTP con contraseña):
 *   {"tipo":"graph","inquilino":"<id del inquilino>","cliente":"<id de la app>",
 *    "secreto":"…","buzon":"notificaciones@dominio.com"}
 *   La app de Entra ID necesita Mail.Send y Mail.ReadWrite, limitados a ese
 *   buzón (RBAC de aplicaciones de Exchange). El remitente es el nombre del buzón.
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
type ConfigGraph = { tipo: 'graph'; inquilino: string; cliente: string; secreto: string; buzon: string };
type Config = ConfigSmtp | ConfigResend | ConfigGraph;

const REQUERIDOS: Record<Config['tipo'], string[]> = {
  smtp: ['host', 'usuario', 'clave', 'remitente'],
  resend: ['clave', 'remitente'],
  graph: ['inquilino', 'cliente', 'secreto', 'buzon'],
};

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
    const requeridos = REQUERIDOS[c.tipo];
    if (requeridos?.every((k) => (c as Record<string, unknown>)[k])) return c;
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
  const requeridos = REQUERIDOS[c.tipo as Config['tipo']];
  if (!requeridos) return { ok: false, motivo: `En ${nombre}, «tipo» debe ser "smtp", "resend" o "graph".` };
  const faltan = requeridos.filter((k) => typeof c[k] !== 'string' || !(c[k] as string).trim());
  if (faltan.length) return { ok: false, motivo: `En ${nombre} faltan: ${faltan.join(', ')}.` };
  return { ok: true };
}

export async function enviarCorreo(empresaId: string, m: Mensaje): Promise<Resultado> {
  const config = configDe(empresaId);
  if (!config) return { enviado: false, motivo: 'El envío de correo aún no está configurado para esta empresa.' };

  try {
    if (config.tipo === 'graph') return await enviarGraph(config, m);

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

// ------------------------------------------------------- Microsoft Graph

const GRAPH = 'https://graph.microsoft.com/v1.0';
/** sendMail admite unos 4 MB por pedido, ya en base64. Por encima de este
    tamaño crudo los adjuntos se suben por partes a un borrador. */
const ADJUNTO_EN_LINEA = 2.5 * 1024 * 1024;
/** Las partes de una subida deben ser múltiplos de 320 KiB. */
const PARTE = 320 * 1024 * 10;

const fichas = new Map<string, { token: string; vence: number }>();

async function tokenGraph(c: ConfigGraph): Promise<string> {
  const guardada = fichas.get(c.cliente);
  if (guardada && guardada.vence > Date.now() + 60_000) return guardada.token;
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.inquilino)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.cliente,
      client_secret: c.secreto,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !j.access_token) {
    throw new Error(`Microsoft no entregó el token: ${(j.error_description ?? r.status).toString().slice(0, 300)}`);
  }
  fichas.set(c.cliente, { token: j.access_token, vence: Date.now() + (j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}

async function pedirGraph(token: string, ruta: string, cuerpo?: unknown): Promise<Response> {
  const r = await fetch(GRAPH + ruta, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`Microsoft Graph respondió ${r.status} en ${ruta.split('?')[0]}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

async function enviarGraph(c: ConfigGraph, m: Mensaje): Promise<Resultado> {
  const token = await tokenGraph(c);
  const buzon = `/users/${encodeURIComponent(c.buzon)}`;
  const adjuntos = m.adjuntos ?? [];
  const pesoTotal = adjuntos.reduce((s, a) => s + a.contenido.byteLength, 0);
  const destinatarios = (lista: string[]) => lista.map((address) => ({ emailAddress: { address } }));
  const mensaje = {
    subject: m.asunto,
    body: { contentType: 'HTML', content: m.html },
    toRecipients: destinatarios(m.para),
    ...(m.responderA ? { replyTo: destinatarios([m.responderA]) } : {}),
  };

  if (pesoTotal <= ADJUNTO_EN_LINEA) {
    await pedirGraph(token, `${buzon}/sendMail`, {
      message: {
        ...mensaje,
        attachments: adjuntos.map((a) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.nombre,
          contentType: a.tipo,
          contentBytes: Buffer.from(a.contenido).toString('base64'),
        })),
      },
      saveToSentItems: true,
    });
    return { enviado: true };
  }

  // Adjuntos grandes (un CV de 4 MB): borrador, subida por partes y envío.
  const borrador = (await (await pedirGraph(token, `${buzon}/messages`, mensaje)).json()) as { id: string };
  const rutaBorrador = `${buzon}/messages/${encodeURIComponent(borrador.id)}`;
  for (const a of adjuntos) {
    const sesion = (await (
      await pedirGraph(token, `${rutaBorrador}/attachments/createUploadSession`, {
        AttachmentItem: { attachmentType: 'file', name: a.nombre, size: a.contenido.byteLength, contentType: a.tipo },
      })
    ).json()) as { uploadUrl: string };
    const datos = Buffer.from(a.contenido);
    for (let desde = 0; desde < datos.length; desde += PARTE) {
      const parte = datos.subarray(desde, Math.min(desde + PARTE, datos.length));
      // La dirección de subida ya va firmada: no lleva el token.
      const r = await fetch(sesion.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes ${desde}-${desde + parte.length - 1}/${datos.length}` },
        body: parte,
      });
      if (!r.ok) throw new Error(`Microsoft Graph rechazó una parte del adjunto (${r.status}).`);
    }
  }
  await pedirGraph(token, `${rutaBorrador}/send`);
  return { enviado: true };
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
