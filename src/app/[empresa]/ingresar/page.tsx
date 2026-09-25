import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { empresaUI } from '@/lib/empresas';
import { rolEn } from '@/lib/sesion';
import { FormAccion, BotonEnviar } from '@/componentes/formulario';
import { Aviso } from '@/componentes/ui';
import { ingresar } from './acciones';

export async function generateMetadata({ params }: { params: Promise<{ empresa: string }> }) {
  const e = empresaUI((await params).empresa);
  return { title: e ? `Ingresar · ${e.nombre}` : 'Ingresar' };
}

export default async function Ingresar({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const empresa = empresaUI((await params).empresa);
  if (!empresa) notFound();

  // Si ya tiene sesión y acceso, directo al panel.
  if (await rolEn(empresa.id)) redirect(`/${empresa.id}`);

  const { error } = await searchParams;

  return (
    <main
      className="flex min-h-dvh items-center justify-center px-5 py-12"
      style={{ '--marca': empresa.color } as React.CSSProperties}
    >
      <div className="w-full max-w-sm">
        <div className="caja overflow-hidden">
          <div className="grid h-32 place-items-center px-10" style={{ background: empresa.logoFondo }}>
            <Image src={empresa.logo} alt={empresa.nombre} width={220} height={90} className="max-h-16 w-auto object-contain" priority />
          </div>
          <div className="h-1 bg-marca" aria-hidden />

          <div className="px-6 pb-6 pt-5">
            <h1 className="text-lg font-bold text-tinta">Ingresar a {empresa.nombre}</h1>
            <p className="mt-0.5 text-sm text-tinta-3">Portal administrativo del Grupo Pacheco</p>

            {error === 'sin-acceso' && (
              <div className="mt-4">
                <Aviso tono="aviso">Su usuario no tiene acceso a esta empresa.</Aviso>
              </div>
            )}

            <FormAccion accion={ingresar} className="mt-5 space-y-4">
              <input type="hidden" name="empresa" value={empresa.id} />
              <div>
                <label htmlFor="correo" className="etiqueta">
                  Correo
                </label>
                <input id="correo" name="correo" type="email" autoComplete="username" required className="campo" />
              </div>
              <div>
                <label htmlFor="clave" className="etiqueta">
                  Contraseña
                </label>
                <input id="clave" name="clave" type="password" autoComplete="current-password" required className="campo" />
              </div>
              <BotonEnviar pendiente="Verificando…" className="w-full py-2.5">
                Ingresar
              </BotonEnviar>
            </FormAccion>
          </div>
        </div>

        <p className="mt-5 text-center text-sm">
          <Link href="/" className="font-medium text-tinta-3 hover:text-tinta">
            ← Cambiar de empresa
          </Link>
        </p>
      </div>
    </main>
  );
}
