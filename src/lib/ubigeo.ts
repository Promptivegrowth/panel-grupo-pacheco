import 'server-only';
import datos from './ubigeo-peru.json';

/**
 * Ubigeo INEI (generado con scripts/ubigeo.py). El portal resuelve aquí los
 * nombres a partir del código: los que envía el navegador no se usan.
 */

type Arbol = [string, string, [string, string, [string, string][]][]][];

export type Ubicacion = { ubigeo: string; departamento: string; provincia: string; distrito: string };

const indice = new Map<string, Ubicacion>();
for (const [, departamento, provincias] of datos.d as Arbol) {
  for (const [, provincia, distritos] of provincias) {
    for (const [ubigeo, distrito] of distritos) {
      indice.set(ubigeo, { ubigeo, departamento, provincia, distrito });
    }
  }
}

export function resolverUbigeo(codigo: string): Ubicacion | null {
  return indice.get(codigo) ?? null;
}

/** «Miraflores, Lima, Lima» */
export const textoUbigeo = (u: Pick<Ubicacion, 'distrito' | 'provincia' | 'departamento'>) =>
  `${u.distrito}, ${u.provincia}, ${u.departamento}`;
