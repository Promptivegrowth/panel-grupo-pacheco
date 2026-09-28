/**
 * Identidad de cada empresa en el portal. Los datos legales (razón social,
 * RUC, dirección, correos de aviso) viven en la tabla `empresas`; aquí solo
 * lo que necesita la interfaz y que no cambia desde el panel.
 */

export type Modulo = 'reclamos' | 'mensajes' | 'sitio' | 'empleos' | 'postulaciones';

export type EmpresaUI = {
  id: 'lp' | 'qmedical' | 'woli';
  nombre: string;
  descripcion: string;
  logo: string;
  /** Fondo del logo. WOLI usa su versión blanca sobre su azul corporativo. */
  logoFondo: string;
  color: string;
  /** Prefijo del código de las hojas de reclamación. */
  prefijo: string;
  /** La web tiene versión en inglés: algunos textos llevan traducción. */
  bilingue: boolean;
  modulos: Modulo[];
};

export const EMPRESAS: Record<EmpresaUI['id'], EmpresaUI> = {
  lp: {
    id: 'lp',
    nombre: 'Laboratorios Pacheco',
    descripcion: 'Acondicionado, reacondicionado y fraccionamiento',
    logo: '/marcas/lp.png',
    logoFondo: '#ffffff',
    color: '#6d9633',
    prefijo: 'LP',
    bilingue: false,
    modulos: ['reclamos', 'mensajes', 'sitio', 'empleos', 'postulaciones'],
  },
  qmedical: {
    id: 'qmedical',
    nombre: 'Q-Medical',
    descripcion: 'Droguería de dispositivos médicos y bioseguridad',
    logo: '/marcas/qmedical.png',
    logoFondo: '#ffffff',
    color: '#152e7f',
    prefijo: 'QM',
    bilingue: true,
    modulos: ['reclamos', 'mensajes', 'sitio'],
  },
  woli: {
    id: 'woli',
    nombre: 'WOLI',
    descripcion: 'World Logistics International',
    logo: '/marcas/woli.png',
    logoFondo: '#153f59',
    color: '#153f59',
    prefijo: 'WO',
    bilingue: true,
    modulos: ['reclamos', 'mensajes', 'sitio'],
  },
};

export const LISTA_EMPRESAS = Object.values(EMPRESAS);

export function empresaUI(id: string): EmpresaUI | null {
  return id in EMPRESAS ? EMPRESAS[id as EmpresaUI['id']] : null;
}

export type Rol = 'maestro' | 'empleos';

/** Qué módulos ve cada rol (además de los que tenga activos la empresa). */
export function modulosPara(empresa: EmpresaUI, rol: Rol): Modulo[] {
  if (rol === 'maestro') return empresa.modulos;
  return empresa.modulos.filter((m) => m === 'empleos' || m === 'postulaciones');
}

export const NOMBRE_MODULO: Record<Modulo, string> = {
  reclamos: 'Libro de reclamaciones',
  mensajes: 'Mensajes de contacto',
  sitio: 'Datos de la web',
  empleos: 'Trabaja con nosotros',
  postulaciones: 'Postulaciones',
};
