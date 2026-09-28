-- ============================================================
-- Una vacante con postulaciones no se puede eliminar: primero se
-- borran sus postulaciones (y sus CV) desde el portal. Antes la
-- vacante se borraba y las postulaciones quedaban sin vacante.
-- ============================================================

alter table public.postulaciones
  drop constraint postulaciones_empleo_id_fkey,
  add constraint postulaciones_empleo_id_fkey
    foreign key (empleo_id) references public.empleos (id) on delete restrict;
