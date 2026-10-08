import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { borrar, moverFila } from './acciones';

/**
 * Piezas que comparten las tres pantallas del catálogo (líneas, categoría y
 * producto). Están aquí y no en `componentes/` porque solo tienen sentido con
 * estas tablas: saben que la jerarquía se reordena entre hermanos y que
 * borrar un padre se lleva a sus hijos.
 */

export type Tabla =
  | 'catalogo_lineas'
  | 'catalogo_categorias'
  | 'catalogo_productos'
  | 'catalogo_presentaciones';

export function Visible({ id, marcado }: { id: string; marcado: boolean }) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-tinta-2">
      <input id={id} type="checkbox" name="visible" defaultChecked={marcado} className="size-4 accent-(--color-marca)" />
      Visible en la web
    </label>
  );
}

export function Campo({
  nombre,
  rotulo,
  valor,
  max = 200,
  requerido = false,
  pista,
  area = false,
  filas = 4,
  pref = '',
}: {
  nombre: string;
  rotulo: string;
  valor?: string | null;
  max?: number;
  requerido?: boolean;
  pista?: string;
  area?: boolean;
  filas?: number;
  pref?: string;
}) {
  const id = `${pref}-${nombre}`;
  return (
    <div className="min-w-0">
      <label className="etiqueta" htmlFor={id}>
        {rotulo}
      </label>
      {area ? (
        <textarea
          id={id}
          name={nombre}
          defaultValue={valor ?? ''}
          rows={filas}
          maxLength={max}
          required={requerido}
          className="campo"
        />
      ) : (
        <input
          id={id}
          name={nombre}
          defaultValue={valor ?? ''}
          maxLength={max}
          required={requerido}
          className="campo"
        />
      )}
      {pista && <p className="mt-1 text-xs text-tinta-3">{pista}</p>}
    </div>
  );
}

const FLECHA =
  'grid size-8 place-items-center rounded-md border border-linea-2 bg-white text-tinta-2 hover:bg-fondo disabled:opacity-40';

/** Sube y baja una fila dentro de su grupo. */
export function Flechas({
  empresa,
  tabla,
  id,
  padre,
  primero,
  ultimo,
}: {
  empresa: string;
  tabla: Tabla;
  id: string;
  padre: string;
  primero: boolean;
  ultimo: boolean;
}) {
  const ocultos = (
    <>
      <input type="hidden" name="empresa" value={empresa} />
      <input type="hidden" name="tabla" value={tabla} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="padre" value={padre} />
    </>
  );
  return (
    <>
      <FormAccion accion={moverFila} claseAviso="">
        {ocultos}
        <input type="hidden" name="sentido" value="arriba" />
        <button type="submit" className={FLECHA} disabled={primero} aria-label="Subir">
          ↑
        </button>
      </FormAccion>
      <FormAccion accion={moverFila} claseAviso="">
        {ocultos}
        <input type="hidden" name="sentido" value="abajo" />
        <button type="submit" className={FLECHA} disabled={ultimo} aria-label="Bajar">
          ↓
        </button>
      </FormAccion>
    </>
  );
}

export function Borrar({
  empresa,
  tabla,
  id,
  confirmar,
  texto = 'Eliminar',
}: {
  empresa: string;
  tabla: Tabla;
  id: string;
  confirmar: string;
  texto?: string;
}) {
  return (
    <FormAccion accion={borrar} claseAviso="mt-2">
      <input type="hidden" name="empresa" value={empresa} />
      <input type="hidden" name="tabla" value={tabla} />
      <input type="hidden" name="id" value={id} />
      <BotonEnviar variante="peligro" className="py-1.5" pendiente="Eliminando…" confirmar={confirmar}>
        {texto}
      </BotonEnviar>
    </FormAccion>
  );
}

/** «3 productos», «1 producto». */
export const cuenta = (n: number, singular: string, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`;
