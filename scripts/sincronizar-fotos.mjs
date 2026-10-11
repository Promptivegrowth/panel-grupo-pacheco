/**
 * Vuelve a emparejar las fotografías del repositorio con las presentaciones
 * de la base.
 *
 *   node scripts/sincronizar-fotos.mjs <ruta a qmedical-web> [--aplicar]
 *
 * Sin --aplicar solo dice qué cambiaría.
 *
 * Hace falta cuando se corrige el mapeo de imágenes de la web: el guion de
 * imágenes les pone la huella del contenido en el nombre, así que arreglar
 * una foto mal asignada cambia su dirección, y la base se queda apuntando a
 * un archivo que ya no existe.
 *
 * Las fotos subidas desde el panel no se tocan: se reconocen porque su valor
 * es una dirección completa, y son las únicas que la empresa puso a mano.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const EMPRESA = 'qmedical';
const raiz = path.resolve(import.meta.dirname, '..');

const web = process.argv[2];
const aplicar = process.argv.includes('--aplicar');
if (!web) {
  console.error('Uso: node scripts/sincronizar-fotos.mjs <ruta a qmedical-web> [--aplicar]');
  process.exit(1);
}

const env = Object.fromEntries(
  (await readFile(path.join(raiz, '.env.local'), 'utf8'))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const CLAVE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !CLAVE) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

async function rest(ruta, opciones = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
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
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : [];
}

const manifest = JSON.parse(
  await readFile(path.join(web, 'public/img/manifest.json'), 'utf8')
);

const productos = await rest(
  `catalogo_productos?empresa_id=eq.${EMPRESA}&select=id,slug,nombre,` +
    `catalogo_presentaciones(id,medida,imagen,orden)`
);

let iguales = 0;
const cambios = [];
let subidas = 0;

for (const p of productos) {
  const fotos = manifest.productos?.[p.slug] ?? [];
  const pres = [...p.catalogo_presentaciones].sort((a, b) => a.orden - b.orden);
  pres.forEach((pr, i) => {
    if (pr.imagen && /^https?:\/\//.test(pr.imagen)) { subidas++; return; }
    const debe = fotos[i] || null;
    if ((pr.imagen ?? null) === debe) { iguales++; return; }
    cambios.push({ id: pr.id, de: pr.imagen, a: debe, que: `${p.nombre} — ${pr.medida || '(sin medida)'}` });
  });
}

console.log('presentaciones ya correctas: %d', iguales);
console.log('fotografías subidas desde el panel (no se tocan): %d', subidas);
console.log('presentaciones a corregir: %d\n', cambios.length);
for (const c of cambios) {
  console.log('  %s\n      de: %s\n       a: %s', c.que, c.de ?? '(sin foto)', c.a ?? '(sin foto)');
}

if (!cambios.length) process.exit(0);
if (!aplicar) {
  console.log('\n(solo se mostró lo que cambiaría; use --aplicar)');
  process.exit(0);
}

for (const c of cambios) {
  await rest(`catalogo_presentaciones?id=eq.${c.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ imagen: c.a }),
  });
}
console.log('\naplicados %d cambios', cambios.length);
