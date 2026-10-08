'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { exigirAcceso, usuarioActual } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { pedirPublicacion } from '@/lib/publicar';
import type { EstadoAccion } from '@/componentes/formulario';

/**
 * Edición del catálogo de productos.
 *
 * La jerarquía es línea → categoría → producto → presentación. Se guarda con
 * la sesión del usuario: la RLS solo deja escribir al rol maestro, igual que
 * en el resto del panel.
 *
 * El `slug` va en la dirección de la web, así que se normaliza aquí y no se
 * deja escribir a mano: un slug con tildes o espacios rompe el enlace, y
 * cambiarlo después deja fuera lo que ya estaba indexado.
 */

const texto = (max: number) => z.string().trim().max(max);

/** «Bolsas de aspiración» -> «bolsas-de-aspiracion». */
function aSlug(t: string): string {
  return t
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/%/g, ' por ciento ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

/**
 * Busca un slug libre. Al renombrar algo que ya existe se conserva el suyo:
 * la dirección publicada no debería moverse porque alguien corrigió una
 * tilde del título.
 */
async function slugLibre(
  sb: Awaited<ReturnType<typeof supabaseServidor>>,
  tabla: string,
  empresaId: string,
  base: string,
  idActual?: string,
): Promise<string> {
  let slug = base || 'sin-nombre';
  for (let i = 2; i < 50; i++) {
    const { data } = await sb
      .from(tabla)
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('slug', slug)
      .maybeSingle();
    if (!data || data.id === idActual) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ═══════════════════════════════════════════════════════════════ líneas */

export async function guardarLinea(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const empresa = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresa, 'catalogo');
  const sb = await supabaseServidor();

  const id = String(datos.get('id') ?? '') || undefined;
  const nombre = texto(120).safeParse(datos.get('nombre') ?? '');
  if (!nombre.success || !nombre.data) return { ok: false, mensaje: 'Escriba el nombre de la línea.' };

  const fila = {
    empresa_id: empresa,
    nombre: nombre.data,
    nombre_en: texto(120).parse(datos.get('nombre_en') ?? '') || null,
    resumen: texto(400).parse(datos.get('resumen') ?? ''),
    resumen_en: texto(400).parse(datos.get('resumen_en') ?? '') || null,
    icono: texto(40).parse(datos.get('icono') ?? ''),
    orden: Number(datos.get('orden') ?? 0) || 0,
    visible: datos.get('visible') === 'on',
    slug: await slugLibre(sb, 'catalogo_lineas', empresa, aSlug(nombre.data), id),
  };

  const { error } = id
    ? await sb.from('catalogo_lineas').update(fila).eq('id', id)
    : await sb.from('catalogo_lineas').insert(fila);
  if (error) return { ok: false, mensaje: 'No se pudo guardar la línea.' };

  refresh();
  return { ok: true, mensaje: id ? 'Línea actualizada.' : 'Línea creada.' };
}

/* ══════════════════════════════════════════════════════════ categorías */

export async function guardarCategoria(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const empresa = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresa, 'catalogo');
  const sb = await supabaseServidor();

  const id = String(datos.get('id') ?? '') || undefined;
  const lineaId = String(datos.get('linea_id') ?? '');
  const nombre = texto(160).safeParse(datos.get('nombre') ?? '');
  if (!lineaId) return { ok: false, mensaje: 'Elija a qué línea pertenece.' };
  if (!nombre.success || !nombre.data) return { ok: false, mensaje: 'Escriba el nombre de la categoría.' };

  const fila = {
    empresa_id: empresa,
    linea_id: lineaId,
    nombre: nombre.data,
    nombre_en: texto(160).parse(datos.get('nombre_en') ?? '') || null,
    orden: Number(datos.get('orden') ?? 0) || 0,
    visible: datos.get('visible') === 'on',
    slug: await slugLibre(sb, 'catalogo_categorias', empresa, aSlug(nombre.data), id),
  };

  const { error } = id
    ? await sb.from('catalogo_categorias').update(fila).eq('id', id)
    : await sb.from('catalogo_categorias').insert(fila);
  if (error) return { ok: false, mensaje: 'No se pudo guardar la categoría.' };

  refresh();
  return { ok: true, mensaje: id ? 'Categoría actualizada.' : 'Categoría creada.' };
}

/* ════════════════════════════════════════════════════════════ productos */

export async function guardarProducto(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const empresa = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresa, 'catalogo');
  const sb = await supabaseServidor();

  const id = String(datos.get('id') ?? '') || undefined;
  const categoriaId = String(datos.get('categoria_id') ?? '');
  const nombre = texto(200).safeParse(datos.get('nombre') ?? '');
  if (!categoriaId) return { ok: false, mensaje: 'Elija a qué categoría pertenece.' };
  if (!nombre.success || !nombre.data) return { ok: false, mensaje: 'Escriba el nombre del producto.' };

  const fila = {
    empresa_id: empresa,
    categoria_id: categoriaId,
    nombre: nombre.data,
    nombre_en: texto(200).parse(datos.get('nombre_en') ?? '') || null,
    descripcion: texto(2000).parse(datos.get('descripcion') ?? ''),
    descripcion_en: texto(2000).parse(datos.get('descripcion_en') ?? '') || null,
    destacado: datos.get('destacado') === 'on',
    orden: Number(datos.get('orden') ?? 0) || 0,
    visible: datos.get('visible') === 'on',
    slug: await slugLibre(sb, 'catalogo_productos', empresa, aSlug(nombre.data), id),
  };

  const { error } = id
    ? await sb.from('catalogo_productos').update(fila).eq('id', id)
    : await sb.from('catalogo_productos').insert(fila);
  if (error) return { ok: false, mensaje: 'No se pudo guardar el producto.' };

  refresh();
  return { ok: true, mensaje: id ? 'Producto actualizado.' : 'Producto creado.' };
}

/* ═══════════════════════════════════════════════════════ presentaciones */

export async function guardarPresentacion(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const empresa = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresa, 'catalogo');
  const sb = await supabaseServidor();

  const id = String(datos.get('id') ?? '') || undefined;
  const productoId = String(datos.get('producto_id') ?? '');
  if (!productoId) return { ok: false, mensaje: 'Falta el producto al que pertenece.' };

  /* Las características llegan una por línea, que es como las escribe quien
     las copia de la ficha del fabricante. La traducción va línea a línea en
     el mismo orden: si trae un número distinto de líneas, se guarda vacía
     antes que desalineada, porque la web empareja por posición. */
  const lineasDe = (campo: string) =>
    String(datos.get(campo) ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 40);

  const caracteristicas = lineasDe('caracteristicas');
  const caracteristicasEn = lineasDe('caracteristicas_en');
  if (caracteristicasEn.length && caracteristicasEn.length !== caracteristicas.length) {
    return {
      ok: false,
      mensaje:
        `Las características en inglés son ${caracteristicasEn.length} líneas y las de ` +
        `castellano ${caracteristicas.length}. La web las empareja línea por línea: ` +
        'deje el mismo número en las dos, o vacío el inglés.',
    };
  }

  const fila = {
    producto_id: productoId,
    medida: texto(80).parse(datos.get('medida') ?? ''),
    medida_en: texto(80).parse(datos.get('medida_en') ?? '') || null,
    marca: texto(80).parse(datos.get('marca') ?? ''),
    marca_slug: texto(60).parse(datos.get('marca_slug') ?? '') || null,
    unidad: texto(60).parse(datos.get('unidad') ?? ''),
    unidad_en: texto(60).parse(datos.get('unidad_en') ?? '') || null,
    caracteristicas,
    caracteristicas_en: caracteristicasEn,
    descripcion: texto(2000).parse(datos.get('descripcion') ?? '') || null,
    descripcion_en: texto(2000).parse(datos.get('descripcion_en') ?? '') || null,
    registro_sanitario: texto(120).parse(datos.get('registro_sanitario') ?? '') || null,
    normativa: texto(200).parse(datos.get('normativa') ?? '') || null,
    orden: Number(datos.get('orden') ?? 0) || 0,
    visible: datos.get('visible') === 'on',
  };

  /* La fotografía se sube aparte, al bucket `catalogo`, bajo la carpeta de
     la empresa: así la política de almacenamiento sabe de quién es. En la
     fila se guarda su dirección pública, que es lo que distingue a una foto
     subida aquí de las que ya venían con la web. */
  const foto = datos.get('foto');
  let imagen: string | undefined;
  if (foto instanceof File && foto.size > 0) {
    if (foto.size > 10 * 1024 * 1024) return { ok: false, mensaje: 'La imagen supera los 10 MB.' };
    const ext = (foto.name.split('.').pop() ?? 'jpg').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      return { ok: false, mensaje: 'Suba la imagen en PNG, JPG o WEBP.' };
    }
    const ruta = `${empresa}/${productoId}/${crypto.randomUUID()}.${ext}`;
    const { error: errSubida } = await sb.storage
      .from('catalogo')
      .upload(ruta, foto, { contentType: foto.type, upsert: false });
    if (errSubida) return { ok: false, mensaje: 'No se pudo subir la imagen.' };
    imagen = sb.storage.from('catalogo').getPublicUrl(ruta).data.publicUrl;
  }

  const { error } = id
    ? await sb.from('catalogo_presentaciones').update({ ...fila, ...(imagen ? { imagen } : {}) }).eq('id', id)
    : await sb.from('catalogo_presentaciones').insert({ ...fila, imagen: imagen ?? null });
  if (error) return { ok: false, mensaje: 'No se pudo guardar la presentación.' };

  refresh();
  return { ok: true, mensaje: id ? 'Presentación actualizada.' : 'Presentación creada.' };
}

/**
 * Quita la fotografía de una presentación. Si estaba subida desde el panel se
 * borra también del almacenamiento; si venía con la web, solo se desenlaza:
 * el archivo es del repositorio y no es de aquí borrarlo.
 */
export async function quitarFoto(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const empresa = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresa, 'catalogo');
  const sb = await supabaseServidor();

  const id = String(datos.get('id') ?? '');
  if (!id) return { ok: false, mensaje: 'No se pudo quitar la fotografía.' };

  const { data: fila } = await sb
    .from('catalogo_presentaciones')
    .select('imagen')
    .eq('id', id)
    .maybeSingle();

  const { error } = await sb
    .from('catalogo_presentaciones')
    .update({ imagen: null })
    .eq('id', id);
  if (error) return { ok: false, mensaje: 'No se pudo quitar la fotografía.' };

  const objeto = fila?.imagen ? objetoDe(fila.imagen) : null;
  if (objeto) await sb.storage.from('catalogo').remove([objeto]);

  refresh();
  return { ok: true, mensaje: 'Fotografía quitada.' };
}

/* ═══════════════════════════════════════════════════════════════ orden */

/**
 * Tablas que se pueden reordenar y con qué comparten lugar: una categoría se
 * ordena dentro de su línea, un producto dentro de su categoría. Las líneas
 * se ordenan entre todas las de la empresa.
 */
const HERMANOS = {
  catalogo_lineas: 'empresa_id',
  catalogo_categorias: 'linea_id',
  catalogo_productos: 'categoria_id',
  catalogo_presentaciones: 'producto_id',
} as const;

type TablaOrdenable = keyof typeof HERMANOS;

/**
 * Sube o baja una fila un puesto. Se renumera el grupo completo para que el
 * orden quede siempre 1, 2, 3…: el sitio publica en ese orden, y una
 * numeración con huecos se vuelve difícil de seguir al cabo de varias
 * ediciones.
 */
export async function moverFila(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const empresa = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresa, 'catalogo');
  const sb = await supabaseServidor();

  const tabla = String(datos.get('tabla') ?? '') as TablaOrdenable;
  const id = String(datos.get('id') ?? '');
  const padre = String(datos.get('padre') ?? '');
  const sentido = datos.get('sentido') === 'arriba' ? -1 : 1;
  if (!(tabla in HERMANOS) || !id || !padre) return { ok: false, mensaje: 'No se pudo reordenar.' };

  const { data } = await sb
    .from(tabla)
    .select('id, orden')
    .eq(HERMANOS[tabla], padre)
    .order('orden')
    .order('id');
  const lista = data ?? [];

  const i = lista.findIndex((f) => f.id === id);
  const j = i + sentido;
  if (i < 0 || j < 0 || j >= lista.length) return null;

  [lista[i], lista[j]] = [lista[j], lista[i]];
  const fallos = await Promise.all(
    lista.map((f, k) => sb.from(tabla).update({ orden: k + 1 }).eq('id', f.id)),
  );
  if (fallos.some((r) => r.error)) return { ok: false, mensaje: 'No se pudo reordenar.' };

  refresh();
  return null;
}

/* ════════════════════════════════════════════════════════════ borrados */

/**
 * Fotografías subidas desde el panel que cuelgan de lo que se va a borrar.
 *
 * La cascada de la base se lleva las filas, pero no los archivos: sin esto el
 * almacenamiento acumularía fotos que ya no referencia nadie.
 */
async function fotosDe(
  sb: Awaited<ReturnType<typeof supabaseServidor>>,
  tabla: string,
  id: string,
  empresaId: string,
): Promise<string[]> {
  let productos: string[] = [];

  if (tabla === 'catalogo_presentaciones') {
    const { data } = await sb.from('catalogo_presentaciones').select('imagen').eq('id', id);
    return (data ?? []).map((f) => f.imagen).filter((v): v is string => Boolean(v));
  }

  if (tabla === 'catalogo_productos') {
    productos = [id];
  } else {
    /* Una línea o una categoría: hay que llegar a sus productos. */
    const categorias =
      tabla === 'catalogo_categorias'
        ? [id]
        : ((
            await sb.from('catalogo_categorias').select('id').eq('empresa_id', empresaId).eq('linea_id', id)
          ).data ?? []).map((c) => c.id);
    if (!categorias.length) return [];
    const { data } = await sb
      .from('catalogo_productos')
      .select('id')
      .eq('empresa_id', empresaId)
      .in('categoria_id', categorias);
    productos = (data ?? []).map((p) => p.id);
  }
  if (!productos.length) return [];

  const { data } = await sb.from('catalogo_presentaciones').select('imagen').in('producto_id', productos);
  return (data ?? []).map((f) => f.imagen).filter((v): v is string => Boolean(v));
}

/** Pasa de la dirección pública al nombre del objeto en el bucket. */
const MARCA_BUCKET = '/storage/v1/object/public/catalogo/';
function objetoDe(imagen: string): string | null {
  const i = imagen.indexOf(MARCA_BUCKET);
  return i >= 0 ? imagen.slice(i + MARCA_BUCKET.length) : null;
}

/**
 * Borra una fila del catálogo. Las categorías, los productos y las
 * presentaciones caen en cascada desde su padre, de modo que borrar una
 * línea se lleva todo lo que cuelga de ella: se avisa en la pantalla antes
 * de confirmar.
 *
 * Las fotografías subidas desde el panel se borran también. Las que vinieron
 * con la web no: son archivos del repositorio y no es de aquí borrarlos.
 */
export async function borrar(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const empresa = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresa, 'catalogo');
  const sb = await supabaseServidor();

  const tabla = String(datos.get('tabla') ?? '');
  const id = String(datos.get('id') ?? '');
  const PERMITIDAS = [
    'catalogo_lineas',
    'catalogo_categorias',
    'catalogo_productos',
    'catalogo_presentaciones',
  ];
  if (!PERMITIDAS.includes(tabla) || !id) return { ok: false, mensaje: 'No se pudo borrar.' };

  /* Se buscan antes de borrar: después ya no hay por dónde llegar a ellas. */
  const objetos = (await fotosDe(sb, tabla, id, empresa))
    .map(objetoDe)
    .filter((v): v is string => Boolean(v));

  const { error } = await sb.from(tabla).delete().eq('id', id);
  if (error) return { ok: false, mensaje: 'No se pudo borrar.' };

  if (objetos.length) await sb.storage.from('catalogo').remove(objetos);

  refresh();
  return { ok: true, mensaje: 'Eliminado.' };
}

/* ═════════════════════════════════════════════════════════ publicación */

/**
 * Pide que la web se vuelva a compilar con lo que hay ahora en la base.
 *
 * No se pide sola en cada guardado: una tarde de edición son decenas de
 * cambios, y cada uno encolaría una compilación. El botón lo pulsa la empresa
 * cuando termina, y queda anotado quién lo pulsó.
 */
export async function publicar(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const empresa = String(datos.get('empresa') ?? '');
  await exigirAcceso(empresa, 'catalogo');

  const r = await pedirPublicacion(empresa);

  const sb = await supabaseServidor();
  const usuario = await usuarioActual();
  await sb.from('publicaciones').insert({
    empresa_id: empresa,
    creado_por: usuario?.id ?? null,
    ok: r.ok,
    detalle: r.detalle,
  });

  refresh();
  return r.ok
    ? {
        ok: true,
        mensaje:
          'Publicación pedida. La web tarda un par de minutos en compilarse; ' +
          'recargue el sitio pasado ese tiempo.',
      }
    : { ok: false, mensaje: r.detalle };
}
