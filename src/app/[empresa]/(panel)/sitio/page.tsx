import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { EmpresaUI } from '@/lib/empresas';
import { Cabecera, Insignia } from '@/componentes/ui';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { eliminarDato, guardarDato, moverDato, type TipoDato } from './acciones';

export const metadata = { title: 'Datos de la web' };

type Dato = {
  id: string;
  tipo: TipoDato;
  etiqueta: string;
  valor: string;
  valor_en: string | null;
  detalle: string | null;
  red: string | null;
  orden: number;
  visible: boolean;
  actualizado: string;
};

const GRUPOS: { tipo: TipoDato; titulo: string; ayuda: string; agregar: string }[] = [
  { tipo: 'whatsapp', titulo: 'WhatsApp', ayuda: 'Número del botón flotante y de los enlaces de WhatsApp, con el mensaje que llega ya escrito.', agregar: 'Agregar número' },
  { tipo: 'telefono', titulo: 'Teléfonos', ayuda: 'Se muestran en el pie y en la página de contacto, en este orden.', agregar: 'Agregar teléfono' },
  { tipo: 'correo', titulo: 'Correos', ayuda: 'Correos por área. Se muestran en la página de contacto.', agregar: 'Agregar correo' },
  { tipo: 'direccion', titulo: 'Dirección', ayuda: 'Dirección de la planta u oficina, con el enlace que abre el mapa.', agregar: 'Agregar dirección' },
  { tipo: 'horario', titulo: 'Horario de atención', ayuda: 'Texto libre, por ejemplo «Lunes a viernes, 8:00 a. m. – 6:00 p. m.».', agregar: 'Agregar horario' },
  { tipo: 'red', titulo: 'Redes sociales', ayuda: 'Iconos del pie y de la página de contacto. Use el enlace completo del perfil.', agregar: 'Agregar red social' },
];

const REDES = [
  ['linkedin', 'LinkedIn'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'],
  ['x', 'X (Twitter)'],
] as const;

/** Campos de cada tipo, compartidos por la edición y el alta. */
function Campos({ tipo, d, bilingue }: { tipo: TipoDato; d?: Dato; bilingue: boolean }) {
  const pref = d?.id ?? `nuevo-${tipo}`;
  const et = (
    <div>
      <label className="etiqueta" htmlFor={`${pref}-etiqueta`}>
        Área o etiqueta
      </label>
      <input id={`${pref}-etiqueta`} name="etiqueta" defaultValue={d?.etiqueta} className="campo" maxLength={60} required={tipo === 'telefono' || tipo === 'correo'} />
    </div>
  );

  switch (tipo) {
    case 'whatsapp':
      return (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div>
            <label className="etiqueta" htmlFor={`${pref}-valor`}>
              Número con código de país
            </label>
            <input id={`${pref}-valor`} name="valor" defaultValue={d?.valor} className="campo" inputMode="tel" placeholder="51 942 319 378" required />
          </div>
          <div>
            <label className="etiqueta" htmlFor={`${pref}-detalle`}>
              Mensaje predeterminado
            </label>
            <input id={`${pref}-detalle`} name="detalle" defaultValue={d?.detalle ?? ''} className="campo" maxLength={500} />
          </div>
        </div>
      );
    case 'telefono':
    case 'correo':
      return (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          {et}
          <div>
            <label className="etiqueta" htmlFor={`${pref}-valor`}>
              {tipo === 'telefono' ? 'Número' : 'Correo'}
            </label>
            <input
              id={`${pref}-valor`}
              name="valor"
              defaultValue={d?.valor}
              className="campo"
              type={tipo === 'correo' ? 'email' : 'text'}
              inputMode={tipo === 'telefono' ? 'tel' : 'email'}
              required
            />
          </div>
        </div>
      );
    case 'direccion':
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
            {et}
            <div>
              <label className="etiqueta" htmlFor={`${pref}-valor`}>
                Dirección
              </label>
              <input id={`${pref}-valor`} name="valor" defaultValue={d?.valor} className="campo" maxLength={250} required />
            </div>
          </div>
          <div>
            <label className="etiqueta" htmlFor={`${pref}-detalle`}>
              Enlace de Google Maps (opcional)
            </label>
            <input id={`${pref}-detalle`} name="detalle" defaultValue={d?.detalle ?? ''} className="campo" type="url" placeholder="https://maps.google.com/…" />
          </div>
        </div>
      );
    case 'horario':
      return (
        <div className={`grid gap-3 ${bilingue ? 'sm:grid-cols-2' : ''}`}>
          <div>
            <label className="etiqueta" htmlFor={`${pref}-valor`}>
              Horario{bilingue ? ' (español)' : ''}
            </label>
            <input id={`${pref}-valor`} name="valor" defaultValue={d?.valor} className="campo" maxLength={200} required />
          </div>
          {bilingue && (
            <div>
              <label className="etiqueta" htmlFor={`${pref}-valor_en`}>
                Horario (inglés)
              </label>
              <input id={`${pref}-valor_en`} name="valor_en" defaultValue={d?.valor_en ?? ''} className="campo" maxLength={200} />
            </div>
          )}
        </div>
      );
    case 'red':
      return (
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div>
            <label className="etiqueta" htmlFor={`${pref}-red`}>
              Red
            </label>
            <select id={`${pref}-red`} name="red" defaultValue={d?.red ?? ''} className="campo" required>
              <option value="" disabled>
                Elegir…
              </option>
              {REDES.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor={`${pref}-valor`}>
              Enlace del perfil
            </label>
            <input id={`${pref}-valor`} name="valor" defaultValue={d?.valor} className="campo" type="url" placeholder="https://…" required />
          </div>
        </div>
      );
  }
}

function Visible({ id, marcado }: { id: string; marcado: boolean }) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-tinta-2">
      <input id={id} type="checkbox" name="visible" defaultChecked={marcado} className="size-4 accent-(--color-marca)" />
      Visible en la web
    </label>
  );
}

function Fila({ d, empresa, primero, ultimo }: { d: Dato; empresa: EmpresaUI; primero: boolean; ultimo: boolean }) {
  const ocultos = (
    <>
      <input type="hidden" name="empresa" value={empresa.id} />
      <input type="hidden" name="tipo" value={d.tipo} />
      <input type="hidden" name="id" value={d.id} />
    </>
  );
  const flecha = 'grid size-8 place-items-center rounded-md border border-linea-2 bg-white text-tinta-2 hover:bg-fondo disabled:opacity-40';

  // Los formularios no se pueden anidar: guardar, mover y eliminar son tres
  // formularios hermanos. En escritorio comparten la última línea.
  return (
    <li
      className={`grid gap-3 rounded-xl border p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end ${
        d.visible ? 'border-linea bg-white' : 'border-dashed border-linea-2 bg-fondo/60'
      }`}
    >
      <FormAccion accion={guardarDato}>
        {ocultos}
        <Campos tipo={d.tipo} d={d} bilingue={empresa.bilingue} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Visible id={`${d.id}-visible`} marcado={d.visible} />
          {!d.visible && <Insignia tono="aviso">Oculto</Insignia>}
          <BotonEnviar variante="secundario" className="ml-auto py-1.5 lg:ml-0">
            Guardar cambios
          </BotonEnviar>
        </div>
      </FormAccion>

      <div className="flex items-center justify-end gap-1.5 border-t border-linea pt-3 lg:border-0 lg:pt-0">
        {d.tipo !== 'whatsapp' && (
          <>
            <FormAccion accion={moverDato}>
              {ocultos}
              <input type="hidden" name="sentido" value="arriba" />
              <button type="submit" className={flecha} disabled={primero} aria-label="Subir">
                ↑
              </button>
            </FormAccion>
            <FormAccion accion={moverDato}>
              {ocultos}
              <input type="hidden" name="sentido" value="abajo" />
              <button type="submit" className={flecha} disabled={ultimo} aria-label="Bajar">
                ↓
              </button>
            </FormAccion>
          </>
        )}
        <FormAccion accion={eliminarDato}>
          {ocultos}
          <BotonEnviar variante="peligro" className="py-1.5" pendiente="Eliminando…" confirmar="¿Eliminar este dato de la web?">
            Eliminar
          </BotonEnviar>
        </FormAccion>
      </div>
    </li>
  );
}

export default async function DatosWeb({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await exigirAcceso((await params).empresa, 'sitio');
  const sb = await supabaseServidor();
  const { data } = await sb
    .from('datos_contacto')
    .select('id, tipo, etiqueta, valor, valor_en, detalle, red, orden, visible, actualizado')
    .eq('empresa_id', empresa.id)
    .order('orden')
    .order('id');
  const datos = (data ?? []) as Dato[];

  return (
    <>
      <Cabecera
        titulo="Datos de la web"
        descripcion={
          <>
            Lo que cambie aquí aparece en la web al recargar la página, sin publicar de nuevo. Los datos ocultos se
            conservan pero no se muestran.
          </>
        }
      />

      <div className="space-y-6">
        {GRUPOS.map((g) => {
          const filas = datos.filter((d) => d.tipo === g.tipo);
          return (
            <section key={g.tipo} className="caja p-5" aria-labelledby={`grupo-${g.tipo}`}>
              <div className="mb-4">
                <h2 id={`grupo-${g.tipo}`} className="text-lg font-bold text-tinta">
                  {g.titulo}
                </h2>
                <p className="text-sm text-tinta-3">{g.ayuda}</p>
              </div>

              {filas.length > 0 ? (
                <ul className="space-y-3">
                  {filas.map((d, i) => (
                    <Fila key={d.id} d={d} empresa={empresa} primero={i === 0} ultimo={i === filas.length - 1} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-fondo px-4 py-3 text-sm text-tinta-3">No hay datos de este tipo.</p>
              )}

              <details className="group mt-4 rounded-xl border border-dashed border-linea-2 open:border-solid open:bg-fondo/40">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-marca [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">+ {g.agregar}</span>
                  <span className="hidden group-open:inline">Nuevo · {g.titulo.toLowerCase()}</span>
                </summary>
                <div className="px-4 pb-4">
                  <FormAccion accion={guardarDato} limpiarAlGuardar>
                    <input type="hidden" name="empresa" value={empresa.id} />
                    <input type="hidden" name="tipo" value={g.tipo} />
                    <Campos tipo={g.tipo} bilingue={empresa.bilingue} />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <Visible id={`nuevo-${g.tipo}-visible`} marcado />
                      <BotonEnviar className="py-1.5" pendiente="Agregando…">
                        Agregar
                      </BotonEnviar>
                    </div>
                  </FormAccion>
                </div>
              </details>
            </section>
          );
        })}
      </div>
    </>
  );
}
