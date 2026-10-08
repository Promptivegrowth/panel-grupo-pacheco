import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { Cabecera, Insignia } from '@/componentes/ui';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { guardarCategoria, guardarProducto } from '../../acciones';
import { Borrar, Campo, Flechas, Visible, cuenta } from '../../piezas';

export const metadata = { title: 'Categoría del catálogo' };

type Producto = {
  id: string;
  slug: string;
  nombre: string;
  destacado: boolean;
  orden: number;
  visible: boolean;
};

/** Una categoría: sus datos y los productos que contiene. */
export default async function CategoriaCatalogo({
  params,
}: {
  params: Promise<{ empresa: string; id: string }>;
}) {
  const { empresa: slugEmpresa, id } = await params;
  const { empresa } = await exigirAcceso(slugEmpresa, 'catalogo');
  const sb = await supabaseServidor();

  const { data: cat } = await sb
    .from('catalogo_categorias')
    .select('id, slug, nombre, nombre_en, linea_id, orden, visible')
    .eq('empresa_id', empresa.id)
    .eq('id', id)
    .maybeSingle();
  if (!cat) notFound();

  const [{ data: dLineas }, { data: dProductos }] = await Promise.all([
    sb
      .from('catalogo_lineas')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('orden')
      .order('nombre'),
    sb
      .from('catalogo_productos')
      .select('id, slug, nombre, destacado, orden, visible')
      .eq('empresa_id', empresa.id)
      .eq('categoria_id', cat.id)
      .order('orden')
      .order('nombre'),
  ]);

  const lineas = dLineas ?? [];
  const productos = (dProductos ?? []) as Producto[];

  /* Cuántas presentaciones tiene cada producto: es lo que se vende, y sin ese
     número la lista no dice gran cosa. */
  const { data: dPres } = await sb
    .from('catalogo_presentaciones')
    .select('id, producto_id')
    .in('producto_id', productos.length ? productos.map((p) => p.id) : ['00000000-0000-0000-0000-000000000000']);
  const porProducto = new Map<string, number>();
  for (const pr of dPres ?? []) porProducto.set(pr.producto_id, (porProducto.get(pr.producto_id) ?? 0) + 1);

  const base = `/${empresa.id}/catalogo`;
  const linea = lineas.find((l) => l.id === cat.linea_id);

  return (
    <>
      <Cabecera
        titulo={cat.nombre}
        volver={{ href: base, texto: 'Catálogo' }}
        descripcion={
          <>
            {linea ? `Línea ${linea.nombre}` : 'Sin línea'} · /{cat.slug} · {cuenta(productos.length, 'producto')}
          </>
        }
        acciones={!cat.visible ? <Insignia tono="aviso">Categoría oculta</Insignia> : undefined}
      />

      <section className="caja mb-6 p-5" aria-labelledby="datos-categoria">
        <h2 id="datos-categoria" className="mb-4 text-lg font-bold text-tinta">
          Datos de la categoría
        </h2>
        <FormAccion accion={guardarCategoria}>
          <input type="hidden" name="empresa" value={empresa.id} />
          <input type="hidden" name="id" value={cat.id} />
          <input type="hidden" name="orden" value={cat.orden} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo pref={cat.id} nombre="nombre" rotulo="Nombre" valor={cat.nombre} max={160} requerido />
            {empresa.bilingue && (
              <Campo pref={cat.id} nombre="nombre_en" rotulo="Nombre (inglés)" valor={cat.nombre_en} max={160} />
            )}
            <div className="min-w-0">
              <label className="etiqueta" htmlFor={`${cat.id}-linea`}>
                Línea
              </label>
              <select id={`${cat.id}-linea`} name="linea_id" defaultValue={cat.linea_id} className="campo" required>
                {lineas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-tinta-3">Cambiarla mueve la categoría, con todos sus productos.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Visible id={`${cat.id}-visible`} marcado={cat.visible} />
            <BotonEnviar variante="secundario" className="ml-auto py-1.5">
              Guardar la categoría
            </BotonEnviar>
          </div>
        </FormAccion>
        <div className="mt-4 border-t border-linea pt-3">
          <Borrar
            empresa={empresa.id}
            tabla="catalogo_categorias"
            id={cat.id}
            texto="Eliminar la categoría"
            confirmar={`¿Eliminar «${cat.nombre}»? Se eliminan también sus ${productos.length} productos y las presentaciones de cada uno.`}
          />
        </div>
      </section>

      <section aria-labelledby="productos">
        <h2 id="productos" className="mb-3 text-lg font-bold text-tinta">
          Productos
        </h2>

        {productos.length > 0 ? (
          <ul className="space-y-2">
            {productos.map((p, i) => (
              <li
                key={p.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                  p.visible ? 'border-linea bg-white' : 'border-dashed border-linea-2 bg-fondo/60'
                }`}
              >
                <Link href={`${base}/producto/${p.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-tinta">{p.nombre}</span>
                  <span className="block text-xs text-tinta-3">
                    /{p.slug} · {cuenta(porProducto.get(p.id) ?? 0, 'presentación', 'presentaciones')}
                  </span>
                </Link>
                {p.destacado && <Insignia tono="marca">Destacado</Insignia>}
                {!p.visible && <Insignia tono="aviso">Oculto</Insignia>}
                <div className="flex items-center gap-1.5">
                  <Flechas
                    empresa={empresa.id}
                    tabla="catalogo_productos"
                    id={p.id}
                    padre={cat.id}
                    primero={i === 0}
                    ultimo={i === productos.length - 1}
                  />
                  <Link
                    href={`${base}/producto/${p.id}`}
                    className="rounded-lg border border-linea-2 bg-white px-3 py-1.5 text-sm font-semibold text-tinta hover:bg-fondo"
                  >
                    Editar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-fondo px-4 py-3 text-sm text-tinta-3">
            Esta categoría todavía no tiene productos.
          </p>
        )}

        <details className="group mt-4 rounded-xl border border-dashed border-linea-2 open:border-solid open:bg-fondo/40">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-marca [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">+ Agregar producto</span>
            <span className="hidden group-open:inline">Nuevo producto en {cat.nombre}</span>
          </summary>
          <div className="px-4 pb-4">
            <FormAccion accion={guardarProducto} limpiarAlGuardar>
              <input type="hidden" name="empresa" value={empresa.id} />
              <input type="hidden" name="categoria_id" value={cat.id} />
              <input type="hidden" name="orden" value={productos.length + 1} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo pref="nuevo-producto" nombre="nombre" rotulo="Nombre" max={200} requerido />
                {empresa.bilingue && (
                  <Campo pref="nuevo-producto" nombre="nombre_en" rotulo="Nombre (inglés)" max={200} />
                )}
                <Campo
                  pref="nuevo-producto"
                  nombre="descripcion"
                  rotulo="Descripción"
                  max={2000}
                  area
                  pista="Para qué sirve el producto. Encabeza su ficha en la web."
                />
                {empresa.bilingue && (
                  <Campo pref="nuevo-producto" nombre="descripcion_en" rotulo="Descripción (inglés)" max={2000} area />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Visible id="nuevo-producto-visible" marcado />
                <label
                  htmlFor="nuevo-producto-destacado"
                  className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-tinta-2"
                >
                  <input
                    id="nuevo-producto-destacado"
                    type="checkbox"
                    name="destacado"
                    className="size-4 accent-(--color-marca)"
                  />
                  Destacado en la portada
                </label>
                <BotonEnviar className="ml-auto py-1.5" pendiente="Agregando…">
                  Agregar
                </BotonEnviar>
              </div>
              <p className="mt-3 text-xs text-tinta-3">
                Las presentaciones —medidas, marcas y fotografías— se agregan después, en la ficha del producto.
              </p>
            </FormAccion>
          </div>
        </details>
      </section>
    </>
  );
}
