import { notFound } from 'next/navigation';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ESTADOS, NOMBRE_ESTADO, TONO_ESTADO, type EstadoPostulacion } from '@/lib/postulaciones';
import { Aviso, Cabecera, Dato, Insignia, formatoFecha } from '@/componentes/ui';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { cambiarEstado, eliminarPostulacion, guardarNotas } from '../acciones';

export const metadata = { title: 'Postulación' };

export default async function DetallePostulacion({ params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa: empresaId, id } = await params;
  const { empresa } = await exigirAcceso(empresaId, 'postulaciones');
  const sb = await supabaseServidor();

  const { data: p } = await sb.from('postulaciones').select('*').eq('id', id).eq('empresa_id', empresa.id).maybeSingle();
  if (!p) notFound();

  // Abrirla la da por revisada.
  if (p.estado === 'nueva') {
    await sb.from('postulaciones').update({ estado: 'revisada' }).eq('id', p.id);
    p.estado = 'revisada';
  }

  // Enlaces firmados de corta duración (la política del bucket exige rol en la empresa).
  const esPdf = p.cv_path?.endsWith('.pdf');
  const [ver, descargar] = p.cv_path
    ? await Promise.all([
        esPdf ? sb.storage.from('postulaciones').createSignedUrl(p.cv_path, 600) : null,
        sb.storage.from('postulaciones').createSignedUrl(p.cv_path, 600, { download: p.cv_nombre ?? true }),
      ])
    : [null, null];

  const estado = p.estado as EstadoPostulacion;
  const oculto = (
    <>
      <input type="hidden" name="empresa" value={empresa.id} />
      <input type="hidden" name="id" value={p.id} />
    </>
  );
  const asunto = encodeURIComponent(`Su postulación a ${p.puesto} · ${empresa.nombre}`);

  return (
    <>
      <Cabecera
        volver={{ href: `/${empresa.id}/postulaciones`, texto: 'Postulaciones' }}
        titulo={p.nombre}
        descripcion={
          <span className="inline-flex flex-wrap items-center gap-2">
            {p.puesto} · recibida el {formatoFecha(p.creado)}
            <Insignia tono={TONO_ESTADO[estado]}>{NOMBRE_ESTADO[estado]}</Insignia>
          </span>
        }
        acciones={
          <>
            {ver?.data?.signedUrl && (
              <a
                href={ver.data.signedUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-lg border border-linea-2 bg-white px-3.5 py-2 text-sm font-semibold text-tinta hover:bg-fondo"
              >
                Ver CV ↗
              </a>
            )}
            {descargar?.data?.signedUrl && (
              <a href={descargar.data.signedUrl} className="inline-flex items-center gap-2 rounded-lg bg-marca px-3.5 py-2 text-sm font-semibold text-white hover:brightness-110">
                Descargar CV
              </a>
            )}
          </>
        }
      />

      {p.correo_error && (
        <div className="mb-5">
          <Aviso tono="aviso">Correos pendientes: {p.correo_error}</Aviso>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="caja p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-tinta-2">Datos personales</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Dato etiqueta="Documento">{`${p.tipo_documento} ${p.numero_documento}`}</Dato>
              <Dato etiqueta="Reside en">{p.distrito && `${p.distrito}, ${p.provincia}, ${p.departamento}`}</Dato>
              <Dato etiqueta="Correo">
                <a className="text-marca hover:underline" href={`mailto:${p.correo}?subject=${asunto}`}>
                  {p.correo}
                </a>
              </Dato>
              <Dato etiqueta="Celular">
                <a className="text-marca hover:underline" href={`tel:${p.telefono.replace(/[^\d+]/g, '')}`}>
                  {p.telefono}
                </a>
              </Dato>
            </dl>
          </section>

          <section className="caja p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-tinta-2">Perfil</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Dato etiqueta="Puesto">{p.puesto}</Dato>
              {p.area_interes && <Dato etiqueta="Área de interés">{p.area_interes}</Dato>}
              <Dato etiqueta="Estudios">{p.estudios}</Dato>
              <Dato etiqueta="Carrera o especialidad">{p.carrera}</Dato>
              <Dato etiqueta="Experiencia">{p.experiencia}</Dato>
              <Dato etiqueta="Experiencia en BPM / BPA">{p.experiencia_bpm ? 'Sí' : 'No'}</Dato>
              <Dato etiqueta="Disponibilidad">{p.disponibilidad}</Dato>
              <Dato etiqueta="Pretensión salarial">
                {p.pretension != null && `S/ ${Number(p.pretension).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
              </Dato>
              <Dato etiqueta="LinkedIn">
                {p.linkedin && (
                  <a className="break-all text-marca hover:underline" href={p.linkedin} target="_blank" rel="noopener noreferrer">
                    {p.linkedin}
                  </a>
                )}
              </Dato>
            </dl>
            {p.presentacion && (
              <div className="mt-5 border-t border-linea pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-tinta-3">Presentación</p>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-tinta">{p.presentacion}</p>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="caja p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-tinta-2">Estado</h2>
            {/* Un solo formulario: el aviso sigue a la vista aunque cambien los botones. */}
            <FormAccion accion={cambiarEstado}>
              {oculto}
              <div className="flex flex-wrap gap-2">
                {ESTADOS.filter((e) => e !== 'nueva' && e !== estado).map((e) => (
                  <BotonEnviar key={e} name="estado" value={e} variante={e === 'preseleccionada' ? 'primario' : 'secundario'} pendiente="…">
                    {e === 'revisada' ? 'Volver a revisar' : e === 'preseleccionada' ? 'Preseleccionar' : 'Descartar'}
                  </BotonEnviar>
                ))}
              </div>
            </FormAccion>
          </section>

          <section className="caja p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-tinta-2">Notas internas</h2>
            <FormAccion accion={guardarNotas}>
              {oculto}
              <textarea
                name="notas"
                defaultValue={p.notas ?? ''}
                rows={5}
                maxLength={4000}
                placeholder="Solo las ve el equipo en el portal."
                className="campo w-full"
                aria-label="Notas internas"
              />
              <div className="mt-2">
                <BotonEnviar variante="secundario">Guardar notas</BotonEnviar>
              </div>
            </FormAccion>
          </section>

          <section className="caja p-5">
            <FormAccion accion={eliminarPostulacion}>
              {oculto}
              <BotonEnviar variante="peligro" pendiente="Eliminando…" confirmar="¿Eliminar esta postulación y su CV definitivamente?">
                Eliminar postulación
              </BotonEnviar>
            </FormAccion>
            <p className="mt-2 text-xs text-tinta-3">Borra también el CV. Úselo para pruebas o si el postulante lo pide.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
