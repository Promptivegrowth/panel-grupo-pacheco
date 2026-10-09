-- ---------------------------------------------------------------
-- Se retira el registro de publicaciones
--
-- Nació para anotar quién pedía recompilar la web de Q-MEDICAL. Esa web pasó
-- a armar sus páginas al pedirlas y a releer el catálogo cada minuto, así que
-- ya no hay nada que publicar: lo que se guarda en el panel aparece solo.
-- ---------------------------------------------------------------
drop table if exists public.publicaciones;
