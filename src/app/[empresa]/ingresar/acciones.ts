'use server';

import { redirect } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { empresaUI } from '@/lib/empresas';
import type { EstadoAccion } from '@/componentes/formulario';

export async function ingresar(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const empresa = empresaUI(String(datos.get('empresa') ?? ''));
  if (!empresa) return { ok: false, mensaje: 'Empresa no válida.' };

  const correo = String(datos.get('correo') ?? '').trim().toLowerCase();
  const clave = String(datos.get('clave') ?? '');
  if (!correo || !clave) return { ok: false, mensaje: 'Escriba su correo y su contraseña.' };

  const sb = await supabaseServidor();
  const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
  if (error || !data.user) {
    // Mismo mensaje para usuario inexistente y contraseña errónea.
    return { ok: false, mensaje: 'Correo o contraseña incorrectos.' };
  }

  const { data: miembro } = await sb
    .from('miembros')
    .select('rol')
    .eq('empresa_id', empresa.id)
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (!miembro) {
    await sb.auth.signOut();
    return { ok: false, mensaje: `Este usuario no tiene acceso a ${empresa.nombre}.` };
  }

  redirect(`/${empresa.id}`);
}

export async function salir(datos: FormData) {
  const sb = await supabaseServidor();
  await sb.auth.signOut();
  const destino = String(datos.get('destino') ?? '/');
  redirect(destino.startsWith('/') ? destino : '/');
}
