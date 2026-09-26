-- ============================================================
-- Ubigeo del domicilio del consumidor en el Libro de Reclamaciones.
-- El código es el del INEI; los nombres los fija el portal a partir
-- de su propia copia del ubigeo (no se aceptan los del navegador).
-- ============================================================

alter table public.reclamos
  add column ubigeo        text check (ubigeo is null or ubigeo ~ '^\d{6}$'),
  add column departamento  text,
  add column provincia     text,
  add column distrito      text;

comment on column public.reclamos.domicilio is 'Dirección (calle, número, urbanización).';
comment on column public.reclamos.ubigeo is 'Código INEI del distrito del domicilio.';
