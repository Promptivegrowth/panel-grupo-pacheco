import { notFound } from 'next/navigation';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { Cabecera, Insignia } from '@/componentes/ui';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { guardarProducto, guardarPresentacion, quitarFoto } from '../../acciones';
import { Borrar, Campo, Flechas, Visible, cuenta } from '../../piezas';

export const metadata = { title: 'Producto del catálogo' };

type Presentacion = {
  id: string;
  medida: string;
  medida_en: string | null;
  marca: string;
  marca_slug: string | null;
  unidad: string;
  unidad_en: string | null;
  caracteristicas: string[];
  caracteristicas_en: string[];
  descripcion: string | null;
  descripcion_en: string | null;
  registro_sanitario: string | null;
  normativa: string | null;
  imagen: string | null;
  orden: number;
  visible: boolean;
};

/**
 * Dirección de la fotografía.
 *
 * Una dirección completa es una foto subida desde el panel; cualquier otra
 * cosa es una ruta relativa a /img/ de la web, que es como llegaron las que
 * ya venían en el repositorio.
 */
function urlFoto(imagen: string, sitio: string): string {
  if (/^https?:\/\//.test(imagen)) return imagen;
  return `${sitio.replace(/\/$/, '')}/img/${imagen.replace(/^\//, '')}`;
}

/** Campos de una presentación, compartidos por la edición y el alta. */
function CamposPresentacion({
  pref,
  pr,
  bilingue,
}: {
  pref: string;
  pr?: Presentacion;
  bilingue: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo
          pref={pref}
          nombre="medida"
          rotulo="Medida o modelo"
          valor={pr?.medida}
          max={80}
          pista="«0.95 L», «TALLA M», «HP-60»."
        />
        {bilingue && (
          <Campo
            pref={pref}
            nombre="medida_en"
            rotulo="Medida (inglés)"
            valor={pr?.medida_en}
            max={80}
            pista="Solo si lleva palabras. «0.95 L» no se traduce."
          />
        )}
        <Campo pref={pref} nombre="marca" rotulo="Marca" valor={pr?.marca} max={80} />
        <Campo
          pref={pref}
          nombre="marca_slug"
          rotulo="Ficha de la marca"
          valor={pr?.marca_slug}
          max={60}
          pista="Solo si la marca tiene página propia en la web."
        />
        <Campo
          pref={pref}
          nombre="unidad"
          rotulo="Cómo se vende"
          valor={pr?.unidad}
          max={60}
          pista="«unidades», «caja x 100 und»."
        />
        {bilingue && (
          <Campo pref={pref} nombre="unidad_en" rotulo="Cómo se vende (inglés)" valor={pr?.unidad_en} max={60} />
        )}
        <Campo
          pref={pref}
          nombre="registro_sanitario"
          rotulo="Registro sanitario"
          valor={pr?.registro_sanitario}
          max={120}
          pista="Se muestra solo si está."
        />
        <Campo pref={pref} nombre="normativa" rotulo="Normativa" valor={pr?.normativa} max={200} />
      </div>

      <div className={`mt-3 grid gap-3 ${bilingue ? 'lg:grid-cols-2' : ''}`}>
        <Campo
          pref={pref}
          nombre="caracteristicas"
          rotulo="Características"
          valor={pr?.caracteristicas.join('\n')}
          max={4000}
          area
          filas={8}
          pista="Una por línea. Lo que esté antes del primer «:» se muestra como el nombre del dato."
        />
        {bilingue && (
          <Campo
            pref={pref}
            nombre="caracteristicas_en"
            rotulo="Características (inglés)"
            valor={pr?.caracteristicas_en.join('\n')}
            max={4000}
            area
            filas={8}
            pista="El mismo número de líneas y en el mismo orden, o déjelo vacío."
          />
        )}
        <Campo
          pref={pref}
          nombre="descripcion"
          rotulo="Descripción propia"
          valor={pr?.descripcion}
          max={2000}
          area
          filas={3}
          pista="Solo si esta presentación se describe distinto del producto."
        />
        {bilingue && (
          <Campo
            pref={pref}
            nombre="descripcion_en"
            rotulo="Descripción propia (inglés)"
            valor={pr?.descripcion_en}
            max={2000}
            area
            filas={3}
          />
        )}
      </div>
    </>
  );
}

/** Un producto: sus datos y sus presentaciones, que son lo que se vende. */
export default async function ProductoCatalogo({
  params,
}: {
  params: Promise<{ empresa: string; id: string }>;
}) {
  const { empresa: slugEmpresa, id } = await params;
  const { empresa } = await exigirAcceso(slugEmpresa, 'catalogo');
  const sb = await supabaseServidor();

  const { data: p } = await sb
    .from('catalogo_productos')
    .select('id, slug, nombre, nombre_en, descripcion, descripcion_en, categoria_id, destacado, orden, visible')
    .eq('empresa_id', empresa.id)
    .eq('id', id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: dCategorias }, { data: dPres }, { data: dEmpresa }] = await Promise.all([
    sb
      .from('catalogo_categorias')
      .select('id, nombre, linea_id')
      .eq('empresa_id', empresa.id)
      .order('orden')
      .order('nombre'),
    sb
      .from('catalogo_presentaciones')
      // Todo en una sola cadena: el cliente lee la lista de columnas del
      // literal para tipar la respuesta, y partida en trozos no la reconoce.
      .select('id, medida, medida_en, marca, marca_slug, unidad, unidad_en, caracteristicas, caracteristicas_en, descripcion, descripcion_en, registro_sanitario, normativa, imagen, orden, visible')
      .eq('producto_id', p.id)
      .order('orden')
      .order('medida'),
    sb.from('empresas').select('sitio_url').eq('id', empresa.id).maybeSingle(),
  ]);

  const categorias = dCategorias ?? [];
  const presentaciones = (dPres ?? []) as Presentacion[];
  const sitio = dEmpresa?.sitio_url ?? '';

  const base = `/${empresa.id}/catalogo`;
  const cat = categorias.find((c) => c.id === p.categoria_id);
  const sinFoto = presentaciones.filter((pr) => !pr.imagen).length;

  return (
    <>
      <Cabecera
        titulo={p.nombre}
        volver={{ href: cat ? `${base}/categoria/${cat.id}` : base, texto: cat ? cat.nombre : 'Catálogo' }}
        descripcion={
          <>
            /{p.slug} · {cuenta(presentaciones.length, 'presentación', 'presentaciones')}
            {sinFoto > 0 && ` · ${sinFoto} sin fotografía`}
          </>
        }
        acciones={
          <>
            {p.destacado && <Insignia tono="marca">Destacado</Insignia>}
            {!p.visible && <Insignia tono="aviso">Oculto</Insignia>}
          </>
        }
      />

      <section className="caja mb-6 p-5" aria-labelledby="datos-producto">
        <h2 id="datos-producto" className="mb-4 text-lg font-bold text-tinta">
          Datos del producto
        </h2>
        <FormAccion accion={guardarProducto}>
          <input type="hidden" name="empresa" value={empresa.id} />
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="orden" value={p.orden} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo pref={p.id} nombre="nombre" rotulo="Nombre" valor={p.nombre} max={200} requerido />
            {empresa.bilingue && (
              <Campo pref={p.id} nombre="nombre_en" rotulo="Nombre (inglés)" valor={p.nombre_en} max={200} />
            )}
            <Campo
              pref={p.id}
              nombre="descripcion"
              rotulo="Descripción"
              valor={p.descripcion}
              max={2000}
              area
              pista="Encabeza la ficha en la web."
            />
            {empresa.bilingue && (
              <Campo pref={p.id} nombre="descripcion_en" rotulo="Descripción (inglés)" valor={p.descripcion_en} max={2000} area />
            )}
            <div className="min-w-0">
              <label className="etiqueta" htmlFor={`${p.id}-categoria`}>
                Categoría
              </label>
              <select id={`${p.id}-categoria`} name="categoria_id" defaultValue={p.categoria_id} className="campo" required>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Visible id={`${p.id}-visible`} marcado={p.visible} />
            <label
              htmlFor={`${p.id}-destacado`}
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-tinta-2"
            >
              <input
                id={`${p.id}-destacado`}
                type="checkbox"
                name="destacado"
                defaultChecked={p.destacado}
                className="size-4 accent-(--color-marca)"
              />
              Destacado en la portada
            </label>
            <BotonEnviar variante="secundario" className="ml-auto py-1.5">
              Guardar el producto
            </BotonEnviar>
          </div>
        </FormAccion>
        <div className="mt-4 border-t border-linea pt-3">
          <Borrar
            empresa={empresa.id}
            tabla="catalogo_productos"
            id={p.id}
            texto="Eliminar el producto"
            confirmar={`¿Eliminar «${p.nombre}»? Se eliminan también sus ${presentaciones.length} presentaciones.`}
          />
        </div>
      </section>

      <section aria-labelledby="presentaciones">
        <h2 id="presentaciones" className="mb-1 text-lg font-bold text-tinta">
          Presentaciones
        </h2>
        <p className="mb-3 max-w-2xl text-sm text-tinta-3">
          Cada presentación es lo que se cotiza por separado: una capacidad, una talla, un modelo. Tiene su propia
          fotografía y su propio cuadro de características.
        </p>

        {presentaciones.length > 0 ? (
          <ul className="space-y-3">
            {presentaciones.map((pr, i) => (
              <li
                key={pr.id}
                className={`rounded-xl border p-4 ${
                  pr.visible ? 'border-linea bg-white' : 'border-dashed border-linea-2 bg-fondo/60'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex flex-wrap items-center gap-2 font-bold text-tinta">
                    <span className="tabular-nums text-tinta-3">{String(i + 1).padStart(2, '0')}</span>
                    {pr.medida || pr.marca || 'Sin medida'}
                    {!pr.visible && <Insignia tono="aviso">Oculta</Insignia>}
                    {!pr.imagen && <Insignia tono="aviso">Sin fotografía</Insignia>}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Flechas
                      empresa={empresa.id}
                      tabla="catalogo_presentaciones"
                      id={pr.id}
                      padre={p.id}
                      primero={i === 0}
                      ultimo={i === presentaciones.length - 1}
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                  {/* La fotografía: se sube y se quita por separado del resto,
                      porque son dos gestos distintos y uno no debería
                      arrastrar al otro. */}
                  <div>
                    <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border border-linea bg-fondo">
                      {pr.imagen ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={urlFoto(pr.imagen, sitio)}
                          alt=""
                          className="size-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="px-3 text-center text-xs text-tinta-3">Sin fotografía</span>
                      )}
                    </div>
                    {pr.imagen && (
                      <div className="mt-2">
                        <FormAccion accion={quitarFoto} claseAviso="mt-2">
                          <input type="hidden" name="empresa" value={empresa.id} />
                          <input type="hidden" name="id" value={pr.id} />
                          <BotonEnviar
                            variante="fantasma"
                            className="w-full py-1 text-xs"
                            pendiente="Quitando…"
                            confirmar="¿Quitar la fotografía de esta presentación?"
                          >
                            Quitar la fotografía
                          </BotonEnviar>
                        </FormAccion>
                      </div>
                    )}
                  </div>

                  <FormAccion accion={guardarPresentacion}>
                    <input type="hidden" name="empresa" value={empresa.id} />
                    <input type="hidden" name="producto_id" value={p.id} />
                    <input type="hidden" name="id" value={pr.id} />
                    <input type="hidden" name="orden" value={pr.orden} />
                    <CamposPresentacion pref={pr.id} pr={pr} bilingue={empresa.bilingue} />
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div>
                        <label className="etiqueta" htmlFor={`${pr.id}-foto`}>
                          Cambiar la fotografía
                        </label>
                        <input
                          id={`${pr.id}-foto`}
                          type="file"
                          name="foto"
                          accept="image/png,image/jpeg,image/webp"
                          className="campo file:mr-3 file:rounded-md file:border-0 file:bg-fondo file:px-3 file:py-1 file:text-sm file:font-semibold file:text-tinta-2"
                        />
                        <p className="mt-1 text-xs text-tinta-3">PNG, JPG o WEBP, hasta 10 MB. Fondo blanco.</p>
                      </div>
                      <Visible id={`${pr.id}-visible`} marcado={pr.visible} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-linea pt-3">
                      <Borrar
                        empresa={empresa.id}
                        tabla="catalogo_presentaciones"
                        id={pr.id}
                        texto="Eliminar la presentación"
                        confirmar={`¿Eliminar la presentación «${pr.medida || pr.marca}»?`}
                      />
                      <BotonEnviar variante="secundario" className="ml-auto py-1.5">
                        Guardar la presentación
                      </BotonEnviar>
                    </div>
                  </FormAccion>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-fondo px-4 py-3 text-sm text-tinta-3">
            Este producto todavía no tiene presentaciones. Sin ellas no aparece nada que cotizar en su ficha.
          </p>
        )}

        <details className="group mt-4 rounded-xl border border-dashed border-linea-2 open:border-solid open:bg-fondo/40">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-marca [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">+ Agregar presentación</span>
            <span className="hidden group-open:inline">Nueva presentación de {p.nombre}</span>
          </summary>
          <div className="px-4 pb-4">
            <FormAccion accion={guardarPresentacion} limpiarAlGuardar>
              <input type="hidden" name="empresa" value={empresa.id} />
              <input type="hidden" name="producto_id" value={p.id} />
              <input type="hidden" name="orden" value={presentaciones.length + 1} />
              <CamposPresentacion pref="nueva-pres" bilingue={empresa.bilingue} />
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <label className="etiqueta" htmlFor="nueva-pres-foto">
                    Fotografía
                  </label>
                  <input
                    id="nueva-pres-foto"
                    type="file"
                    name="foto"
                    accept="image/png,image/jpeg,image/webp"
                    className="campo file:mr-3 file:rounded-md file:border-0 file:bg-fondo file:px-3 file:py-1 file:text-sm file:font-semibold file:text-tinta-2"
                  />
                  <p className="mt-1 text-xs text-tinta-3">PNG, JPG o WEBP, hasta 10 MB. Fondo blanco.</p>
                </div>
                <Visible id="nueva-pres-visible" marcado />
              </div>
              <div className="mt-3 flex justify-end">
                <BotonEnviar className="py-1.5" pendiente="Agregando…">
                  Agregar presentación
                </BotonEnviar>
              </div>
            </FormAccion>
          </div>
        </details>
      </section>
    </>
  );
}
