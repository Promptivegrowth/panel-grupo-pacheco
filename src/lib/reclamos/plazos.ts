/**
 * Plazo de respuesta del Libro de Reclamaciones: quince (15) días hábiles
 * improrrogables desde el registro (D.S. 011-2011-PCM, modificado por el
 * D.S. 101-2022-PCM).
 *
 * Días hábiles = de lunes a viernes, sin feriados nacionales. Los feriados
 * que el Gobierno declare de forma extraordinaria (días no laborables
 * sueltos) no se pueden prever: la fecha que da el panel es una referencia
 * y conviene responder con margen.
 */

export const DIAS_HABILES_RESPUESTA = 15;

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
function pascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

const clave = (d: Date) => d.toISOString().slice(0, 10);

const cacheFeriados = new Map<number, Set<string>>();

/** Feriados nacionales del Perú (Ley 31773 y normas anteriores). */
export function feriados(anio: number): Set<string> {
  const guardado = cacheFeriados.get(anio);
  if (guardado) return guardado;

  const fijos = [
    '01-01', // Año Nuevo
    '05-01', // Día del Trabajo
    '06-07', // Batalla de Arica y Día de la Bandera
    '06-29', // San Pedro y San Pablo
    '07-23', // Día de la Fuerza Aérea
    '07-28', // Fiestas Patrias
    '07-29', // Fiestas Patrias
    '08-06', // Batalla de Junín
    '08-30', // Santa Rosa de Lima
    '10-08', // Combate de Angamos
    '11-01', // Todos los Santos
    '12-08', // Inmaculada Concepción
    '12-09', // Batalla de Ayacucho
    '12-25', // Navidad
  ].map((md) => `${anio}-${md}`);

  const domingo = pascua(anio);
  const jueves = new Date(domingo.getTime() - 3 * 86_400_000);
  const viernes = new Date(domingo.getTime() - 2 * 86_400_000);

  const lista = new Set([...fijos, clave(jueves), clave(viernes)]);
  cacheFeriados.set(anio, lista);
  return lista;
}

export function esHabil(d: Date): boolean {
  const dia = d.getUTCDay();
  if (dia === 0 || dia === 6) return false;
  return !feriados(d.getUTCFullYear()).has(clave(d));
}

/** Fecha en Lima (UTC−5, sin horario de verano) como fecha UTC a medianoche. */
export function fechaLima(instante: Date = new Date()): Date {
  const lima = new Date(instante.getTime() - 5 * 3_600_000);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()));
}

/** Suma `n` días hábiles a partir del día siguiente a `desde`. */
export function sumarHabiles(desde: Date, n: number = DIAS_HABILES_RESPUESTA): Date {
  const d = new Date(desde.getTime());
  let contados = 0;
  while (contados < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esHabil(d)) contados++;
  }
  return d;
}

/** Días hábiles que faltan hasta `vence` (negativo si ya pasó). */
export function habilesRestantes(vence: Date, hoy: Date = fechaLima()): number {
  if (clave(vence) === clave(hoy)) return 0;
  const signo = vence > hoy ? 1 : -1;
  const d = new Date(hoy.getTime());
  let n = 0;
  while (clave(d) !== clave(vence)) {
    d.setUTCDate(d.getUTCDate() + signo);
    if (esHabil(d)) n += signo;
  }
  return n;
}

export const aISO = clave;
