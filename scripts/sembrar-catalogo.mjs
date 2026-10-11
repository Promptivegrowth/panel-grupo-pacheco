/**
 * Carga el catálogo de Q-MEDICAL en la base, a partir de los archivos que hoy
 * viven en el repositorio de la web.
 *
 * Se ejecuta una sola vez, al poner en marcha la edición desde el panel: a
 * partir de ahí la fuente es la base y este guion no vuelve a usarse.
 *
 *   node --experimental-strip-types scripts/sembrar-catalogo.mjs <ruta a qmedical-web> [--borrar]
 *
 * El indicador de Node hace falta porque el catálogo de la web está en
 * TypeScript y aquí se importa tal cual, sin compilarlo: así lo que se siembra
 * es exactamente lo que publica la web, sin un lector propio que pueda
 * entender de otra manera un literal. En Node 22.18 o posterior ya está
 * activado y el indicador sobra.
 *
 * Con --borrar vacía primero las tablas del catálogo de esa empresa, para
 * poder repetir la siembra mientras se ajusta. Sin eso, se niega a sembrar
 * sobre un catálogo que ya tiene datos: sería duplicarlo.
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EMPRESA = 'qmedical';
const raiz = path.resolve(import.meta.dirname, '..');

const web = process.argv[2];
const borrar = process.argv.includes('--borrar');
if (!web) {
  console.error('Uso: node --experimental-strip-types scripts/sembrar-catalogo.mjs <ruta a qmedical-web> [--borrar]');
  process.exit(1);
}

// .env.local sin dependencias, igual que migrar.mjs
const env = Object.fromEntries(
  (await readFile(path.join(raiz, '.env.local'), 'utf8'))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const URL_BASE = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !CLAVE) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

async function rest(tabla, opciones = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${tabla}`, {
    ...opciones,
    headers: {
      apikey: CLAVE,
      Authorization: `Bearer ${CLAVE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...opciones.headers,
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${tabla}: ${r.status} ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : [];
}

/* ── El catálogo y su traducción, leídos del repositorio de la web ──── */
const mod = (rel) => import(pathToFileURL(path.join(web, rel)).href);

/* La copia del repositorio, no `catalogo.ts`: ese modulo lee de la base, y
   sembrar desde el seria copiar la base sobre si misma. */
const { lineas, categorias, productos } = await mod('src/data/catalogo-local.ts');
const { lineasEn, categoriasEnCat, productosEn, medidasEn, unidadesEn, caracteristicasEn } =
  await mod('src/i18n/productos-en.ts');
const manifest = JSON.parse(await readFile(path.join(web, 'public/img/manifest.json'), 'utf8'));

const nPres = productos.reduce((n, p) => n + p.presentaciones.length, 0);
console.log('leido: %d lineas, %d categorias, %d productos, %d presentaciones',
  lineas.length, categorias.length, productos.length, nPres);

/* ── Siembra ───────────────────────────────────────────────────────── */
if (borrar) {
  // Las categorías y los productos caen en cascada desde las líneas.
  await rest(`catalogo_lineas?empresa_id=eq.${EMPRESA}`, { method: 'DELETE' });
  console.log('tablas vaciadas');
} else {
  const hay = await rest(`catalogo_lineas?empresa_id=eq.${EMPRESA}&select=id&limit=1`);
  if (hay.length) {
    console.error('Ya hay catalogo cargado para %s. Use --borrar para rehacerlo.', EMPRESA);
    process.exit(1);
  }
}

const idLinea = {};
for (const [i, l] of lineas.entries()) {
  const t = lineasEn[l.slug];
  const [fila] = await rest('catalogo_lineas', {
    method: 'POST',
    body: JSON.stringify({
      empresa_id: EMPRESA,
      slug: l.slug,
      nombre: l.nombre,
      nombre_en: t?.nombre ?? null,
      resumen: l.resumen,
      resumen_en: t?.resumen ?? null,
      icono: l.icono,
      orden: i,
    }),
  });
  idLinea[l.slug] = fila.id;
}
console.log('lineas sembradas: %d', lineas.length);

const idCat = {};
for (const [i, c] of categorias.entries()) {
  const [fila] = await rest('catalogo_categorias', {
    method: 'POST',
    body: JSON.stringify({
      empresa_id: EMPRESA,
      linea_id: idLinea[c.linea],
      slug: c.slug,
      nombre: c.nombre,
      nombre_en: categoriasEnCat[c.slug] ?? null,
      orden: i,
    }),
  });
  idCat[c.slug] = fila.id;
}
console.log('categorias sembradas: %d', categorias.length);

let puestas = 0;
let sinFoto = 0;
for (const [i, p] of productos.entries()) {
  const t = productosEn[p.slug];
  const [fila] = await rest('catalogo_productos', {
    method: 'POST',
    body: JSON.stringify({
      empresa_id: EMPRESA,
      categoria_id: idCat[p.categoria],
      slug: p.slug,
      nombre: p.nombre,
      nombre_en: t?.nombre ?? null,
      descripcion: p.descripcion,
      descripcion_en: t?.descripcion ?? null,
      destacado: Boolean(p.destacado),
      orden: i,
    }),
  });

  const fotos = manifest.productos?.[p.slug] ?? [];
  const cuerpo = p.presentaciones.map((pr, j) => {
    if (!fotos[j]) sinFoto++;
    return {
      producto_id: fila.id,
      medida: pr.medida,
      medida_en: medidasEn[pr.medida] ?? null,
      marca: pr.marca,
      marca_slug: pr.marcaSlug ?? null,
      unidad: pr.unidad,
      unidad_en: unidadesEn[pr.unidad] ?? null,
      caracteristicas: pr.caracteristicas,
      // Línea a línea, como en la web: lo que no esté traducido se queda en
      // castellano al mostrarlo.
      caracteristicas_en: pr.caracteristicas.map((c) => caracteristicasEn[c] ?? c),
      descripcion: pr.descripcion ?? null,
      descripcion_en: t?.descripciones?.[j] ?? null,
      // La foto viaja como la ruta que ya tiene la web; al subir una nueva
      // desde el panel, pasa a ser la del bucket.
      imagen: fotos[j] || null,
      orden: j,
    };
  });
  if (cuerpo.length) {
    await rest('catalogo_presentaciones', { method: 'POST', body: JSON.stringify(cuerpo) });
    puestas += cuerpo.length;
  }
}
console.log('productos sembrados: %d, con %d presentaciones (%d sin fotografia)',
  productos.length, puestas, sinFoto);
console.log('listo');
