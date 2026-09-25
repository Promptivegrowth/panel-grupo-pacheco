import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/** Piezas de interfaz sin estado, válidas en servidor y cliente. */

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca text-white hover:brightness-110 shadow-sm',
  secundario: 'bg-white text-tinta border border-linea-2 hover:border-tinta-3 hover:bg-fondo',
  peligro: 'bg-white text-peligro border border-peligro/30 hover:bg-peligro-fondo',
  fantasma: 'text-tinta-2 hover:bg-fondo hover:text-tinta',
};

export function claseBoton(variante: Variante = 'primario', extra = '') {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${extra}`;
}

export function EnlaceBoton({
  variante = 'primario',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={claseBoton(variante, className)} {...props} />;
}

export function Insignia({
  tono = 'neutro',
  children,
}: {
  tono?: 'neutro' | 'ok' | 'aviso' | 'peligro' | 'marca';
  children: ReactNode;
}) {
  const tonos = {
    neutro: 'bg-fondo text-tinta-2 ring-linea-2',
    ok: 'bg-ok-fondo text-ok ring-ok/20',
    aviso: 'bg-aviso-fondo text-aviso ring-aviso/20',
    peligro: 'bg-peligro-fondo text-peligro ring-peligro/20',
    marca: 'bg-marca/10 text-marca ring-marca/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tonos[tono]}`}>
      {children}
    </span>
  );
}

export function Cabecera({
  titulo,
  descripcion,
  acciones,
  volver,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  volver?: { href: string; texto: string };
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {volver && (
          <Link href={volver.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-tinta-3 hover:text-tinta">
            <span aria-hidden>←</span> {volver.texto}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-tinta">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-2xl text-[15px] text-tinta-3">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="caja flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-fondo text-tinta-3" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-semibold text-tinta">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-tinta-3">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

export function Aviso({ tono, children }: { tono: 'ok' | 'aviso' | 'peligro'; children: ReactNode }) {
  const tonos = {
    ok: 'border-ok/25 bg-ok-fondo text-ok',
    aviso: 'border-aviso/25 bg-aviso-fondo text-aviso',
    peligro: 'border-peligro/25 bg-peligro-fondo text-peligro',
  };
  return (
    <div role={tono === 'peligro' ? 'alert' : 'status'} className={`rounded-lg border px-3.5 py-2.5 text-sm font-medium ${tonos[tono]}`}>
      {children}
    </div>
  );
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-tinta-3">{etiqueta}</dt>
      <dd className="mt-1 break-words text-[15px] text-tinta">{children || <span className="text-tinta-3">—</span>}</dd>
    </div>
  );
}

const zona = 'America/Lima';

export const formatoFecha = (iso: string, conHora = true) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: iso.length === 10 ? 'UTC' : zona,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(conHora && iso.length > 10 ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));
