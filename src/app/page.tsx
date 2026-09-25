import Image from 'next/image';
import Link from 'next/link';
import { LISTA_EMPRESAS } from '@/lib/empresas';

export default function Inicio() {
  return (
    <main className="flex min-h-dvh flex-col">
      {/* Franja con el azul del grupo: crece con su contenido */}
      <header
        className="bg-grupo px-5 pb-28 pt-12 sm:pt-16"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.07) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="rounded-2xl bg-white px-6 py-4 shadow-lg shadow-black/10">
            <Image src="/marcas/grupo-pacheco.png" alt="Grupo Pacheco" width={200} height={83} priority />
          </div>
          <h1 className="mt-7 text-3xl font-bold tracking-tight text-white sm:text-4xl">Portal administrativo</h1>
          <p className="mt-2 max-w-md text-[15px] text-white/75">
            Elija la empresa con la que va a trabajar e ingrese con su usuario.
          </p>
        </div>
      </header>

      <div className="mx-auto -mt-20 w-full max-w-5xl flex-1 px-5 pb-16">
        <ul className="grid gap-5 sm:grid-cols-3">
          {LISTA_EMPRESAS.map((e) => (
            <li key={e.id}>
              <Link
                href={`/${e.id}/ingresar`}
                className="caja group flex h-full flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-xl focus-visible:-translate-y-1"
                style={{ '--marca': e.color } as React.CSSProperties}
              >
                <div className="grid h-36 place-items-center px-8" style={{ background: e.logoFondo }}>
                  <Image
                    src={e.logo}
                    alt={e.nombre}
                    width={220}
                    height={90}
                    className="max-h-20 w-auto object-contain transition duration-300 group-hover:scale-[1.04]"
                    priority
                  />
                </div>
                <div className="flex flex-1 items-end justify-between gap-3 border-t border-linea px-5 py-4">
                  <div>
                    <p className="font-semibold text-tinta">{e.nombre}</p>
                    <p className="mt-0.5 text-sm text-tinta-3">{e.descripcion}</p>
                  </div>
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-marca/10 text-marca transition group-hover:bg-marca group-hover:text-white"
                    aria-hidden
                  >
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <footer className="pb-8 text-center text-xs text-tinta-3">
        Grupo Pacheco · Uso interno. Los accesos quedan registrados.
      </footer>
    </main>
  );
}
