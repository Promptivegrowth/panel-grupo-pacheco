import Image from 'next/image';
import Link from 'next/link';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { NOMBRE_MODULO } from '@/lib/empresas';
import { Navegacion, type ItemNav } from '@/componentes/navegacion';
import { salir } from '../ingresar/acciones';

export default async function LayoutPanel({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ empresa: string }>;
}) {
  const { empresa, rol, usuario, modulos } = await exigirAcceso((await params).empresa);
  const sb = await supabaseServidor();

  // Contadores de pendientes para la barra lateral (la RLS limita lo visible).
  const [reclamos, mensajes, postulaciones] = await Promise.all([
    modulos.includes('reclamos')
      ? sb.from('reclamos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresa.id).neq('estado', 'respondido')
      : null,
    modulos.includes('mensajes')
      ? sb.from('mensajes').select('id', { count: 'exact', head: true }).eq('empresa_id', empresa.id).eq('leido', false).eq('archivado', false)
      : null,
    modulos.includes('postulaciones')
      ? sb.from('postulaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresa.id).eq('estado', 'nueva')
      : null,
  ]);
  const contadores: Partial<Record<string, number>> = {
    reclamos: reclamos?.count ?? 0,
    mensajes: mensajes?.count ?? 0,
    postulaciones: postulaciones?.count ?? 0,
  };

  const base = `/${empresa.id}`;
  const items: ItemNav[] = [
    { href: base, texto: 'Resumen', icono: 'resumen' },
    ...modulos.map((m) => ({
      href: `${base}/${m}`,
      texto: NOMBRE_MODULO[m],
      icono: m,
      contador: contadores[m],
    })),
  ];

  const cabecera = (
    <Link href={base} className="flex min-h-16 items-center gap-3 px-4 py-2 lg:min-h-20 lg:border-b lg:border-linea">
      <span className="grid h-11 w-20 shrink-0 place-items-center rounded-md px-1.5 ring-1 ring-linea" style={{ background: empresa.logoFondo }}>
        <Image src={empresa.logo} alt="" width={80} height={36} className="max-h-8 w-auto object-contain" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight text-tinta">{empresa.nombre}</span>
        <span className="mt-0.5 block text-xs text-tinta-3">Portal Grupo Pacheco</span>
      </span>
    </Link>
  );

  const pie = (
    <div className="space-y-2">
      <div className="px-2">
        <p className="truncate text-sm font-medium text-tinta" title={usuario.correo}>
          {usuario.correo}
        </p>
        <p className="text-xs text-tinta-3">{rol === 'maestro' ? 'Usuario maestro' : 'Gestión de empleos'}</p>
      </div>
      <div className="flex gap-1">
        <Link href="/" className="flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold text-tinta-2 hover:bg-fondo">
          Cambiar empresa
        </Link>
        <form action={salir} className="flex-1">
          <input type="hidden" name="destino" value={`${base}/ingresar`} />
          <button type="submit" className="w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-peligro hover:bg-peligro-fondo">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="lg:flex" style={{ '--marca': empresa.color } as React.CSSProperties}>
      <Navegacion items={items} cabecera={cabecera} pie={pie} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
