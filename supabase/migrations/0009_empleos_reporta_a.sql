-- ============================================================
-- Vacantes: a quién reporta el puesto (según el MOF), p. ej.
-- «Jefe de Producción». Opcional; la web lo muestra junto al lugar
-- de trabajo.
-- ============================================================

alter table public.empleos
  add column reporta_a text;
