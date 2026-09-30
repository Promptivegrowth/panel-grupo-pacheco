import { notFound } from 'next/navigation';
import { exigirAcceso } from '@/lib/sesion';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { Cabecera } from '@/componentes/ui';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { eliminarEmpleo, guardarEmpleo } from '../acciones';

export const metadata = { title: 'Vacante' };

type Empleo = {
  id: string;
  titulo: string;
  area: string | null;
  ubicacion: string | null;
  modalidad: string;
  jornada: string;
  resumen: string;
  reporta_a: string | null;
  requisitos: string[];
  funciones: string[];
  beneficios: string[];
  correo_postulacion: string;
  fecha_cierre: string | null;
  publicado: boolean;
};

function Lista({ nombre, titulo, ayuda, valor, requerido }: { nombre: string; titulo: string; ayuda: string; valor?: string[]; requerido?: boolean }) {
  return (
    <div>
      <label htmlFor={nombre} className="etiqueta">
        {titulo}
      </label>
      <textarea
        id={nombre}
        name={nombre}
        rows={5}
        defaultValue={(valor ?? []).join('\n')}
        className="campo resize-y"
        required={requerido}
        aria-describedby={`${nombre}-ayuda`}
      />
      <p id={`${nombre}-ayuda`} className="mt-1 text-xs text-tinta-3">
        {ayuda}
      </p>
    </div>
  );
}

export default async function EditarEmpleo({ params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa: empresaId, id } = await params;
  const { empresa } = await exigirAcceso(empresaId, 'empleos');

  let e: Empleo | null = null;
  if (id !== 'nuevo') {
    const sb = await supabaseServidor();
    const { data } = await sb.from('empleos').select('*').eq('id', id).eq('empresa_id', empresa.id).maybeSingle();
    if (!data) notFound();
    e = data as Empleo;
  }

  return (
    <>
      <Cabecera
        volver={{ href: `/${empresa.id}/empleos`, texto: 'Trabaja con nosotros' }}
        titulo={e ? 'Editar vacante' : 'Nueva vacante'}
        descripcion="Escriba cada responsabilidad, requisito o beneficio en una línea: en la web se muestran como lista."
      />

      <FormAccion accion={guardarEmpleo} className="caja space-y-5 p-5 sm:p-6">
        <input type="hidden" name="empresa" value={empresa.id} />
        {e && <input type="hidden" name="id" value={e.id} />}

        <div>
          <label htmlFor="titulo" className="etiqueta">
            Puesto
          </label>
          <input id="titulo" name="titulo" defaultValue={e?.titulo} className="campo text-base font-semibold" required maxLength={120} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="area" className="etiqueta">
              Área
            </label>
            <input id="area" name="area" defaultValue={e?.area ?? ''} className="campo" maxLength={80} placeholder="Producción" />
          </div>
          <div>
            <label htmlFor="ubicacion" className="etiqueta">
              Ubicación
            </label>
            <input id="ubicacion" name="ubicacion" defaultValue={e?.ubicacion ?? 'Callao'} className="campo" maxLength={80} />
          </div>
          <div>
            <label htmlFor="modalidad" className="etiqueta">
              Modalidad
            </label>
            <select id="modalidad" name="modalidad" defaultValue={e?.modalidad ?? 'Presencial'} className="campo">
              <option>Presencial</option>
              <option>Híbrido</option>
              <option>Remoto</option>
            </select>
          </div>
          <div>
            <label htmlFor="jornada" className="etiqueta">
              Jornada
            </label>
            <select id="jornada" name="jornada" defaultValue={e?.jornada ?? 'Tiempo completo'} className="campo">
              <option>Tiempo completo</option>
              <option>Medio tiempo</option>
              <option>Por turnos</option>
              <option>Prácticas</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="resumen" className="etiqueta">
            Resumen del puesto
          </label>
          <textarea id="resumen" name="resumen" rows={3} defaultValue={e?.resumen} className="campo resize-y" required minLength={20} maxLength={600} />
        </div>

        <div className="sm:w-1/2">
          <label htmlFor="reporta_a" className="etiqueta">
            Reporta a
          </label>
          <input id="reporta_a" name="reporta_a" defaultValue={e?.reporta_a ?? ''} className="campo" maxLength={120} placeholder="Jefe de Producción" />
          <p className="mt-1 text-xs text-tinta-3">Opcional. Según el MOF del puesto.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Lista nombre="funciones" titulo="Responsabilidades" ayuda="Una por línea. Opcional." valor={e?.funciones} />
          <Lista nombre="requisitos" titulo="Requisitos" ayuda="Uno por línea. Obligatorio." valor={e?.requisitos} requerido />
          <Lista nombre="beneficios" titulo="Beneficios" ayuda="Uno por línea. Opcional." valor={e?.beneficios} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="correo_postulacion" className="etiqueta">
              Correo para postular
            </label>
            <input
              id="correo_postulacion"
              name="correo_postulacion"
              type="email"
              defaultValue={e?.correo_postulacion ?? 'administracion@laboratoriospacheco.com'}
              className="campo"
              required
            />
            <p className="mt-1 text-xs text-tinta-3">El botón «Postular» de la web abre un correo a esta dirección.</p>
          </div>
          <div>
            <label htmlFor="fecha_cierre" className="etiqueta">
              Fecha de cierre (opcional)
            </label>
            <input id="fecha_cierre" name="fecha_cierre" type="date" defaultValue={e?.fecha_cierre ?? ''} className="campo" />
            <p className="mt-1 text-xs text-tinta-3">Después de esta fecha la vacante deja de mostrarse en la web.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-5">
          <label htmlFor="publicado" className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-tinta">
            <input id="publicado" name="publicado" type="checkbox" defaultChecked={e?.publicado ?? true} className="size-4 accent-(--color-marca)" />
            Publicada en la web
          </label>
          <BotonEnviar>{e ? 'Guardar cambios' : 'Crear vacante'}</BotonEnviar>
        </div>
      </FormAccion>

      {e && (
        <FormAccion accion={eliminarEmpleo} className="mt-5 flex justify-end">
          <input type="hidden" name="empresa" value={empresa.id} />
          <input type="hidden" name="id" value={e.id} />
          <BotonEnviar variante="peligro" pendiente="Eliminando…" confirmar="¿Eliminar esta vacante? No se puede deshacer.">
            Eliminar vacante
          </BotonEnviar>
        </FormAccion>
      )}
    </>
  );
}
