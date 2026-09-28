import Link from 'next/link';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { NOMBRE_ESTADO, TONO_ESTADO, type EstadoPostulacion } from '@/lib/postulaciones';
import { Aviso, Cabecera, Insignia, Vacio, formatoFecha } from '@/componentes/ui';

export const metadata = { title: 'Postulaciones' };

const FILTROS = [
  { id: 'activas', texto: 'Por revisar' },
  { id: 'preseleccionada', texto: 'Preseleccionadas' },
  { id: 'descartada', texto: 'Descartadas' },
  { id: 'todas', texto: 'Todas' },
] as const;

export default async function Postulaciones({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ filtro?: string; puesto?: string; q?: string; eliminada?: string }>;
}) {
  const { empresa } = await exigirAcceso((await params).empresa, 'postulaciones');
  const { filtro = 'activas', puesto = '', q = '', eliminada } = await searchParams;
  const sb = await supabaseServidor();

  let consulta = sb
    .from('postulaciones')
    .select('id, creado, puesto, nombre, distrito, estudios, experiencia, experiencia_bpm, estado')
    .eq('empresa_id', empresa.id)
    .order('creado', { ascending: false });

  if (filtro === 'activas') consulta = consulta.in('estado', ['nueva', 'revisada']);
  else if (filtro === 'preseleccionada' || filtro === 'descartada') consulta = consulta.eq('estado', filtro);
  if (puesto) consulta = consulta.eq('puesto', puesto);

  const busqueda = q.trim().replace(/[%,()]/g, '');
  if (busqueda) {
    consulta = consulta.or(
      `nombre.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,numero_documento.ilike.%${busqueda}%,carrera.ilike.%${busqueda}%`,
    );
  }

  const [{ data: postulaciones }, { data: puestos }] = await Promise.all([
    consulta.limit(300),
    sb.from('postulaciones').select('puesto').eq('empresa_id', empresa.id),
  ]);
  const listaPuestos = [...new Set((puestos ?? []).map((p) => p.puesto))].sort();
  const base = `/${empresa.id}/postulaciones`;
  const enlace = (cambios: Record<string, string>) => {
    const u = new URLSearchParams({ filtro, ...(puesto && { puesto }), ...(q && { q }), ...cambios });
    for (const [k, v] of [...u]) if (!v) u.delete(k);
    return `${base}?${u}`;
  };

  return (
    <>
      <Cabecera
        titulo="Postulaciones"
        descripcion="Lo que llega por el botón «Postular» de «Trabaja con nosotros», con el CV de cada postulante."
      />

      {eliminada && (
        <div className="mb-4">
          <Aviso tono="ok">Postulación eliminada junto con su CV.</Aviso>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-linea-2 bg-white p-1" role="tablist">
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={enlace({ filtro: f.id })}
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
        <form className="flex flex-wrap gap-2" action={base}>
          <input type="hidden" name="filtro" value={filtro} />
          {listaPuestos.length > 1 && (
            <select name="puesto" defaultValue={puesto} className="campo w-60 max-w-full" aria-label="Filtrar por puesto">
              <option value="">Todos los puestos</option>
              {listaPuestos.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          )}
          <input name="q" defaultValue={q} placeholder="Nombre, correo, documento o carrera" className="campo w-64 max-w-full" aria-label="Buscar postulaciones" />
          <button type="submit" className="rounded-lg border border-linea-2 bg-white px-3 text-sm font-semibold text-tinta hover:bg-fondo">
            Filtrar
          </button>
        </form>
      </div>

      {!postulaciones?.length ? (
        <Vacio
          titulo={busqueda || puesto ? 'Sin resultados' : 'No hay postulaciones'}
          texto={busqueda || puesto ? 'Pruebe con otro filtro.' : 'Las postulaciones enviadas desde la web aparecerán aquí.'}
        />
      ) : (
        <ul className="caja divide-y divide-linea overflow-hidden">
          {postulaciones.map((p) => (
            <li key={p.id}>
              <Link href={`${base}/${p.id}`} className="flex gap-4 px-5 py-4 transition hover:bg-fondo/70">
                <span
                  className={`mt-2 size-2 shrink-0 rounded-full ${p.estado === 'nueva' ? 'bg-marca' : 'bg-transparent'}`}
                  aria-label={p.estado === 'nueva' ? 'Nueva' : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className={`truncate text-[15px] ${p.estado === 'nueva' ? 'font-bold text-tinta' : 'font-medium text-tinta-2'}`}>{p.nombre}</p>
                    <Insignia tono={TONO_ESTADO[p.estado as EstadoPostulacion]}>{NOMBRE_ESTADO[p.estado as EstadoPostulacion]}</Insignia>
                  </div>
                  <p className="mt-1 text-sm font-medium text-tinta-2">{p.puesto}</p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-tinta-3">
                    {[p.estudios, p.experiencia, p.experiencia_bpm ? 'BPM/BPA' : null, p.distrito].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <time className="shrink-0 whitespace-nowrap text-xs text-tinta-3" dateTime={p.creado}>
                  {formatoFecha(p.creado)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
