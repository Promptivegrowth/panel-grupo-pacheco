/**
 * Nombres legibles de los campos propios de cada web que llegan en
 * `mensajes.datos`. Los usan el detalle del mensaje y el correo de aviso;
 * una clave sin nombre aquí se muestra tal cual.
 */
export const ETIQUETAS_DATOS: Record<string, string> = {
  ruc: 'RUC',
  tipo_producto: 'Tipo de producto',
  cantidad: 'Cantidad aproximada',
  fecha_requerida: 'Fecha requerida del servicio',
  modalidad: 'Modalidad',
  origen: 'Origen',
  destino: 'Destino',
  carga: 'Tipo de carga',
  peso: 'Peso / volumen',
  incoterm: 'Incoterm',
  institucion: 'Institución',
  cargo: 'Cargo',
};

/** «2026-10-15» → «15 oct. 2026»; el resto de valores, sin cambios. */
export function valorDato(clave: string, valor: string): string {
  if (clave.startsWith('fecha') && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${valor}T00:00:00Z`),
    );
  }
  return valor;
}

export const etiquetaDato = (clave: string) => ETIQUETAS_DATOS[clave] ?? clave;
