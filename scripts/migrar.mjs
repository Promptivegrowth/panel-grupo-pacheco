/**
 * Aplica las migraciones de supabase/migrations/ en orden, a través de la
 * API de gestión de Supabase. Cada archivo se ejecuta una sola vez: quedan
 * anotados en interno.migraciones.
 *
 *   node scripts/migrar.mjs            aplica las pendientes
 *   node scripts/migrar.mjs --estado   solo muestra cuáles faltan
 *
 * Requiere SUPABASE_ACCESS_TOKEN y SUPABASE_PROJECT_REF en .env.local.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');

// .env.local sin dependencias
const env = Object.fromEntries(
  (await readFile(path.join(raiz, '.env.local'), 'utf8'))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = env;
if (!token || !ref) throw new Error('Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF en .env.local');

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${texto}`);
  return JSON.parse(texto);
}

await sql(`
  create schema if not exists interno;
  revoke all on schema interno from public, anon, authenticated;
  create table if not exists interno.migraciones (
    nombre    text primary key,
    aplicada  timestamptz not null default now()
  );
`);

const hechas = new Set((await sql('select nombre from interno.migraciones')).map((f) => f.nombre));
const dir = path.join(raiz, 'supabase', 'migrations');
const archivos = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const pendientes = archivos.filter((f) => !hechas.has(f));

if (process.argv.includes('--estado')) {
  for (const f of archivos) console.log(`${hechas.has(f) ? '✓' : '·'} ${f}`);
  process.exit(0);
}

if (!pendientes.length) {
  console.log('Sin migraciones pendientes.');
  process.exit(0);
}

for (const f of pendientes) {
  const cuerpo = await readFile(path.join(dir, f), 'utf8');
  // Todo el archivo en una transacción: o entra entero o no entra.
  await sql(`begin;\n${cuerpo}\ninsert into interno.migraciones (nombre) values ('${f}');\ncommit;`);
  console.log(`✓ ${f}`);
}
