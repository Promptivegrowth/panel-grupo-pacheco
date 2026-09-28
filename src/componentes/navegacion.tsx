'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

export type ItemNav = { href: string; texto: string; icono: string; contador?: number };

const ICONOS: Record<string, ReactNode> = {
  resumen: <path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />,
  reclamos: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h7M9 16h5" />
    </>
  ),
  mensajes: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  sitio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </>
  ),
  empleos: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18" />
    </>
  ),
  postulaciones: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c.6-3.6 3.2-5.5 6.5-5.5 1.4 0 2.7.3 3.7 1M16 19.5l2 2 3.5-4" />
    </>
  ),
};

export function Icono({ nombre, className = 'size-[18px]' }: { nombre: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONOS[nombre]}
    </svg>
  );
}

export function Navegacion({ items, pie, cabecera }: { items: ItemNav[]; pie: ReactNode; cabecera: ReactNode }) {
  const ruta = usePathname();
  // El menú móvil recuerda en qué ruta se abrió: al navegar a otra, queda
  // cerrado sin necesidad de un efecto.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === ruta;

  const activo = (href: string) =>
    href.split('/').length === 2 ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);

  const lista = (
    <nav aria-label="Módulos" className="space-y-0.5">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={activo(it.href) ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] font-medium transition ${
            activo(it.href) ? 'bg-marca/10 text-marca' : 'text-tinta-2 hover:bg-fondo hover:text-tinta'
          }`}
        >
          <Icono nombre={it.icono} />
          <span className="flex-1">{it.texto}</span>
          {it.contador ? (
            <span className="rounded-full bg-marca px-1.5 py-px text-[11px] font-bold text-white">{it.contador}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-linea bg-white lg:flex">
        {cabecera}
        <div className="flex-1 overflow-y-auto px-3 py-4">{lista}</div>
        <div className="border-t border-linea p-3">{pie}</div>
      </aside>

      {/* Móvil */}
      <div className="sticky top-0 z-30 border-b border-linea bg-white lg:hidden">
        <div className="flex items-center justify-between gap-3 pr-3">
          <div className="min-w-0 flex-1">{cabecera}</div>
          <button
            type="button"
            onClick={() => setAbiertoEn(abierto ? null : ruta)}
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            className="grid size-10 place-items-center rounded-lg border border-linea-2 text-tinta"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {abierto ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {abierto && (
          <div className="border-t border-linea px-3 pb-3 pt-2">
            {lista}
            <div className="mt-3 border-t border-linea pt-3">{pie}</div>
          </div>
        )}
      </div>
    </>
  );
}
