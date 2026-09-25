'use server';

import { refresh } from 'next/cache';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import {
  avisarRegistro,
  cargarEmpresa,
  descargarPdf,
  enviarRespuestaGuardada,
  guardarPdf,
  responderReclamo,
  type Reclamo,
} from '@/lib/reclamos/servicio';
import type { EstadoAccion } from '@/componentes/formulario';

/**
 * Cada acción: 1) exige rol maestro en la empresa, 2) lee el reclamo con la
 * sesión del usuario (si la RLS no se lo deja ver, no existe para él) y
 * solo entonces 3) opera con la clave de servicio (PDF y correo).
 */
async function preparar(datos: FormData) {
  const empresaId = String(datos.get('empresa') ?? '');
  const { usuario } = await exigirAcceso(empresaId, 'reclamos');
  const sb = await supabaseServidor();
  const { data } = await sb
    .from('reclamos')
    .select('*')
    .eq('id', String(datos.get('id') ?? ''))
    .eq('empresa_id', empresaId)
    .maybeSingle();
  const empresa = await cargarEmpresa(empresaId);
  if (!data || !empresa) throw new Error('Reclamo no encontrado.');
  return { reclamo: data as Reclamo, empresa, usuario, sb };
}

export async function responder(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { reclamo, empresa, usuario } = await preparar(datos);
    if (reclamo.estado === 'respondido') return { ok: false, mensaje: 'Este reclamo ya fue respondido.' };

    const respuesta = String(datos.get('respuesta') ?? '').trim();
    if (respuesta.length < 20) return { ok: false, mensaje: 'La respuesta es demasiado breve.' };
    if (respuesta.length > 6000) return { ok: false, mensaje: 'La respuesta supera los 6000 caracteres.' };

    const r = await responderReclamo(empresa, reclamo, respuesta, usuario.id);
    refresh();
    return r.correoEnviado
      ? { ok: true, mensaje: 'Respuesta guardada y enviada al consumidor con la hoja actualizada.' }
      : {
          ok: true,
          tono: 'aviso',
          mensaje: `Respuesta guardada y PDF actualizado, pero el correo no salió: ${r.motivo}. Puede reenviarla después.`,
        };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo guardar la respuesta.' };
  }
}

export async function marcarEnProceso(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { reclamo, sb } = await preparar(datos);
    if (reclamo.estado !== 'pendiente') return { ok: false, mensaje: 'El reclamo ya no está pendiente.' };
    const { error } = await sb.from('reclamos').update({ estado: 'en_proceso' }).eq('id', reclamo.id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, mensaje: 'Marcado en proceso.' };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo actualizar.' };
  }
}

export async function reenviarAvisos(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { reclamo, empresa } = await preparar(datos);
    const pdf = (reclamo.pdf_path && (await descargarPdf(reclamo.pdf_path))) || (await guardarPdf(empresa, reclamo)).pdf;
    const r = await avisarRegistro(empresa, reclamo, pdf);
    refresh();
    return r.constancia && r.aviso
      ? { ok: true, mensaje: 'Constancia y aviso enviados.' }
      : { ok: false, mensaje: `No se pudo enviar: ${r.errores.join(' · ')}` };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo reenviar.' };
  }
}

export async function reenviarRespuesta(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { reclamo, empresa } = await preparar(datos);
    if (!reclamo.respuesta) return { ok: false, mensaje: 'El reclamo aún no tiene respuesta.' };
    const r = await enviarRespuestaGuardada(empresa, reclamo);
    refresh();
    return r.correoEnviado
      ? { ok: true, mensaje: 'Respuesta reenviada al consumidor.' }
      : { ok: false, mensaje: `No se pudo enviar: ${r.motivo}` };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo reenviar.' };
  }
}
