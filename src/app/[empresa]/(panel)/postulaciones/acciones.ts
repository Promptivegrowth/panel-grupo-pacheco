'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ESTADOS, NOMBRE_ESTADO, type EstadoPostulacion } from '@/lib/postulaciones';
import type { EstadoAccion } from '@/componentes/formulario';

/** Todas pasan por la sesión del usuario: la RLS decide qué puede tocar. */
async function preparar(datos: FormData) {
  const empresaId = String(datos.get('empresa') ?? '');
  const { usuario } = await exigirAcceso(empresaId, 'postulaciones');
  return { empresaId, usuario, id: String(datos.get('id') ?? ''), sb: await supabaseServidor() };
}

export async function cambiarEstado(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const { empresaId, usuario, id, sb } = await preparar(datos);
  const estado = String(datos.get('estado')) as EstadoPostulacion;
  if (!ESTADOS.includes(estado)) return { ok: false, mensaje: 'Estado no válido.' };

  const { error } = await sb
    .from('postulaciones')
    .update({ estado, actualizado_por: usuario.id })
    .eq('id', id)
    .eq('empresa_id', empresaId);
  if (error) return { ok: false, mensaje: 'No se pudo cambiar el estado.' };
  refresh();
  return { ok: true, mensaje: `Marcada como «${NOMBRE_ESTADO[estado].toLowerCase()}».` };
}

export async function guardarNotas(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const { empresaId, usuario, id, sb } = await preparar(datos);
  const notas = String(datos.get('notas') ?? '').trim().slice(0, 4000);
  const { error } = await sb
    .from('postulaciones')
    .update({ notas: notas || null, actualizado_por: usuario.id })
    .eq('id', id)
    .eq('empresa_id', empresaId);
  if (error) return { ok: false, mensaje: 'No se pudieron guardar las notas.' };
  refresh();
  return { ok: true, mensaje: 'Notas guardadas.' };
}

/** Borra la postulación y su CV (p. ej. pruebas, o a pedido del postulante). */
export async function eliminarPostulacion(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const { empresaId, id, sb } = await preparar(datos);
  const { data } = await sb.from('postulaciones').select('cv_path').eq('id', id).eq('empresa_id', empresaId).maybeSingle();
  if (!data) return { ok: false, mensaje: 'La postulación ya no existe.' };

  if (data.cv_path) {
    const { error: errCv } = await sb.storage.from('postulaciones').remove([data.cv_path]);
    if (errCv) return { ok: false, mensaje: 'No se pudo borrar el CV. Inténtelo de nuevo.' };
  }
  const { error } = await sb.from('postulaciones').delete().eq('id', id).eq('empresa_id', empresaId);
  if (error) return { ok: false, mensaje: 'No se pudo eliminar la postulación.' };
  redirect(`/${empresaId}/postulaciones?eliminada=1`);
}
