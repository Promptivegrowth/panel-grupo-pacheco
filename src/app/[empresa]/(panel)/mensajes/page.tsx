import Link from 'next/link';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { Cabecera, Insignia, Vacio, formatoFecha } from '@/componentes/ui';

export const metadata = { title: 'Mensajes de contacto' };

const FILTROS = [
  { id: 'bandeja', texto: 'Bandeja' },
  { id: 'sin-leer', texto: 'Sin leer' },
  { id: 'archivados', texto: 'Archivados' },
] as const;

export default async function Mensajes({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ filtro?: string; q?: string }>;
}) {
  const { empresa } = await exigirAcceso((await params).empresa, 'mensajes');
  const { filtro = 'bandeja', q = '' } = await searchParams;
  const sb = await supabaseServidor();

  let consulta = sb
    .from('mensajes')
    .select('id, creado, tipo, nombre, empresa, correo, asunto, mensaje, leido, adjuntos')
    .eq('empresa_id', empresa.id)
    .order('creado', { ascending: false });

  if (filtro === 'archivados') consulta = consulta.eq('archivado', true);
  else consulta = consulta.eq('archivado', false);
  if (filtro === 'sin-leer') consulta = consulta.eq('leido', false);

  const busqueda = q.trim().replace(/[%,()]/g, '');
  if (busqueda) {
    consulta = consulta.or(
      `nombre.ilike.%${busqueda}%,empresa.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,mensaje.ilike.%${busqueda}%`,
    );
  }

  const { data: mensajes } = await consulta.limit(200);
  const base = `/${empresa.id}/mensajes`;

  return (
    <>
      <Cabecera titulo="Mensajes de contacto" descripcion="Lo que llega por los formularios de contacto y cotización de la web." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-linea-2 bg-white p-1" role="tablist">
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={`${base}?filtro=${f.id}`}
              role="tab"
              aria-selected={filtro === f.id}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                filtro === f.id ? 'bg-marca text-white' : 'text-tinta-2 hover:bg-fondo'
              }`}
            >
              {f.texto}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action={base}>
          <input type="hidden" name="filtro" value={filtro} />
          <input name="q" defaultValue={q} placeholder="Buscar nombre, empresa, correo o texto" className="campo w-72 max-w-full" aria-label="Buscar mensajes" />
        </form>
      </div>

      {!mensajes?.length ? (
        <Vacio
          titulo={busqueda ? 'Sin resultados' : filtro === 'sin-leer' ? 'Todo leído' : 'No hay mensajes'}
          texto={busqueda ? 'Pruebe con otro término.' : 'Los mensajes enviados desde la web aparecerán aquí.'}
        />
      ) : (
        <ul className="caja divide-y divide-linea overflow-hidden">
          {mensajes.map((m) => (
            <li key={m.id}>
              <Link href={`${base}/${m.id}`} className="flex gap-4 px-5 py-4 transition hover:bg-fondo/70">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${m.leido ? 'bg-transparent' : 'bg-marca'}`} aria-label={m.leido ? undefined : 'Sin leer'} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className={`truncate text-[15px] ${m.leido ? 'font-medium text-tinta-2' : 'font-bold text-tinta'}`}>
                      {m.nombre}
                      {m.empresa && <span className="font-normal text-tinta-3"> · {m.empresa}</span>}
                    </p>
                    {m.tipo === 'cotizacion' && <Insignia tono="marca">Cotización</Insignia>}
                    {m.asunto && <Insignia>{m.asunto}</Insignia>}
                    {Array.isArray(m.adjuntos) && m.adjuntos.length > 0 && (
                      <Insignia>
                        {m.adjuntos.length} adjunto{m.adjuntos.length === 1 ? '' : 's'}
                      </Insignia>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-tinta-3">{m.mensaje || m.correo}</p>
                </div>
                <time className="shrink-0 whitespace-nowrap text-xs text-tinta-3" dateTime={m.creado}>
                  {formatoFecha(m.creado)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
