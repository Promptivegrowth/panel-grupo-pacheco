import { habilesRestantes } from '@/lib/reclamos/plazos';
import { Insignia } from '@/componentes/ui';

/** Estado del plazo legal de un reclamo, con color según la urgencia. */
export function PlazoInsignia({ vence, estado }: { vence: string; estado: string }) {
  if (estado === 'respondido') return <Insignia tono="ok">Respondido</Insignia>;
  const d = habilesRestantes(new Date(`${vence}T00:00:00Z`));
  if (d < 0) return <Insignia tono="peligro">Vencido ({-d} d)</Insignia>;
  if (d === 0) return <Insignia tono="peligro">Vence hoy</Insignia>;
  if (d <= 3) return <Insignia tono="peligro">{d} d hábiles</Insignia>;
  if (d <= 7) return <Insignia tono="aviso">{d} d hábiles</Insignia>;
  return <Insignia>{d} d hábiles</Insignia>;
}
