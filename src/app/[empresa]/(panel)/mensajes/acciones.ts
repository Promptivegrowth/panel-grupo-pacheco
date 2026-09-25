'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { EstadoAccion } from '@/componentes/formulario';

/** Todas pasan por la sesión del usuario: la RLS decide qué puede tocar. */
async function preparar(datos: FormData) {
  const empresaId = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresaId, 'mensajes');
  return { empresaId, id: String(datos.get('id') ?? ''), sb: await supabaseServidor() };
}

export async function cambiarMensaje(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const { empresaId, id, sb } = await preparar(datos);
  const operacion = String(datos.get('operacion'));
  const cambios: Record<string, boolean> =
    operacion === 'no-leido'
      ? { leido: false }
      : operacion === 'archivar'
        ? { archivado: true, leido: true }
        : operacion === 'desarchivar'
          ? { archivado: false }
          : {};
  if (!Object.keys(cambios).length) return { ok: false, mensaje: 'Operación no válida.' };

  const { error } = await sb.from('mensajes').update(cambios).eq('id', id).eq('empresa_id', empresaId);
  if (error) return { ok: false, mensaje: 'No se pudo actualizar el mensaje.' };
  if (operacion === 'no-leido' || operacion === 'archivar') redirect(`/${empresaId}/mensajes`);
  refresh();
  return { ok: true, mensaje: 'Mensaje restaurado a la bandeja.' };
}

export async function eliminarMensaje(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const { empresaId, id, sb } = await preparar(datos);
  const { error } = await sb.from('mensajes').delete().eq('id', id).eq('empresa_id', empresaId);
  if (error) return { ok: false, mensaje: 'No se pudo eliminar el mensaje.' };
  redirect(`/${empresaId}/mensajes`);
}
