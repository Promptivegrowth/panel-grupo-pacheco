import Link from 'next/link';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { Cabecera, Insignia, Vacio, formatoFecha } from '@/componentes/ui';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { hookDe } from '@/lib/publicar';
import { guardarLinea, guardarCategoria, publicar } from './acciones';
import { Borrar, Campo, Flechas, Visible, cuenta } from './piezas';

export const metadata = { title: 'Catálogo de productos' };

type Linea = {
  id: string;
  slug: string;
  nombre: string;
  nombre_en: string | null;
  resumen: string;
  resumen_en: string | null;
  icono: string;
  orden: number;
  visible: boolean;
};

type Categoria = {
  id: string;
  slug: string;
  nombre: string;
  linea_id: string;
  orden: number;
  visible: boolean;
};

/**
 * Catálogo: las líneas y, dentro de cada una, sus categorías.
 *
 * La jerarquía tiene cuatro niveles y no cabe en una pantalla: aquí se
 * administran los dos de arriba, y cada categoría abre la suya con sus
 * productos. Es también el orden en que se trabaja: casi nunca se toca una
 * línea, a menudo se añade un producto.
 */
export default async function Catalogo({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await exigirAcceso((await params).empresa, 'catalogo');
  const sb = await supabaseServidor();

  const [{ data: dLineas }, { data: dCategorias }, { data: dProductos }] = await Promise.all([
    sb
      .from('catalogo_lineas')
      .select('id, slug, nombre, nombre_en, resumen, resumen_en, icono, orden, visible')
      .eq('empresa_id', empresa.id)
      .order('orden')
      .order('nombre'),
    sb
      .from('catalogo_categorias')
      .select('id, slug, nombre, linea_id, orden, visible')
      .eq('empresa_id', empresa.id)
      .order('orden')
      .order('nombre'),
    sb.from('catalogo_productos').select('id, categoria_id, visible').eq('empresa_id', empresa.id),
  ]);

  const lineas = (dLineas ?? []) as Linea[];
  const categorias = (dCategorias ?? []) as Categoria[];
  const productos = dProductos ?? [];

  /* La web es estática: lo editado aquí sale publicado en la siguiente
     compilación. Si la empresa tiene configurada su dirección de
     publicación, puede pedirla ella desde esta pantalla. */
  const puedePublicar = Boolean(hookDe(empresa.id));
  const { data: ultima } = puedePublicar
    ? await sb
        .from('publicaciones')
        .select('creado, ok, detalle')
        .eq('empresa_id', empresa.id)
        .order('creado', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const porCategoria = new Map<string, number>();
  for (const p of productos) porCategoria.set(p.categoria_id, (porCategoria.get(p.categoria_id) ?? 0) + 1);
  const deLinea = (lineaId: string) => categorias.filter((c) => c.linea_id === lineaId);
  const productosDeLinea = (lineaId: string) =>
    deLinea(lineaId).reduce((n, c) => n + (porCategoria.get(c.id) ?? 0), 0);

  const base = `/${empresa.id}/catalogo`;

  return (
    <>
      <Cabecera
        titulo="Catálogo de productos"
        descripcion={
          <>
            El catálogo se publica en {cuenta(lineas.length, 'línea', 'líneas')},{' '}
            {cuenta(categorias.length, 'categoría', 'categorías')} y {cuenta(productos.length, 'producto')}. Los cambios
            aparecen en la web en la siguiente publicación; lo que esté oculto se conserva pero no se muestra.
          </>
        }
      />

      {puedePublicar && (
        <section className="caja mb-6 flex flex-wrap items-center justify-between gap-4 p-5" aria-labelledby="publicar">
          <div className="min-w-0">
            <h2 id="publicar" className="font-bold text-tinta">
              Publicar en la web
            </h2>
            <p className="text-sm text-tinta-3">
              {ultima
                ? ultima.ok
                  ? `Última publicación pedida el ${formatoFecha(ultima.creado)}.`
                  : `El ${formatoFecha(ultima.creado)} no se pudo publicar: ${ultima.detalle}`
                : 'Todavía no se ha publicado desde aquí.'}{' '}
              Tarda un par de minutos; mientras tanto la web muestra el catálogo anterior.
            </p>
          </div>
          <FormAccion accion={publicar} claseAviso="basis-full">
            <input type="hidden" name="empresa" value={empresa.id} />
            <BotonEnviar
              pendiente="Pidiendo…"
              confirmar="¿Publicar el catálogo en la web? Se compila el sitio con lo que hay ahora."
            >
              Publicar los cambios
            </BotonEnviar>
          </FormAccion>
        </section>
      )}

      {lineas.length === 0 ? (
        <Vacio titulo="Todavía no hay líneas" texto="Empiece por una línea: las categorías y los productos cuelgan de ella." />
      ) : (
        <div className="space-y-5">
          {lineas.map((l, i) => (
            <section
              key={l.id}
              className={`caja p-5 ${l.visible ? '' : 'border-dashed bg-fondo/60'}`}
              aria-labelledby={`linea-${l.id}`}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={`linea-${l.id}`} className="flex flex-wrap items-center gap-2 text-lg font-bold text-tinta">
                    <span className="tabular-nums text-tinta-3">{String(i + 1).padStart(2, '0')}</span>
                    {l.nombre}
                    {!l.visible && <Insignia tono="aviso">Oculta</Insignia>}
                  </h2>
                  <p className="text-sm text-tinta-3">
                    /{l.slug} · {cuenta(deLinea(l.id).length, 'categoría', 'categorías')} ·{' '}
                    {cuenta(productosDeLinea(l.id), 'producto')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Flechas
                    empresa={empresa.id}
                    tabla="catalogo_lineas"
                    id={l.id}
                    padre={empresa.id}
                    primero={i === 0}
                    ultimo={i === lineas.length - 1}
                  />
                </div>
              </div>

              {/* Las categorías de la línea: cada una abre su propia pantalla. */}
              {deLinea(l.id).length > 0 ? (
                <ul className="mb-4 grid gap-2 sm:grid-cols-2">
                  {deLinea(l.id).map((c) => (
                    /* `min-w-0`: sin eso el nombre largo de una categoría
                       ensancha la columna de la rejilla y la pantalla
                       desborda a lo ancho en el móvil. */
                    <li key={c.id} className="min-w-0">
                      <Link
                        href={`${base}/categoria/${c.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-linea bg-white px-3.5 py-2.5 text-sm hover:border-tinta-3 hover:bg-fondo"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-tinta">{c.nombre}</span>
                          <span className="block text-xs text-tinta-3">
                            {cuenta(porCategoria.get(c.id) ?? 0, 'producto')}
                          </span>
                        </span>
                        {!c.visible && <Insignia tono="aviso">Oculta</Insignia>}
                        <span aria-hidden className="text-tinta-3">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-4 rounded-lg bg-fondo px-4 py-3 text-sm text-tinta-3">
                  Esta línea todavía no tiene categorías.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <details className="group min-w-0 flex-1 rounded-xl border border-dashed border-linea-2 open:border-solid open:bg-fondo/40">
                  <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold text-marca [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Editar la línea</span>
                    <span className="hidden group-open:inline">Línea · {l.nombre}</span>
                  </summary>
                  <div className="px-4 pb-4">
                    <FormAccion accion={guardarLinea}>
                      <input type="hidden" name="empresa" value={empresa.id} />
                      <input type="hidden" name="id" value={l.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Campo pref={l.id} nombre="nombre" rotulo="Nombre" valor={l.nombre} max={120} requerido />
                        {empresa.bilingue && (
                          <Campo pref={l.id} nombre="nombre_en" rotulo="Nombre (inglés)" valor={l.nombre_en} max={120} />
                        )}
                        <Campo
                          pref={l.id}
                          nombre="resumen"
                          rotulo="Resumen"
                          valor={l.resumen}
                          max={400}
                          area
                          filas={3}
                          pista="Para qué sirve la línea. Se muestra en el índice del catálogo."
                        />
                        {empresa.bilingue && (
                          <Campo pref={l.id} nombre="resumen_en" rotulo="Resumen (inglés)" valor={l.resumen_en} max={400} area filas={3} />
                        )}
                        <Campo
                          pref={l.id}
                          nombre="icono"
                          rotulo="Icono"
                          valor={l.icono}
                          max={40}
                          pista="Nombre del icono en la web. Déjelo como está si no sabe cuál es."
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Visible id={`${l.id}-visible`} marcado={l.visible} />
                        <BotonEnviar variante="secundario" className="ml-auto py-1.5">
                          Guardar la línea
                        </BotonEnviar>
                      </div>
                    </FormAccion>
                    <div className="mt-4 border-t border-linea pt-3">
                      <Borrar
                        empresa={empresa.id}
                        tabla="catalogo_lineas"
                        id={l.id}
                        texto="Eliminar la línea"
                        confirmar={`¿Eliminar «${l.nombre}»? Se eliminan también sus ${deLinea(l.id).length} categorías y ${productosDeLinea(l.id)} productos.`}
                      />
                    </div>
                  </div>
                </details>

                <details className="group min-w-0 flex-1 rounded-xl border border-dashed border-linea-2 open:border-solid open:bg-fondo/40">
                  <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold text-marca [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">+ Agregar categoría</span>
                    <span className="hidden group-open:inline">Nueva categoría en {l.nombre}</span>
                  </summary>
                  <div className="px-4 pb-4">
                    <FormAccion accion={guardarCategoria} limpiarAlGuardar>
                      <input type="hidden" name="empresa" value={empresa.id} />
                      <input type="hidden" name="linea_id" value={l.id} />
                      <input type="hidden" name="orden" value={deLinea(l.id).length + 1} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Campo pref={`nueva-${l.id}`} nombre="nombre" rotulo="Nombre" max={160} requerido />
                        {empresa.bilingue && (
                          <Campo pref={`nueva-${l.id}`} nombre="nombre_en" rotulo="Nombre (inglés)" max={160} />
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Visible id={`nueva-${l.id}-visible`} marcado />
                        <BotonEnviar className="ml-auto py-1.5" pendiente="Agregando…">
                          Agregar
                        </BotonEnviar>
                      </div>
                    </FormAccion>
                  </div>
                </details>
              </div>
            </section>
          ))}
        </div>
      )}

      <details className="group mt-5 rounded-xl border border-dashed border-linea-2 open:border-solid open:bg-fondo/40">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-marca [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">+ Agregar línea</span>
          <span className="hidden group-open:inline">Nueva línea</span>
        </summary>
        <div className="px-4 pb-4">
          <FormAccion accion={guardarLinea} limpiarAlGuardar>
            <input type="hidden" name="empresa" value={empresa.id} />
            <input type="hidden" name="orden" value={lineas.length + 1} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo pref="nueva-linea" nombre="nombre" rotulo="Nombre" max={120} requerido />
              {empresa.bilingue && <Campo pref="nueva-linea" nombre="nombre_en" rotulo="Nombre (inglés)" max={120} />}
              <Campo pref="nueva-linea" nombre="resumen" rotulo="Resumen" max={400} area filas={3} />
              {empresa.bilingue && (
                <Campo pref="nueva-linea" nombre="resumen_en" rotulo="Resumen (inglés)" max={400} area filas={3} />
              )}
              <Campo pref="nueva-linea" nombre="icono" rotulo="Icono" max={40} pista="Nombre del icono en la web." />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Visible id="nueva-linea-visible" marcado />
              <BotonEnviar className="ml-auto py-1.5" pendiente="Agregando…">
                Agregar línea
              </BotonEnviar>
            </div>
          </FormAccion>
        </div>
      </details>
    </>
  );
}
