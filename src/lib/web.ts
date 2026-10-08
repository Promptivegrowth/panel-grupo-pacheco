import 'server-only';

/**
 * Dónde vive la web de cada empresa.
 *
 * El panel la necesita para mostrar las fotografías del catálogo que vinieron
 * con el repositorio: se guardan como rutas relativas a /img/, y para verlas
 * hay que anteponer el sitio que las sirve.
 *
 * Normalmente es `empresas.sitio_url`. Pero mientras un dominio todavía
 * apunta al hosting anterior —el caso de qmedicalsac.com— esa dirección no
 * sirve las fotos del despliegue nuevo, así que admite una anulación por
 * entorno:
 *
 *   WEB_QMEDICAL=https://qmedical.vercel.app
 *
 * Cuando el dominio apunte al despliegue, se borra la variable y vuelve a
 * usarse `sitio_url` sin tocar código.
 */
export function baseWeb(empresaId: string, sitioUrl?: string | null): string {
  const env = process.env[`WEB_${empresaId.toUpperCase()}`];
  const url = env && /^https?:\/\//.test(env) ? env : (sitioUrl ?? '');
  return url.replace(/\/$/, '');
}
