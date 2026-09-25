import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refresca la sesión de Supabase en cada petición y manda a la pantalla de
 * acceso a quien entra al panel sin sesión. La autorización por empresa y
 * rol NO se decide aquí: la hace `exigirAcceso` en el servidor.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value } of lista) request.cookies.set(name, value);
          respuesta = NextResponse.next({ request });
          for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await sb.auth.getClaims();
  const conSesion = Boolean(data?.claims?.sub);

  // /{empresa}/... salvo la pantalla de acceso
  const [, empresa, seccion] = request.nextUrl.pathname.split('/');
  const esPanel = ['lp', 'qmedical', 'woli'].includes(empresa) && seccion !== 'ingresar';

  if (esPanel && !conSesion) {
    const url = request.nextUrl.clone();
    url.pathname = `/${empresa}/ingresar`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  matcher: [
    // Todo salvo la API pública, estáticos y archivos con extensión.
    '/((?!api/publico|_next/static|_next/image|marcas/|.*\\.(?:png|jpg|svg|ico|webp|pdf)$).*)',
  ],
};
