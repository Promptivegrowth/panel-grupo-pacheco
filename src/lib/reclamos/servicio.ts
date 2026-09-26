import 'server-only';
import { supabaseServicio } from '@/lib/supabase/servicio';
import { EMPRESAS, type EmpresaUI } from '@/lib/empresas';
import { enviarCorreo, plantilla, escaparHtml as esc } from '@/lib/correo';
import { generarHoja, type DatosHoja } from '@/lib/reclamos/pdf';
import { fechaLima, sumarHabiles, aISO } from '@/lib/reclamos/plazos';

export type Empresa = {
  id: string;
  nombre: string;
  razon_social: string;
  ruc: string;
  direccion: string;
  sitio_url: string;
  correo_reclamos: string | null;
  correo_contacto: string | null;
  origenes: string[];
};

export type Reclamo = {
  id: string;
  empresa_id: string;
  anio: number;
  correlativo: number;
  codigo: string;
  creado: string;
  tipo: 'reclamo' | 'queja';
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  domicilio: string | null;
  ubigeo: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
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
  estado: 'pendiente' | 'en_proceso' | 'respondido';
  vence: string;
  respuesta: string | null;
  respondido: string | null;
  pdf_path: string | null;
  correo_constancia: string | null;
  correo_aviso: string | null;
  correo_respuesta: string | null;
  correo_error: string | null;
};

export type NuevoReclamo = Pick<
  Reclamo,
  | 'tipo'
  | 'nombre'
  | 'tipo_documento'
  | 'numero_documento'
  | 'domicilio'
  | 'ubigeo'
  | 'departamento'
  | 'provincia'
  | 'distrito'
  | 'telefono'
  | 'correo'
  | 'menor_edad'
  | 'apoderado'
  | 'bien_tipo'
  | 'monto'
  | 'moneda'
  | 'bien_descripcion'
  | 'detalle'
  | 'pedido'
>;

export async function cargarEmpresa(id: string): Promise<Empresa | null> {
  const { data } = await supabaseServicio().from('empresas').select('*').eq('id', id).maybeSingle();
  return (data as Empresa) ?? null;
}

function ui(empresaId: string): EmpresaUI {
  return EMPRESAS[empresaId as EmpresaUI['id']];
}

function datosHoja(empresa: Empresa, r: Reclamo): DatosHoja {
  return {
    empresa: {
      razon_social: empresa.razon_social,
      ruc: empresa.ruc,
      direccion: empresa.direccion,
      color: ui(empresa.id).color,
    },
    codigo: r.codigo,
    creado: new Date(r.creado),
    tipo: r.tipo,
    nombre: r.nombre,
    tipo_documento: r.tipo_documento,
    numero_documento: r.numero_documento,
    domicilio: r.domicilio,
    ubicacion: r.distrito && r.provincia && r.departamento
      ? `${r.distrito}, ${r.provincia}, ${r.departamento} (ubigeo ${r.ubigeo})`
      : null,
    telefono: r.telefono,
    correo: r.correo,
    menor_edad: r.menor_edad,
    apoderado: r.apoderado,
    bien_tipo: r.bien_tipo,
    monto: r.monto == null ? null : Number(r.monto),
    moneda: r.moneda ?? 'PEN',
    bien_descripcion: r.bien_descripcion,
    detalle: r.detalle,
    pedido: r.pedido,
    vence: new Date(`${r.vence}T00:00:00Z`),
    respuesta: r.respuesta,
    respondido: r.respondido ? new Date(r.respondido) : null,
  };
}

/** Genera el PDF con el estado actual del reclamo y lo guarda (sobrescribe). */
export async function guardarPdf(empresa: Empresa, r: Reclamo): Promise<{ ruta: string; pdf: Uint8Array }> {
  const pdf = await generarHoja(datosHoja(empresa, r));
  const ruta = `${empresa.id}/${r.anio}/${r.codigo}.pdf`;
  const sb = supabaseServicio();
  const { error } = await sb.storage.from('reclamos').upload(ruta, pdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw new Error(`No se pudo guardar el PDF: ${error.message}`);
  if (r.pdf_path !== ruta) await sb.from('reclamos').update({ pdf_path: ruta }).eq('id', r.id);
  return { ruta, pdf };
}

export async function descargarPdf(ruta: string): Promise<Uint8Array | null> {
  const { data } = await supabaseServicio().storage.from('reclamos').download(ruta);
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}

const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

// ------------------------------------------------------------ correos

async function enviarConstancia(empresa: Empresa, r: Reclamo, pdf: Uint8Array) {
  const color = ui(empresa.id).color;
  const tipo = r.tipo === 'reclamo' ? 'reclamo' : 'queja';
  return enviarCorreo(empresa.id, {
    para: [r.correo],
    responderA: empresa.correo_reclamos ?? undefined,
    asunto: `Constancia de su ${tipo} N.º ${r.codigo} · ${empresa.nombre}`,
    html: plantilla({
      color,
      titulo: 'Constancia de registro',
      subtitulo: `Libro de Reclamaciones · N.º ${r.codigo}`,
      parrafos: [
        `Estimado(a) ${esc(r.nombre)}:`,
        `Hemos registrado su ${tipo} en el Libro de Reclamaciones de <b>${esc(empresa.razon_social)}</b>. Adjuntamos la hoja de reclamación en PDF como constancia.`,
        `Le daremos respuesta en un plazo no mayor a quince (15) días hábiles, a más tardar el <b>${fechaLarga(r.vence)}</b>, en este mismo correo.`,
      ],
      pie: `${esc(empresa.razon_social)} · RUC ${esc(empresa.ruc)}<br>${esc(empresa.direccion)}<br>La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.`,
    }),
    texto: `Hemos registrado su ${tipo} N.º ${r.codigo} en el Libro de Reclamaciones de ${empresa.razon_social}. Responderemos a más tardar el ${fechaLarga(r.vence)}. Adjuntamos la hoja de reclamación en PDF.`,
    adjuntos: [{ nombre: `Hoja-de-reclamacion-${r.codigo}.pdf`, contenido: pdf, tipo: 'application/pdf' }],
  });
}

async function enviarAviso(empresa: Empresa, r: Reclamo, pdf: Uint8Array) {
  if (!empresa.correo_reclamos) return { enviado: false as const, motivo: 'La empresa no tiene correo de avisos.' };
  const color = ui(empresa.id).color;
  return enviarCorreo(empresa.id, {
    para: [empresa.correo_reclamos],
    responderA: r.correo,
    asunto: `Nuevo ${r.tipo} N.º ${r.codigo} · vence el ${fechaLarga(r.vence)}`,
    html: plantilla({
      color,
      titulo: `Nuevo ${r.tipo} en el Libro de Reclamaciones`,
      subtitulo: `N.º ${r.codigo} · responder antes del ${fechaLarga(r.vence)}`,
      parrafos: ['Se registró una nueva hoja desde la web. El PDF va adjunto y el caso puede gestionarse desde el portal.'],
      filas: [
        ['Consumidor', r.nombre],
        ['Documento', `${r.tipo_documento} ${r.numero_documento}`],
        ['Domicilio', [r.domicilio, r.distrito, r.provincia, r.departamento].filter(Boolean).join(', ')],
        ['Correo', r.correo],
        ['Teléfono', r.telefono ?? ''],
        ['Detalle', r.detalle],
        ['Pedido', r.pedido],
      ],
      pie: 'Aviso automático del portal del Grupo Pacheco.',
    }),
    texto: `Nuevo ${r.tipo} N.º ${r.codigo} de ${r.nombre} (${r.correo}). Vence el ${fechaLarga(r.vence)}.`,
    adjuntos: [{ nombre: `Hoja-de-reclamacion-${r.codigo}.pdf`, contenido: pdf, tipo: 'application/pdf' }],
  });
}

async function enviarRespuesta(empresa: Empresa, r: Reclamo, pdf: Uint8Array) {
  const color = ui(empresa.id).color;
  return enviarCorreo(empresa.id, {
    para: [r.correo],
    responderA: empresa.correo_reclamos ?? undefined,
    asunto: `Respuesta a su ${r.tipo} N.º ${r.codigo} · ${empresa.nombre}`,
    html: plantilla({
      color,
      titulo: `Respuesta a su ${r.tipo}`,
      subtitulo: `Libro de Reclamaciones · N.º ${r.codigo}`,
      parrafos: [
        `Estimado(a) ${esc(r.nombre)}:`,
        esc(r.respuesta ?? '').replace(/\n/g, '<br>'),
        'Adjuntamos la hoja de reclamación actualizada con nuestra respuesta.',
      ],
      pie: `${esc(empresa.razon_social)} · RUC ${esc(empresa.ruc)}<br>${esc(empresa.direccion)}`,
    }),
    texto: `Respuesta a su ${r.tipo} N.º ${r.codigo}:\n\n${r.respuesta ?? ''}`,
    adjuntos: [{ nombre: `Hoja-de-reclamacion-${r.codigo}.pdf`, contenido: pdf, tipo: 'application/pdf' }],
  });
}

// ------------------------------------------------------------ flujos

/** Registro desde la web: numera, guarda, genera el PDF y avisa. */
export async function registrarReclamo(
  empresa: Empresa,
  datos: NuevoReclamo,
  ipHash: string | null,
): Promise<{ codigo: string; vence: string; correoEnviado: boolean }> {
  const sb = supabaseServicio();
  const hoy = fechaLima();
  const anio = hoy.getUTCFullYear();

  const { data: correlativo, error: errCorr } = await sb.rpc('siguiente_correlativo', {
    p_empresa: empresa.id,
    p_anio: anio,
  });
  if (errCorr || typeof correlativo !== 'number') throw new Error(`No se pudo numerar: ${errCorr?.message}`);

  const codigo = `${ui(empresa.id).prefijo}-${String(correlativo).padStart(6, '0')}-${anio}`;
  const vence = aISO(sumarHabiles(hoy));

  const { data: fila, error } = await sb
    .from('reclamos')
    .insert({ ...datos, empresa_id: empresa.id, anio, correlativo, codigo, vence, ip_hash: ipHash })
    .select('*')
    .single();
  if (error || !fila) throw new Error(`No se pudo guardar el reclamo: ${error?.message}`);

  const reclamo = fila as Reclamo;
  const { pdf } = await guardarPdf(empresa, reclamo);
  const { constancia } = await avisarRegistro(empresa, reclamo, pdf);

  return { codigo, vence, correoEnviado: constancia };
}

/** Envía (o reenvía) la constancia y el aviso interno, y deja constancia. */
export async function avisarRegistro(empresa: Empresa, r: Reclamo, pdf: Uint8Array) {
  const sb = supabaseServicio();
  const [constancia, aviso] = await Promise.all([
    r.correo_constancia ? Promise.resolve({ enviado: true as const }) : enviarConstancia(empresa, r, pdf),
    r.correo_aviso ? Promise.resolve({ enviado: true as const }) : enviarAviso(empresa, r, pdf),
  ]);
  const ahora = new Date().toISOString();
  const errores = [constancia, aviso].filter((x) => !x.enviado).map((x) => ('motivo' in x ? x.motivo : ''));
  await sb
    .from('reclamos')
    .update({
      correo_constancia: constancia.enviado ? (r.correo_constancia ?? ahora) : null,
      correo_aviso: aviso.enviado ? (r.correo_aviso ?? ahora) : null,
      correo_error: errores.length ? [...new Set(errores)].join(' · ') : null,
    })
    .eq('id', r.id);
  return { constancia: constancia.enviado, aviso: aviso.enviado, errores };
}

/** Respuesta desde el panel: guarda, regenera el PDF y la envía. */
export async function responderReclamo(
  empresa: Empresa,
  r: Reclamo,
  respuesta: string,
  usuarioId: string,
): Promise<{ correoEnviado: boolean; motivo?: string }> {
  const sb = supabaseServicio();
  const respondido = new Date().toISOString();
  const { data: fila, error } = await sb
    .from('reclamos')
    .update({ respuesta, respondido, respondido_por: usuarioId, estado: 'respondido', correo_respuesta: null })
    .eq('id', r.id)
    .select('*')
    .single();
  if (error || !fila) throw new Error(`No se pudo guardar la respuesta: ${error?.message}`);

  return enviarRespuestaGuardada(empresa, fila as Reclamo);
}

export async function enviarRespuestaGuardada(empresa: Empresa, r: Reclamo) {
  const sb = supabaseServicio();
  const { pdf } = await guardarPdf(empresa, r);
  const envio = await enviarRespuesta(empresa, r, pdf);
  await sb
    .from('reclamos')
    .update({
      correo_respuesta: envio.enviado ? new Date().toISOString() : null,
      correo_error: envio.enviado ? null : envio.motivo,
    })
    .eq('id', r.id);
  return envio.enviado ? { correoEnviado: true } : { correoEnviado: false, motivo: envio.motivo };
}

/** Aviso interno de un mensaje de contacto. */
export async function avisarMensaje(
  empresa: Empresa,
  m: { nombre: string; correo?: string | null; telefono?: string | null; empresa?: string | null; asunto?: string | null; mensaje?: string | null; tipo: string; datos: Record<string, string> },
) {
  if (!empresa.correo_contacto) return { enviado: false as const, motivo: 'Sin correo de avisos.' };
  const extra = Object.entries(m.datos).map(([k, v]) => [k, v] as [string, string]);
  return enviarCorreo(empresa.id, {
    para: [empresa.correo_contacto],
    responderA: m.correo ?? undefined,
    asunto: `${m.tipo === 'cotizacion' ? 'Nueva solicitud de cotización' : 'Nuevo mensaje de contacto'} · ${m.nombre}`,
    html: plantilla({
      color: ui(empresa.id).color,
      titulo: m.tipo === 'cotizacion' ? 'Nueva solicitud de cotización' : 'Nuevo mensaje de contacto',
      subtitulo: `Desde ${empresa.sitio_url.replace(/^https?:\/\//, '')}`,
      parrafos: ['Puede responder directamente a este correo: la respuesta le llega al remitente.'],
      filas: [
        ['Nombre', m.nombre],
        ['Empresa', m.empresa ?? ''],
        ['Correo', m.correo ?? ''],
        ['Teléfono', m.telefono ?? ''],
        ['Servicio de interés', m.asunto ?? ''],
        ...extra,
        ['Mensaje', m.mensaje ?? ''],
      ],
      pie: 'Aviso automático del portal del Grupo Pacheco. El mensaje también queda guardado en el portal.',
    }),
    texto: `${m.nombre} (${m.correo ?? 'sin correo'}): ${m.mensaje ?? ''}`,
  });
}
