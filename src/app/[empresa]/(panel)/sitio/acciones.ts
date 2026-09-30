'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { EstadoAccion } from '@/componentes/formulario';

/**
 * Edición de los datos de contacto que muestran las webs. Se guarda con la
 * sesión del usuario: la RLS solo deja escribir al rol maestro.
 */

export type TipoDato = 'whatsapp' | 'telefono' | 'correo' | 'direccion' | 'horario' | 'red';
const TIPOS = ['whatsapp', 'telefono', 'correo', 'direccion', 'horario', 'red'] as const;
const REDES = ['linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'x'] as const;

const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\/[^\s]+\.[^\s]+/.test(v), 'Debe ser un enlace completo que empiece por https://');

const soloDigitos = (v: string) => v.replace(/[^\d]/g, '');

/** Valida y normaliza el valor según el tipo de dato. */
function validar(tipo: TipoDato, datos: FormData) {
  const etiqueta = String(datos.get('etiqueta') ?? '').trim().slice(0, 60);
  const etiquetaEn = datos.has('etiqueta_en') ? String(datos.get('etiqueta_en') ?? '').trim().slice(0, 60) || null : undefined;
  const valorCrudo = String(datos.get('valor') ?? '').trim();
  const detalleCrudo = String(datos.get('detalle') ?? '').trim();
  const valorEn = String(datos.get('valor_en') ?? '').trim().slice(0, 200) || null;
  const visible = datos.get('visible') === 'on';
  // Dónde se muestra (solo si el formulario trae esas casillas).
  const lugares = datos.getAll('mostrar_en').map(String).filter((l) => l === 'pie' || l === 'contacto');
  const mostrarEn = datos.has('mostrar_en_campo') ? { mostrar_en: lugares } : {};

  switch (tipo) {
    case 'whatsapp': {
      const n = soloDigitos(valorCrudo);
      if (!/^\d{9,15}$/.test(n)) return { error: 'Escriba el número con código de país, por ejemplo 51 942 319 378.' };
      if (n.length === 9) return { error: 'Falta el código de país: para Perú, anteponga 51.' };
      return { fila: { etiqueta: etiqueta || 'WhatsApp', valor: n, detalle: detalleCrudo.slice(0, 500) || null, visible } };
    }
    case 'telefono': {
      const n = soloDigitos(valorCrudo);
      if (!/^\d{6,15}$/.test(n)) return { error: 'Número de teléfono no válido.' };
      if (!etiqueta) return { error: 'Indique a qué área corresponde el teléfono.' };
      return { fila: { etiqueta, etiqueta_en: etiquetaEn, valor: n, visible, ...mostrarEn } };
    }
    case 'correo': {
      const r = z.email().max(150).safeParse(valorCrudo.toLowerCase());
      if (!r.success) return { error: 'Correo electrónico no válido.' };
      if (!etiqueta) return { error: 'Indique a qué área corresponde el correo.' };
      return { fila: { etiqueta, etiqueta_en: etiquetaEn, valor: r.data, visible, ...mostrarEn } };
    }
    case 'direccion': {
      if (valorCrudo.length < 8) return { error: 'La dirección es demasiado corta.' };
      if (detalleCrudo) {
        const r = url.safeParse(detalleCrudo);
        if (!r.success) return { error: 'El enlace del mapa debe empezar por https://' };
      }
      return { fila: { etiqueta: etiqueta || 'Dirección', valor: valorCrudo.slice(0, 250), detalle: detalleCrudo || null, visible } };
    }
    case 'horario': {
      if (valorCrudo.length < 4) return { error: 'Escriba el horario.' };
      return { fila: { etiqueta: etiqueta || 'Horario', valor: valorCrudo.slice(0, 200), valor_en: valorEn, visible } };
    }
    case 'red': {
      const red = String(datos.get('red') ?? '');
      if (!REDES.includes(red as (typeof REDES)[number])) return { error: 'Elija la red social.' };
      const r = url.safeParse(valorCrudo);
      if (!r.success) return { error: r.error.issues[0]?.message ?? 'Enlace no válido.' };
      const nombres: Record<string, string> = {
        linkedin: 'LinkedIn',
        facebook: 'Facebook',
        instagram: 'Instagram',
        youtube: 'YouTube',
        tiktok: 'TikTok',
        x: 'X',
      };
      return { fila: { etiqueta: nombres[red], valor: r.data, red, visible } };
    }
  }
  throw new Error('Tipo de dato no válido.');
}

async function contexto(datos: FormData) {
  const empresaId = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresaId, 'sitio');
  const tipo = String(datos.get('tipo') ?? '') as TipoDato;
  if (!TIPOS.includes(tipo)) throw new Error('Tipo de dato no válido.');
  return { empresaId, tipo, sb: await supabaseServidor() };
}

export async function guardarDato(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { empresaId, tipo, sb } = await contexto(datos);
    const v = validar(tipo, datos);
    if ('error' in v) return { ok: false, mensaje: v.error! };

    const id = String(datos.get('id') ?? '');
    if (id) {
      const { error } = await sb.from('datos_contacto').update(v.fila).eq('id', id).eq('empresa_id', empresaId);
      if (error) throw new Error(error.message);
    } else {
      // Nuevo: al final de su grupo.
      const { data: ultimo } = await sb
        .from('datos_contacto')
        .select('orden')
        .eq('empresa_id', empresaId)
        .eq('tipo', tipo)
        .order('orden', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await sb
        .from('datos_contacto')
        .insert({ ...v.fila, empresa_id: empresaId, tipo, orden: (ultimo?.orden ?? 0) + 1 });
      if (error) throw new Error(error.message);
    }
    refresh();
    return { ok: true, mensaje: id ? 'Guardado. La web lo mostrará al recargar.' : 'Agregado. La web lo mostrará al recargar.' };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo guardar.' };
  }
}

export async function eliminarDato(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { empresaId, tipo, sb } = await contexto(datos);
    if (tipo === 'whatsapp') {
      const { count } = await sb
        .from('datos_contacto')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('tipo', 'whatsapp');
      if ((count ?? 0) <= 1) return { ok: false, mensaje: 'La web necesita al menos un WhatsApp. Edítelo en lugar de borrarlo.' };
    }
    const { error } = await sb.from('datos_contacto').delete().eq('id', String(datos.get('id'))).eq('empresa_id', empresaId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, mensaje: 'Eliminado.' };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo eliminar.' };
  }
}

export async function moverDato(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { empresaId, tipo, sb } = await contexto(datos);
    const id = String(datos.get('id'));
    const sentido = datos.get('sentido') === 'arriba' ? -1 : 1;

    const { data: filas } = await sb
      .from('datos_contacto')
      .select('id, orden')
      .eq('empresa_id', empresaId)
      .eq('tipo', tipo)
      .order('orden')
      .order('id');
    const lista = filas ?? [];
    const i = lista.findIndex((f) => f.id === id);
    const j = i + sentido;
    if (i < 0 || j < 0 || j >= lista.length) return null;

    // Se renumera todo el grupo para que el orden quede siempre limpio.
    [lista[i], lista[j]] = [lista[j], lista[i]];
    await Promise.all(
      lista.map((f, k) => sb.from('datos_contacto').update({ orden: k + 1 }).eq('id', f.id).eq('empresa_id', empresaId)),
    );
    refresh();
    return null;
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo reordenar.' };
  }
}
