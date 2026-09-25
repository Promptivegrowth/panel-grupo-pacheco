'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { EstadoAccion } from '@/componentes/formulario';

/** Vacantes de «Trabaja con nosotros». Roles: maestro y empleos (RLS). */

const lineas = (max: number) =>
  z
    .string()
    .max(4000)
    .transform((v) =>
      v
        .split(/\r?\n/)
        .map((l) => l.replace(/^[\s•\-–*·]+/, '').trim())
        .filter(Boolean)
        .slice(0, max),
    );

const esquema = z.object({
  titulo: z.string().trim().min(3, 'Escriba el título del puesto.').max(120),
  area: z.string().trim().max(80).transform((v) => v || null),
  ubicacion: z.string().trim().max(80).transform((v) => v || null),
  modalidad: z.enum(['Presencial', 'Híbrido', 'Remoto']),
  jornada: z.enum(['Tiempo completo', 'Medio tiempo', 'Por turnos', 'Prácticas']),
  resumen: z.string().trim().min(20, 'El resumen debe tener al menos 20 caracteres.').max(600),
  requisitos: lineas(15),
  funciones: lineas(15),
  beneficios: lineas(12),
  correo_postulacion: z.email('Correo de postulación no válido.').max(150),
  fecha_cierre: z
    .string()
    .trim()
    .transform((v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  publicado: z.boolean(),
});

export async function guardarEmpleo(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const empresaId = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresaId, 'empleos');

  const r = esquema.safeParse({
    ...Object.fromEntries(
      ['titulo', 'area', 'ubicacion', 'modalidad', 'jornada', 'resumen', 'requisitos', 'funciones', 'beneficios', 'correo_postulacion', 'fecha_cierre'].map(
        (k) => [k, String(datos.get(k) ?? '')],
      ),
    ),
    publicado: datos.get('publicado') === 'on',
  });
  if (!r.success) return { ok: false, mensaje: r.error.issues[0]?.message ?? 'Revise los datos.' };
  if (!r.data.requisitos.length) return { ok: false, mensaje: 'Agregue al menos un requisito.' };

  const sb = await supabaseServidor();
  const id = String(datos.get('id') ?? '');

  if (id) {
    const { error } = await sb.from('empleos').update(r.data).eq('id', id).eq('empresa_id', empresaId);
    if (error) return { ok: false, mensaje: 'No se pudo guardar la vacante.' };
    refresh();
    return { ok: true, mensaje: r.data.publicado ? 'Guardado. Los cambios ya se ven en la web.' : 'Guardado como borrador (no visible en la web).' };
  }

  const { data: nueva, error } = await sb
    .from('empleos')
    .insert({ ...r.data, empresa_id: empresaId, fecha_publicacion: new Date().toISOString().slice(0, 10) })
    .select('id')
    .single();
  if (error || !nueva) return { ok: false, mensaje: 'No se pudo crear la vacante.' };
  redirect(`/${empresaId}/empleos?creada=1`);
}

export async function alternarPublicacion(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const empresaId = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresaId, 'empleos');
  const publicar = datos.get('publicar') === '1';
  const sb = await supabaseServidor();
  const cambios: Record<string, unknown> = { publicado: publicar };
  // Republicar una vacante la trae al día.
  if (publicar) cambios.fecha_publicacion = new Date().toISOString().slice(0, 10);
  const { error } = await sb.from('empleos').update(cambios).eq('id', String(datos.get('id'))).eq('empresa_id', empresaId);
  if (error) return { ok: false, mensaje: 'No se pudo cambiar la publicación.' };
  refresh();
  return null;
}

export async function eliminarEmpleo(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const empresaId = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresaId, 'empleos');
  const sb = await supabaseServidor();
  const { error } = await sb.from('empleos').delete().eq('id', String(datos.get('id'))).eq('empresa_id', empresaId);
  if (error) return { ok: false, mensaje: 'No se pudo eliminar la vacante.' };
  redirect(`/${empresaId}/empleos`);
}
