'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Aviso, claseBoton } from '@/componentes/ui';

/** Resultado que devuelven todas las acciones del panel. */
export type EstadoAccion = { ok: boolean; mensaje: string; tono?: 'ok' | 'aviso' | 'peligro' } | null;

export function BotonEnviar({
  children,
  pendiente = 'Guardando…',
  variante = 'primario',
  className = '',
  confirmar,
  ...resto
}: {
  children: ReactNode;
  pendiente?: string;
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma';
  className?: string;
  confirmar?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={claseBoton(variante, className)}
      onClick={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
      {...resto}
    >
      {pending ? pendiente : children}
    </button>
  );
}

/**
 * Formulario ligado a una server action con useActionState: muestra el
 * resultado debajo y, si se pide, se vacía tras un envío correcto.
 */
export function FormAccion({
  accion,
  children,
  className = '',
  limpiarAlGuardar = false,
}: {
  accion: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
  children: ReactNode;
  className?: string;
  limpiarAlGuardar?: boolean;
}) {
  const [estado, ejecutar] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok && limpiarAlGuardar) ref.current?.reset();
  }, [estado, limpiarAlGuardar]);

  return (
    <form ref={ref} action={ejecutar} className={className}>
      {children}
      {estado && (
        <div className="mt-3">
          <Aviso tono={estado.tono ?? (estado.ok ? 'ok' : 'peligro')}>{estado.mensaje}</Aviso>
        </div>
      )}
    </form>
  );
}
