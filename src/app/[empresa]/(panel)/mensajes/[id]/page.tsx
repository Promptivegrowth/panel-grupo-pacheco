import { notFound } from 'next/navigation';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { Cabecera, Dato, Insignia, formatoFecha } from '@/componentes/ui';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { cambiarMensaje, eliminarMensaje } from '../acciones';
import { etiquetaDato, valorDato } from '@/lib/etiquetas-datos';
import { pesoLegible, type Adjunto } from '@/lib/adjuntos';

export const metadata = { title: 'Mensaje' };

export default async function DetalleMensaje({ params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa: empresaId, id } = await params;
  const { empresa } = await exigirAcceso(empresaId, 'mensajes');
  const sb = await supabaseServidor();

  const { data: m } = await sb.from('mensajes').select('*').eq('id', id).eq('empresa_id', empresa.id).maybeSingle();
  if (!m) notFound();

  // Abrirlo lo marca como leído.
  if (!m.leido) await sb.from('mensajes').update({ leido: true }).eq('id', m.id);

  const extra = Object.entries((m.datos ?? {}) as Record<string, string>);
  // Adjuntos: enlaces firmados de 10 minutos (la política del bucket exige rol maestro).
  const adjuntos = await Promise.all(
    ((m.adjuntos ?? []) as Adjunto[]).map(async (a) => {
      const { data } = await sb.storage.from('mensajes').createSignedUrl(a.ruta, 600, { download: a.nombre });
      return { ...a, url: data?.signedUrl };
    }),
  );
  const oculto = (
    <>
      <input type="hidden" name="empresa" value={empresa.id} />
      <input type="hidden" name="id" value={m.id} />
    </>
  );
  const asunto = encodeURIComponent(`Re: ${m.asunto || 'su mensaje'} · ${empresa.nombre}`);

  return (
    <>
      <Cabecera
        volver={{ href: `/${empresa.id}/mensajes`, texto: 'Mensajes' }}
        titulo={m.nombre}
        descripcion={
          <span className="inline-flex flex-wrap items-center gap-2">
            Recibido el {formatoFecha(m.creado)}
            {m.tipo === 'cotizacion' && <Insignia tono="marca">Cotización</Insignia>}
            {m.archivado && <Insignia>Archivado</Insignia>}
          </span>
        }
        acciones={
          m.correo ? (
            <a
              href={`mailto:${m.correo}?subject=${asunto}`}
              className="inline-flex items-center gap-2 rounded-lg bg-marca px-3.5 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Responder por correo
            </a>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="caja p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-tinta-2">Mensaje</h2>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-tinta">{m.mensaje || <span className="text-tinta-3">Sin mensaje.</span>}</p>
          {adjuntos.length > 0 && (
            <div className="mt-5 border-t border-linea pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-3">Archivos adjuntos</h3>
              <ul className="space-y-2">
                {adjuntos.map((a) => (
                  <li key={a.ruta} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linea px-3 py-2">
                    <span className="min-w-0 break-all text-sm font-medium text-tinta">
                      {a.nombre} <span className="font-normal text-tinta-3">· {pesoLegible(a.tamano)}</span>
                    </span>
                    {a.url && (
                      <a href={a.url} className="text-sm font-semibold text-marca hover:underline">
                        Descargar
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {m.pagina && <p className="mt-5 text-xs text-tinta-3">Enviado desde {m.pagina}</p>}
        </section>

        <aside className="space-y-5">
          <section className="caja p-5">
            <dl className="space-y-3">
              <Dato etiqueta="Empresa">{m.empresa}</Dato>
              <Dato etiqueta="Correo">
                {m.correo && (
                  <a className="text-marca hover:underline" href={`mailto:${m.correo}`}>
                    {m.correo}
                  </a>
                )}
              </Dato>
              <Dato etiqueta="Teléfono">
                {m.telefono && (
                  <a className="text-marca hover:underline" href={`tel:${m.telefono.replace(/[^\d+]/g, '')}`}>
                    {m.telefono}
                  </a>
                )}
              </Dato>
              <Dato etiqueta="Servicio de interés">{m.asunto}</Dato>
              {extra.map(([k, v]) => (
                <Dato key={k} etiqueta={etiquetaDato(k)}>
                  {valorDato(k, v)}
                </Dato>
              ))}
            </dl>
          </section>

          <section className="caja flex flex-wrap gap-2 p-4">
            {m.archivado ? (
              <FormAccion accion={cambiarMensaje}>
                {oculto}
                <input type="hidden" name="operacion" value="desarchivar" />
                <BotonEnviar variante="secundario">Devolver a la bandeja</BotonEnviar>
              </FormAccion>
            ) : (
              <>
                <FormAccion accion={cambiarMensaje}>
                  {oculto}
                  <input type="hidden" name="operacion" value="archivar" />
                  <BotonEnviar variante="secundario">Archivar</BotonEnviar>
                </FormAccion>
                <FormAccion accion={cambiarMensaje}>
                  {oculto}
                  <input type="hidden" name="operacion" value="no-leido" />
                  <BotonEnviar variante="fantasma">Marcar no leído</BotonEnviar>
                </FormAccion>
              </>
            )}
            <FormAccion accion={eliminarMensaje}>
              {oculto}
              <BotonEnviar variante="peligro" pendiente="Eliminando…" confirmar="¿Eliminar este mensaje definitivamente?">
                Eliminar
              </BotonEnviar>
            </FormAccion>
          </section>
        </aside>
      </div>
    </>
  );
}
