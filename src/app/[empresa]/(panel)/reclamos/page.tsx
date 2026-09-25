import Link from 'next/link';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { Cabecera, Insignia, Vacio, formatoFecha } from '@/componentes/ui';
import { PlazoInsignia } from '@/componentes/plazo';

export const metadata = { title: 'Libro de reclamaciones' };

const FILTROS = [
  { id: 'abiertos', texto: 'Por responder' },
  { id: 'respondidos', texto: 'Respondidos' },
  { id: 'todos', texto: 'Todos' },
] as const;

export default async function Reclamos({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ filtro?: string; q?: string }>;
}) {
  const { empresa } = await exigirAcceso((await params).empresa, 'reclamos');
  const { filtro = 'abiertos', q = '' } = await searchParams;
  const sb = await supabaseServidor();

  let consulta = sb
    .from('reclamos')
    .select('id, codigo, creado, tipo, nombre, numero_documento, estado, vence, correo_constancia, correo_error')
    .eq('empresa_id', empresa.id);

  if (filtro === 'abiertos') consulta = consulta.neq('estado', 'respondido').order('vence', { ascending: true });
  else if (filtro === 'respondidos') consulta = consulta.eq('estado', 'respondido').order('creado', { ascending: false });
  else consulta = consulta.order('creado', { ascending: false });

  const busqueda = q.trim().replace(/[%,()]/g, '');
  if (busqueda) {
    consulta = consulta.or(
      `codigo.ilike.%${busqueda}%,nombre.ilike.%${busqueda}%,numero_documento.ilike.%${busqueda}%,correo.ilike.%${busqueda}%`,
    );
  }

  const { data: reclamos } = await consulta.limit(200);
  const base = `/${empresa.id}/reclamos`;

  return (
    <>
      <Cabecera
        titulo="Libro de reclamaciones"
        descripcion="Hojas registradas desde la web. El plazo legal de respuesta es de 15 días hábiles."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-linea-2 bg-white p-1" role="tablist">
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={`${base}?filtro=${f.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
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
          <input
            name="q"
            defaultValue={q}
            placeholder="Código, nombre, documento o correo"
            className="campo w-72 max-w-full"
            aria-label="Buscar reclamos"
          />
        </form>
      </div>

      {!reclamos?.length ? (
        <Vacio
          titulo={busqueda ? 'Sin resultados' : filtro === 'abiertos' ? 'No hay reclamos por responder' : 'Aún no hay reclamos'}
          texto={busqueda ? 'Pruebe con otro término.' : 'Cuando alguien registre una hoja desde la web, aparecerá aquí.'}
        />
      ) : (
        <div className="caja overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-linea bg-fondo/60 text-xs uppercase tracking-wide text-tinta-3">
              <tr>
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Registrado</th>
                <th className="px-4 py-3 font-semibold">Consumidor</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Plazo</th>
                <th className="px-4 py-3 font-semibold">Correo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {reclamos.map((r) => (
                <tr key={r.id} className="group relative hover:bg-fondo/60">
                  <td className="px-4 py-3 font-semibold text-tinta">
                    <Link href={`${base}/${r.id}`} className="after:absolute after:inset-0 group-hover:text-marca">
                      {r.codigo}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-tinta-2">{formatoFecha(r.creado)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-tinta">{r.nombre}</p>
                    <p className="text-xs text-tinta-3">{r.numero_documento}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-tinta-2">{r.tipo}</td>
                  <td className="px-4 py-3">
                    <PlazoInsignia vence={r.vence} estado={r.estado} />
                    {r.estado === 'en_proceso' && (
                      <span className="ml-1.5">
                        <Insignia tono="marca">En proceso</Insignia>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.correo_constancia ? (
                      <Insignia tono="ok">Constancia enviada</Insignia>
                    ) : (
                      <Insignia tono="aviso">Pendiente</Insignia>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
