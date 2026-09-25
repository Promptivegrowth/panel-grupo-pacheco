import { notFound } from 'next/navigation';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { Reclamo } from '@/lib/reclamos/servicio';
import { Cabecera, Dato, Insignia, formatoFecha, Aviso } from '@/componentes/ui';
import { PlazoInsignia } from '@/componentes/plazo';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { marcarEnProceso, reenviarAvisos, reenviarRespuesta, responder } from '../acciones';

export async function generateMetadata() {
  return { title: 'Reclamo' };
}

function Seccion({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="caja p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-tinta-2">
        <span className="grid size-6 place-items-center rounded-full bg-marca text-xs text-white">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Texto({ etiqueta, children }: { etiqueta: string; children: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-tinta-3">{etiqueta}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-fondo px-3.5 py-3 text-[15px] leading-relaxed text-tinta">{children}</p>
    </div>
  );
}

export default async function DetalleReclamo({ params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa: empresaId, id } = await params;
  const { empresa } = await exigirAcceso(empresaId, 'reclamos');
  const sb = await supabaseServidor();

  const { data } = await sb.from('reclamos').select('*').eq('id', id).eq('empresa_id', empresa.id).maybeSingle();
  if (!data) notFound();
  const r = data as Reclamo;

  // Enlace firmado de corta duración; la política del bucket exige rol maestro.
  const firmado = r.pdf_path ? await sb.storage.from('reclamos').createSignedUrl(r.pdf_path, 600) : null;
  const descarga = r.pdf_path
    ? await sb.storage.from('reclamos').createSignedUrl(r.pdf_path, 600, { download: `Hoja-de-reclamacion-${r.codigo}.pdf` })
    : null;
  const urlPdf = firmado?.data?.signedUrl;

  const oculto = (
    <>
      <input type="hidden" name="empresa" value={empresa.id} />
      <input type="hidden" name="id" value={r.id} />
    </>
  );

  return (
    <>
      <Cabecera
        volver={{ href: `/${empresa.id}/reclamos`, texto: 'Libro de reclamaciones' }}
        titulo={`Hoja N.º ${r.codigo}`}
        descripcion={
          <>
            {r.tipo === 'reclamo' ? 'Reclamo registrado' : 'Queja registrada'} el {formatoFecha(r.creado)}
          </>
        }
        acciones={
          descarga?.data?.signedUrl ? (
            <a href={descarga.data.signedUrl} className="inline-flex items-center gap-2 rounded-lg border border-linea-2 bg-white px-3.5 py-2 text-sm font-semibold text-tinta hover:bg-fondo">
              Descargar PDF
            </a>
          ) : null
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Seccion numero={1} titulo="Consumidor reclamante">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Dato etiqueta="Nombre">{r.nombre}</Dato>
              <Dato etiqueta="Documento">{`${r.tipo_documento} ${r.numero_documento}`}</Dato>
              <Dato etiqueta="Correo">
                <a className="text-marca hover:underline" href={`mailto:${r.correo}`}>
                  {r.correo}
                </a>
              </Dato>
              <Dato etiqueta="Teléfono">{r.telefono}</Dato>
              <Dato etiqueta="Domicilio">{r.domicilio}</Dato>
              <Dato etiqueta="Menor de edad">{r.menor_edad ? `Sí · ${r.apoderado ?? ''}` : 'No'}</Dato>
            </dl>
          </Seccion>

          <Seccion numero={2} titulo="Bien contratado">
            <dl className="mb-4 grid gap-4 sm:grid-cols-2">
              <Dato etiqueta="Tipo">{r.bien_tipo === 'producto' ? 'Producto' : 'Servicio'}</Dato>
              <Dato etiqueta="Monto reclamado">
                {r.monto != null ? `S/ ${Number(r.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : 'No indicado'}
              </Dato>
            </dl>
            <Texto etiqueta="Descripción">{r.bien_descripcion}</Texto>
          </Seccion>

          <Seccion numero={3} titulo="Detalle y pedido">
            <div className="space-y-4">
              <Texto etiqueta="Detalle">{r.detalle}</Texto>
              <Texto etiqueta="Pedido del consumidor">{r.pedido}</Texto>
            </div>
          </Seccion>
        </div>

        {/* Columna de gestión */}
        <aside className="space-y-5">
          <section className="caja p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-tinta-2">Estado</h2>
            <div className="flex flex-wrap items-center gap-2">
              <PlazoInsignia vence={r.vence} estado={r.estado} />
              {r.estado === 'en_proceso' && <Insignia tono="marca">En proceso</Insignia>}
            </div>
            <dl className="mt-4 space-y-3">
              <Dato etiqueta="Responder antes del">{formatoFecha(r.vence)}</Dato>
              <Dato etiqueta="Constancia al consumidor">{r.correo_constancia ? formatoFecha(r.correo_constancia) : 'No enviada'}</Dato>
              <Dato etiqueta="Aviso interno">{r.correo_aviso ? formatoFecha(r.correo_aviso) : 'No enviado'}</Dato>
              {r.respondido && <Dato etiqueta="Respondido">{formatoFecha(r.respondido)}</Dato>}
              {r.respondido && (
                <Dato etiqueta="Respuesta enviada">{r.correo_respuesta ? formatoFecha(r.correo_respuesta) : 'No enviada'}</Dato>
              )}
            </dl>

            {r.correo_error && (
              <div className="mt-4">
                <Aviso tono="aviso">Último intento de correo: {r.correo_error}</Aviso>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {r.estado === 'pendiente' && (
                <FormAccion accion={marcarEnProceso}>
                  {oculto}
                  <BotonEnviar variante="secundario" pendiente="Actualizando…">
                    Marcar en proceso
                  </BotonEnviar>
                </FormAccion>
              )}
              {(!r.correo_constancia || !r.correo_aviso) && (
                <FormAccion accion={reenviarAvisos}>
                  {oculto}
                  <BotonEnviar variante="secundario" pendiente="Enviando…">
                    Reenviar constancia
                  </BotonEnviar>
                </FormAccion>
              )}
              {r.respuesta && !r.correo_respuesta && (
                <FormAccion accion={reenviarRespuesta}>
                  {oculto}
                  <BotonEnviar variante="secundario" pendiente="Enviando…">
                    Reenviar respuesta
                  </BotonEnviar>
                </FormAccion>
              )}
            </div>
          </section>

          <section className="caja p-5">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-tinta-2">4 · Respuesta del proveedor</h2>
            {r.respuesta ? (
              <>
                <div className="mt-3">
                  {r.correo_respuesta ? (
                    <Aviso tono="ok">Respuesta enviada al consumidor el {formatoFecha(r.correo_respuesta)}.</Aviso>
                  ) : (
                    <Aviso tono="aviso">
                      Respuesta guardada y PDF actualizado, pero aún no se envió por correo. Use «Reenviar respuesta»
                      cuando el correo esté configurado.
                    </Aviso>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-fondo px-3.5 py-3 text-[15px] leading-relaxed text-tinta">{r.respuesta}</p>
              </>
            ) : (
              <FormAccion accion={responder} className="mt-3">
                {oculto}
                <p className="mb-3 text-sm text-tinta-3">
                  Se enviará al correo del consumidor junto con la hoja actualizada. Una vez enviada no se puede modificar.
                </p>
                <label htmlFor="respuesta" className="sr-only">
                  Respuesta
                </label>
                <textarea
                  id="respuesta"
                  name="respuesta"
                  rows={9}
                  required
                  minLength={20}
                  maxLength={6000}
                  className="campo resize-y"
                  placeholder="Describa las acciones adoptadas y la respuesta al pedido del consumidor."
                />
                <BotonEnviar
                  className="mt-3 w-full"
                  pendiente="Guardando y enviando…"
                  confirmar="¿Enviar la respuesta al consumidor? Después no podrá modificarse."
                >
                  Guardar y enviar respuesta
                </BotonEnviar>
              </FormAccion>
            )}
          </section>
        </aside>
      </div>

      <section className="caja mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-linea px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-tinta-2">Hoja de reclamación (PDF)</h2>
          {urlPdf && (
            <a href={urlPdf} target="_blank" rel="noopener" className="text-sm font-semibold text-marca hover:underline">
              Abrir en pestaña nueva ↗
            </a>
          )}
        </div>
        {urlPdf ? (
          <iframe src={urlPdf} title={`Hoja de reclamación ${r.codigo}`} className="h-[80vh] w-full bg-fondo" />
        ) : (
          <p className="px-5 py-10 text-center text-sm text-tinta-3">El PDF aún no se ha generado.</p>
        )}
      </section>
    </>
  );
}
