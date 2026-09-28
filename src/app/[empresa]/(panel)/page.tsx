import Link from 'next/link';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { NOMBRE_MODULO, type Modulo } from '@/lib/empresas';
import { habilesRestantes } from '@/lib/reclamos/plazos';
import { correoConfigurado } from '@/lib/correo';
import { Aviso, Cabecera, formatoFecha } from '@/componentes/ui';
import { Icono } from '@/componentes/navegacion';

export const metadata = { title: 'Resumen' };

export default async function Resumen({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa, modulos, usuario } = await exigirAcceso((await params).empresa);
  const sb = await supabaseServidor();
  const id = empresa.id;

  const [pendientes, proximo, sinLeer, empleos, datos, nuevas] = await Promise.all([
    modulos.includes('reclamos')
      ? sb.from('reclamos').select('id', { count: 'exact', head: true }).eq('empresa_id', id).neq('estado', 'respondido')
      : null,
    modulos.includes('reclamos')
      ? sb.from('reclamos').select('id, codigo, vence, nombre').eq('empresa_id', id).neq('estado', 'respondido').order('vence').limit(1).maybeSingle()
      : null,
    modulos.includes('mensajes')
      ? sb.from('mensajes').select('id', { count: 'exact', head: true }).eq('empresa_id', id).eq('leido', false).eq('archivado', false)
      : null,
    modulos.includes('empleos')
      ? sb.from('empleos').select('id', { count: 'exact', head: true }).eq('empresa_id', id).eq('publicado', true)
      : null,
    modulos.includes('sitio') ? sb.from('datos_contacto').select('id', { count: 'exact', head: true }).eq('empresa_id', id) : null,
    modulos.includes('postulaciones')
      ? sb.from('postulaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', id).eq('estado', 'nueva')
      : null,
  ]);

  const tarjetas: { modulo: Modulo; valor: number; texto: string }[] = [];
  if (pendientes) tarjetas.push({ modulo: 'reclamos', valor: pendientes.count ?? 0, texto: 'por responder' });
  if (sinLeer) tarjetas.push({ modulo: 'mensajes', valor: sinLeer.count ?? 0, texto: 'sin leer' });
  if (empleos) tarjetas.push({ modulo: 'empleos', valor: empleos.count ?? 0, texto: 'vacantes publicadas' });
  if (nuevas) tarjetas.push({ modulo: 'postulaciones', valor: nuevas.count ?? 0, texto: 'postulaciones nuevas' });
  if (datos) tarjetas.push({ modulo: 'sitio', valor: datos.count ?? 0, texto: 'datos editables' });

  const urgente = proximo?.data;
  const dias = urgente ? habilesRestantes(new Date(`${urgente.vence}T00:00:00Z`)) : null;

  return (
    <>
      <Cabecera titulo={`Hola, ${usuario.correo.split('@')[0]}`} descripcion={`Resumen de ${empresa.nombre}.`} />

      {modulos.includes('reclamos') && !correoConfigurado(id) && (
        <div className="mb-6">
          <Aviso tono="aviso">
            El envío de correos aún no está configurado para {empresa.nombre}. Los reclamos y mensajes se guardan
            igual y podrá reenviar las constancias desde cada reclamo cuando se configure.
          </Aviso>
        </div>
      )}

      {urgente && dias !== null && (
        <Link
          href={`/${id}/reclamos/${urgente.id}`}
          className={`caja mb-6 flex flex-wrap items-center justify-between gap-3 border-l-4 px-5 py-4 transition hover:shadow-lg ${
            dias <= 3 ? 'border-l-peligro' : 'border-l-aviso'
          }`}
        >
          <div>
            <p className="text-sm font-semibold text-tinta">
              Próximo vencimiento: {urgente.codigo} · {urgente.nombre}
            </p>
            <p className="text-sm text-tinta-3">
              Responder antes del {formatoFecha(urgente.vence)} ·{' '}
              {dias < 0 ? `vencido hace ${-dias} día(s) hábil(es)` : dias === 0 ? 'vence hoy' : `quedan ${dias} día(s) hábil(es)`}
            </p>
          </div>
          <span className="text-sm font-semibold text-marca">Atender →</span>
        </Link>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {tarjetas.map((t) => (
          <li key={t.modulo}>
            <Link href={`/${id}/${t.modulo}`} className="caja group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <span className="grid size-10 place-items-center rounded-lg bg-marca/10 text-marca">
                <Icono nombre={t.modulo} className="size-5" />
              </span>
              <p className="mt-4 text-3xl font-bold tracking-tight text-tinta">{t.valor}</p>
              <p className="text-sm text-tinta-3">{t.texto}</p>
              <p className="mt-4 text-sm font-semibold text-tinta-2 group-hover:text-marca">{NOMBRE_MODULO[t.modulo]} →</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
