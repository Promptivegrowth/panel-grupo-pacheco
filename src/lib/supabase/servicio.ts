import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con la clave de servicio: salta la RLS. Solo para la API pública
 * de formularios (numerar reclamos, guardar, subir el PDF) y para firmar
 * enlaces a archivos privados tras comprobar el rol del usuario.
 * Nunca se importa desde código que llegue al navegador.
 */
export function supabaseServicio() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
