import 'server-only';

/**
 * Publicación de la web.
 *
 * Las webs del grupo son estáticas: el catálogo se edita en el panel, pero no
 * aparece publicado hasta que el sitio se vuelve a compilar. Vercel ofrece
 * para eso un «deploy hook»: una dirección que, al recibir un POST, encola
 * una compilación de la rama de producción.
 *
 * La dirección de cada empresa va en el entorno, una variable por empresa:
 *
 *   PUBLICAR_QMEDICAL=https://api.vercel.com/v1/integrations/deploy/prj_…/…
 *
 * Se crea en Vercel, en el proyecto de la web: Settings → Git → Deploy Hooks.
 * Es un secreto moderado —quien la tenga puede encolar compilaciones, nada
 * más—, así que vive en el entorno del servidor y no se muestra en pantalla.
 *
 * Sin la variable, la empresa no ve el botón y la web se sigue publicando
 * como hasta ahora, con un empujón del desarrollo.
 */

/** Dirección del hook de una empresa, si está configurada. */
export function hookDe(empresaId: string): string | undefined {
  const v = process.env[`PUBLICAR_${empresaId.toUpperCase()}`];
  return v && /^https:\/\//.test(v) ? v : undefined;
}

export type Publicacion = { ok: boolean; detalle: string };

/** Pide la compilación. No espera a que termine: Vercel solo acusa el encargo. */
export async function pedirPublicacion(empresaId: string): Promise<Publicacion> {
  const hook = hookDe(empresaId);
  if (!hook) return { ok: false, detalle: 'No hay dirección de publicación configurada.' };

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 15000);
  try {
    const r = await fetch(hook, { method: 'POST', signal: control.signal });
    if (!r.ok) return { ok: false, detalle: `Vercel respondió ${r.status}.` };
    return { ok: true, detalle: 'Compilación encolada.' };
  } catch (err) {
    return {
      ok: false,
      detalle: err instanceof Error ? `No se pudo avisar a Vercel: ${err.message}` : 'No se pudo avisar a Vercel.',
    };
  } finally {
    clearTimeout(reloj);
  }
}
