import Link from 'next/link';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { fechaLima, aISO } from '@/lib/reclamos/plazos';
import { Aviso, Cabecera, EnlaceBoton, Insignia, Vacio, formatoFecha } from '@/componentes/ui';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { alternarPublicacion, eliminarEmpleo, eliminarPostulacionesDeEmpleo } from './acciones';

export const metadata = { title: 'Trabaja con nosotros' };

export default async function Empleos({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ creada?: string; eliminada?: string }>;
}) {
  const { empresa, modulos } = await exigirAcceso((await params).empresa, 'empleos');
  const { creada, eliminada } = await searchParams;
  const verPostulaciones = modulos.includes('postulaciones');
  const sb = await supabaseServidor();
  const [{ data: empleos }, { data: postulaciones }] = await Promise.all([
    sb
      .from('empleos')
      .select('id, titulo, area, ubicacion, modalidad, jornada, publicado, fecha_publicacion, fecha_cierre, actualizado')
      .eq('empresa_id', empresa.id)
      .order('publicado', { ascending: false })
      .order('fecha_publicacion', { ascending: false }),
    sb.from('postulaciones').select('empleo_id, estado').eq('empresa_id', empresa.id).not('empleo_id', 'is', null),
  ]);
  // Postulaciones por vacante: total y nuevas.
  const conteo = new Map<string, { total: number; nuevas: number }>();
  for (const p of postulaciones ?? []) {
    const c = conteo.get(p.empleo_id!) ?? { total: 0, nuevas: 0 };
    c.total += 1;
    if (p.estado === 'nueva') c.nuevas += 1;
    conteo.set(p.empleo_id!, c);
  }

  const hoy = aISO(fechaLima());
  const base = `/${empresa.id}/empleos`;

  return (
    <>
      <Cabecera
        titulo="Trabaja con nosotros"
        descripcion="Vacantes que se publican en la sección «Trabaja con nosotros» de la web. Al pasar la fecha de cierre dejan de mostrarse solas."
        acciones={<EnlaceBoton href={`${base}/nuevo`}>+ Nueva vacante</EnlaceBoton>}
      />

      {(creada || eliminada) && (
        <div className="mb-4">
          <Aviso tono="ok">{creada ? 'Vacante creada.' : 'Vacante eliminada.'}</Aviso>
        </div>
      )}

      {!empleos?.length ? (
        <Vacio
          titulo="No hay vacantes"
          texto="Cree la primera vacante para que aparezca en la web."
          accion={<EnlaceBoton href={`${base}/nuevo`}>Crear vacante</EnlaceBoton>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {empleos.map((e) => {
            const cerrada = e.fecha_cierre && e.fecha_cierre < hoy;
            const total = conteo.get(e.id)?.total ?? 0;
            const nuevas = conteo.get(e.id)?.nuevas ?? 0;
            const oculto = (
              <>
                <input type="hidden" name="empresa" value={empresa.id} />
                <input type="hidden" name="id" value={e.id} />
              </>
            );
            return (
              <li key={e.id} className="caja flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {!e.publicado ? (
                    <Insignia>Borrador</Insignia>
                  ) : cerrada ? (
                    <Insignia tono="aviso">Cerrada</Insignia>
                  ) : (
                    <Insignia tono="ok">Publicada</Insignia>
                  )}
                  {e.area && <Insignia tono="marca">{e.area}</Insignia>}
                </div>
                <h2 className="mt-3 text-lg font-bold leading-snug text-tinta">{e.titulo}</h2>
                <p className="mt-1 text-sm text-tinta-3">
                  {[e.ubicacion, e.modalidad, e.jornada].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-3 text-xs text-tinta-3">
                  Publicada el {formatoFecha(e.fecha_publicacion)}
                  {e.fecha_cierre && ` · cierra el ${formatoFecha(e.fecha_cierre)}`}
                </p>
                {/* Postulaciones de la vacante: ver y, para liberar espacio, borrarlas todas. */}
                {verPostulaciones && (
                  <FormAccion accion={eliminarPostulacionesDeEmpleo} className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" claseAviso="mt-1 basis-full">
                    {oculto}
                    <Link
                      href={`/${empresa.id}/postulaciones?filtro=todas&puesto=${encodeURIComponent(e.titulo)}`}
                      className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-marca hover:underline"
                    >
                      {total === 1 ? '1 postulación' : `${total} postulaciones`}
                      {!!nuevas && <Insignia tono="marca">{nuevas === 1 ? '1 nueva' : `${nuevas} nuevas`}</Insignia>}
                    </Link>
                    {total > 0 && (
                      <BotonEnviar
                        variante="peligro"
                        className="px-2.5 py-1 text-xs"
                        pendiente="Eliminando…"
                        confirmar={`¿Eliminar ${total === 1 ? 'la postulación' : `las ${total} postulaciones`} de «${e.titulo}» y sus CV? No se puede deshacer.`}
                      >
                        Eliminar postulaciones
                      </BotonEnviar>
                    )}
                  </FormAccion>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-linea pt-4">
                  <EnlaceBoton href={`${base}/${e.id}`} variante="secundario" className="py-1.5">
                    Editar
                  </EnlaceBoton>
                  <FormAccion accion={alternarPublicacion}>
                    {oculto}
                    <input type="hidden" name="publicar" value={e.publicado ? '0' : '1'} />
                    <BotonEnviar variante="fantasma" className="py-1.5" pendiente="…">
                      {e.publicado ? 'Ocultar de la web' : 'Publicar'}
                    </BotonEnviar>
                  </FormAccion>
                  {/* «contents»: el botón queda en la fila y el aviso baja a todo el ancho.
                      La clave cambia con el total: el aviso de «tiene N postulaciones» se
                      va en cuanto se borran. */}
                  <FormAccion key={`eliminar-${total}`} accion={eliminarEmpleo} className="contents" claseAviso="basis-full">
                    {oculto}
                    <BotonEnviar
                      variante="peligro"
                      className="ml-auto py-1.5"
                      pendiente="Eliminando…"
                      confirmar={total ? undefined : `¿Eliminar la vacante «${e.titulo}»? No se puede deshacer.`}
                    >
                      Eliminar
                    </BotonEnviar>
                  </FormAccion>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-tinta-3">
        Vista pública:{' '}
        <Link href="https://www.laboratoriospacheco.com/trabaja-con-nosotros" target="_blank" className="font-semibold text-marca hover:underline">
          laboratoriospacheco.com/trabaja-con-nosotros ↗
        </Link>
      </p>
    </>
  );
}
