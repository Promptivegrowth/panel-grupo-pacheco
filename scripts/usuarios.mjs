/**
 * Alta y mantenimiento de usuarios del portal.
 *
 *   node scripts/usuarios.mjs crear   --correo x@y.com --rol maestro --empresas lp,qmedical,woli [--clave …]
 *   node scripts/usuarios.mjs crear   --correo rrhh@y.com --rol empleos --empresas lp
 *   node scripts/usuarios.mjs clave   --correo x@y.com [--clave …]      (nueva contraseña)
 *   node scripts/usuarios.mjs correo  --correo viejo@y.com --nuevo nuevo@y.com
 *   node scripts/usuarios.mjs quitar  --correo x@y.com                  (elimina el usuario)
 *   node scripts/usuarios.mjs listar
 *
 * Sin --clave se genera una aleatoria de 20 caracteres y se muestra una
 * sola vez. Usa SUPABASE_SERVICE_ROLE_KEY de .env.local.
 */
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const raiz = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  (await readFile(path.join(raiz, '.env.local'), 'utf8'))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [, , orden, ...resto] = process.argv;
const args = {};
for (let i = 0; i < resto.length; i += 2) args[resto[i].replace(/^--/, '')] = resto[i + 1];

const generarClave = () => {
  // Sin caracteres ambiguos (0/O, 1/l/I).
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const b = randomBytes(20);
  return Array.from(b, (x) => abc[x % abc.length]).join('');
};

async function buscar(correo) {
  let pagina = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === correo.toLowerCase());
    if (u || data.users.length < 200) return u ?? null;
    pagina++;
  }
}

function exigir(...campos) {
  for (const c of campos) if (!args[c]) throw new Error(`Falta --${c}`);
}

switch (orden) {
  case 'crear': {
    exigir('correo', 'rol', 'empresas');
    if (!['maestro', 'empleos'].includes(args.rol)) throw new Error('--rol debe ser maestro o empleos');
    const empresas = args.empresas.split(',').map((e) => e.trim()).filter(Boolean);
    const clave = args.clave ?? generarClave();

    let usuario = await buscar(args.correo);
    if (usuario) {
      console.log(`El usuario ${args.correo} ya existe: solo se actualizan sus accesos.`);
    } else {
      const { data, error } = await sb.auth.admin.createUser({ email: args.correo, password: clave, email_confirm: true });
      if (error) throw error;
      usuario = data.user;
      console.log(`Usuario creado: ${args.correo}\nContraseña: ${clave}\n(guárdela: no se volverá a mostrar)`);
    }

    // Los accesos se reemplazan por los indicados.
    await sb.from('miembros').delete().eq('user_id', usuario.id);
    const { error } = await sb.from('miembros').insert(empresas.map((empresa_id) => ({ user_id: usuario.id, empresa_id, rol: args.rol })));
    if (error) throw error;
    console.log(`Accesos: ${empresas.join(', ')} · rol ${args.rol}`);
    break;
  }
  case 'clave': {
    exigir('correo');
    const u = await buscar(args.correo);
    if (!u) throw new Error('Usuario no encontrado');
    const clave = args.clave ?? generarClave();
    const { error } = await sb.auth.admin.updateUserById(u.id, { password: clave });
    if (error) throw error;
    console.log(`Nueva contraseña de ${args.correo}: ${clave}`);
    break;
  }
  case 'correo': {
    exigir('correo', 'nuevo');
    const u = await buscar(args.correo);
    if (!u) throw new Error('Usuario no encontrado');
    const { error } = await sb.auth.admin.updateUserById(u.id, { email: args.nuevo, email_confirm: true });
    if (error) throw error;
    console.log(`Correo cambiado: ${args.correo} → ${args.nuevo}`);
    break;
  }
  case 'quitar': {
    exigir('correo');
    const u = await buscar(args.correo);
    if (!u) throw new Error('Usuario no encontrado');
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (error) throw error;
    console.log(`Usuario eliminado: ${args.correo}`);
    break;
  }
  case 'listar': {
    const { data } = await sb.auth.admin.listUsers({ perPage: 200 });
    const { data: miembros } = await sb.from('miembros').select('user_id, empresa_id, rol');
    for (const u of data.users) {
      const accesos = (miembros ?? []).filter((m) => m.user_id === u.id).map((m) => `${m.empresa_id}:${m.rol}`);
      console.log(`${u.email.padEnd(40)} ${accesos.join(', ') || '(sin accesos)'}`);
    }
    break;
  }
  default:
    console.log('Órdenes: crear, clave, correo, quitar, listar. Ver el encabezado del script.');
}
