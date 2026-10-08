/**
 * Carga el catálogo de Q-MEDICAL en la base, a partir del archivo que hoy
 * vive en el repositorio de la web.
 *
 * Se ejecuta una sola vez, al poner en marcha la edición desde el panel: a
 * partir de ahí la fuente es la base y este guion no vuelve a usarse.
 *
 *   node scripts/sembrar-catalogo.mjs <ruta a qmedical-web> [--borrar]
 *
 * Con --borrar vacía primero las tablas del catálogo de esa empresa, para
 * poder repetir la siembra mientras se ajusta. Sin eso, se niega a sembrar
 * sobre un catálogo que ya tiene datos: sería duplicarlo.
 *
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE en .env.local.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const EMPRESA = 'qmedical';
const raiz = path.resolve(import.meta.dirname, '..');

const web = process.argv[2];
const borrar = process.argv.includes('--borrar');
if (!web) {
  console.error('Uso: node scripts/sembrar-catalogo.mjs <ruta a qmedical-web> [--borrar]');
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
const CLAVE = env.SUPABASE_SERVICE_ROLE;
if (!URL_BASE || !CLAVE) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE en .env.local');
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

/* ── El catálogo, leído del módulo de la web ───────────────────────────
   El archivo es TypeScript, así que se extraen los literales en vez de
   importarlo: evita arrastrar un compilador solo para una siembra. */
const fuente = await readFile(path.join(web, 'src/data/catalogo.ts'), 'utf8');
const manifest = JSON.parse(
  await readFile(path.join(web, 'public/img/manifest.json'), 'utf8')
);

function bloque(nombre) {
  const i = fuente.indexOf(`export const ${nombre}`);
  const j = fuente.indexOf('\n];', i);
  return fuente.slice(fuente.indexOf('[', i) + 1, j);
}

/** Convierte los literales de un bloque en objetos, sin evaluar código. */
function objetos(texto) {
  const out = [];
  let nivel = 0;
  let desde = -1;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '{') {
      if (nivel === 0) desde = i;
      nivel++;
    } else if (texto[i] === '}') {
      nivel--;
      if (nivel === 0) out.push(texto.slice(desde, i + 1));
    }
  }
  return out;
}

const campo = (t, nombre) => {
  const m = t.match(new RegExp(`\\b${nombre}:\\s*((?:'(?:[^'\\\\]|\\\\.)*'\\s*\\+?\\s*)+)`));
  if (!m) return null;
  return [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map((x) => x[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'))
    .join('');
};

const lista = (t, nombre) => {
  const m = t.match(new RegExp(`\\b${nombre}:\\s*\\[([^\\]]*)\\]`, 's'));
  if (!m) return [];
  return [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1].replace(/\\'/g, "'"));
};

const lineas = objetos(bloque('lineas')).map((t, i) => ({
  slug: campo(t, 'slug'), nombre: campo(t, 'nombre'),
  resumen: campo(t, 'resumen') ?? '', icono: campo(t, 'icono') ?? '', orden: i,
}));

const categorias = objetos(bloque('categorias')).map((t, i) => ({
  slug: campo(t, 'slug'), nombre: campo(t, 'nombre'),
  linea: campo(t, 'linea'), orden: i,
}));

/* Los productos llevan presentaciones anidadas: se parten por el nivel
   superior y de cada uno se extrae su propio arreglo. */
const productos = objetos(bloque('productos')).map((t, i) => {
  const pres = t.indexOf('presentaciones:');
  const cabeza = t.slice(0, pres);
  return {
    slug: campo(cabeza, 'slug'),
    nombre: campo(cabeza, 'nombre'),
    linea: campo(cabeza, 'linea'),
    categoria: campo(cabeza, 'categoria'),
    descripcion: campo(cabeza, 'descripcion') ?? '',
    destacado: /destacado:\s*true/.test(cabeza),
    orden: i,
    presentaciones: objetos(t.slice(pres)).map((p, j) => ({
      medida: campo(p, 'medida') ?? '',
      marca: campo(p, 'marca') ?? '',
      marca_slug: campo(p, 'marcaSlug'),
      unidad: campo(p, 'unidad') ?? '',
      caracteristicas: lista(p, 'caracteristicas'),
      descripcion: campo(p, 'descripcion'),
      orden: j,
    })),
  };
});

console.log('leido: %d lineas, %d categorias, %d productos, %d presentaciones',
  lineas.length, categorias.length, productos.length,
  productos.reduce((n, p) => n + p.presentaciones.length, 0));

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
for (const l of lineas) {
  const [fila] = await rest('catalogo_lineas', {
    method: 'POST',
    body: JSON.stringify({ empresa_id: EMPRESA, ...l }),
  });
  idLinea[l.slug] = fila.id;
}
console.log('lineas sembradas: %d', lineas.length);

const idCat = {};
for (const c of categorias) {
  const [fila] = await rest('catalogo_categorias', {
    method: 'POST',
    body: JSON.stringify({
      empresa_id: EMPRESA, linea_id: idLinea[c.linea],
      slug: c.slug, nombre: c.nombre, orden: c.orden,
    }),
  });
  idCat[c.slug] = fila.id;
}
console.log('categorias sembradas: %d', categorias.length);

let nPres = 0;
for (const p of productos) {
  const [fila] = await rest('catalogo_productos', {
    method: 'POST',
    body: JSON.stringify({
      empresa_id: EMPRESA, categoria_id: idCat[p.categoria],
      slug: p.slug, nombre: p.nombre, descripcion: p.descripcion,
      destacado: p.destacado, orden: p.orden,
    }),
  });
  const fotos = manifest.productos?.[p.slug] ?? [];
  const cuerpo = p.presentaciones.map((pr, j) => ({
    producto_id: fila.id,
    ...pr,
    // La foto viaja como la ruta que ya tiene la web; al subir una nueva
    // desde el panel, pasa a ser la del bucket.
    imagen: fotos[j] || null,
  }));
  if (cuerpo.length) {
    await rest('catalogo_presentaciones', { method: 'POST', body: JSON.stringify(cuerpo) });
    nPres += cuerpo.length;
  }
}
console.log('productos sembrados: %d, con %d presentaciones', productos.length, nPres);
console.log('listo');
