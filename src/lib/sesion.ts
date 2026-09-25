import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { empresaUI, modulosPara, type EmpresaUI, type Modulo, type Rol } from '@/lib/empresas';

/**
 * Capa de acceso. Toda página y acción del panel pasa por `exigirAcceso`:
 * el proxy solo refresca la sesión, la autorización se decide aquí y, en
 * última instancia, en la RLS de la base de datos.
 */

export const usuarioActual = cache(async () => {
  const sb = await supabaseServidor();
  const { data, error } = await sb.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub as string, correo: (data.claims.email as string) ?? '' };
});

export const rolEn = cache(async (empresaId: string): Promise<Rol | null> => {
  const usuario = await usuarioActual();
  if (!usuario) return null;
  const sb = await supabaseServidor();
  const { data } = await sb
    .from('miembros')
    .select('rol')
    .eq('empresa_id', empresaId)
    .eq('user_id', usuario.id)
    .maybeSingle();
  return (data?.rol as Rol) ?? null;
});

export type Acceso = {
  usuario: { id: string; correo: string };
  rol: Rol;
  empresa: EmpresaUI;
  modulos: Modulo[];
};

export async function exigirAcceso(empresaId: string, modulo?: Modulo): Promise<Acceso> {
  const empresa = empresaUI(empresaId);
  if (!empresa) redirect('/');

  const usuario = await usuarioActual();
  if (!usuario) redirect(`/${empresa.id}/ingresar`);

  const rol = await rolEn(empresa.id);
  if (!rol) redirect(`/${empresa.id}/ingresar?error=sin-acceso`);

  const modulos = modulosPara(empresa, rol);
  if (modulo && !modulos.includes(modulo)) redirect(`/${empresa.id}`);

  return { usuario, rol, empresa, modulos };
}
