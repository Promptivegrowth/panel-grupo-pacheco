import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Borra postulaciones y sus CV del bucket con la sesión del usuario (la RLS
 * exige rol maestro o empleos en la empresa). Primero los archivos: si falla
 * el almacenamiento, las filas se quedan y se puede reintentar sin dejar CV
 * huérfanos ocupando espacio.
 */
export async function borrarPostulaciones(
  sb: SupabaseClient,
  empresaId: string,
  filtro: { id: string } | { empleoId: string },
): Promise<{ ok: true; borradas: number } | { ok: false; mensaje: string }> {
  let consulta = sb.from('postulaciones').select('id, cv_path').eq('empresa_id', empresaId);
  consulta = 'id' in filtro ? consulta.eq('id', filtro.id) : consulta.eq('empleo_id', filtro.empleoId);
  const { data: filas, error: errLee } = await consulta;
  if (errLee) return { ok: false, mensaje: 'No se pudieron leer las postulaciones.' };
  if (!filas?.length) return { ok: true, borradas: 0 };

  const rutas = filas.map((f) => f.cv_path).filter((r): r is string => Boolean(r));
  for (let i = 0; i < rutas.length; i += 100) {
    const { error } = await sb.storage.from('postulaciones').remove(rutas.slice(i, i + 100));
    if (error) return { ok: false, mensaje: 'No se pudieron borrar los CV. Inténtelo de nuevo.' };
  }

  const ids = filas.map((f) => f.id);
  const { error } = await sb.from('postulaciones').delete().eq('empresa_id', empresaId).in('id', ids);
  if (error) return { ok: false, mensaje: 'No se pudieron eliminar las postulaciones.' };
  return { ok: true, borradas: ids.length };
}
