-- ---------------------------------------------------------------
-- Las postulaciones pueden avisar a más de una persona
-- ---------------------------------------------------------------
--
-- Q-MEDICAL pidió que las postulaciones lleguen a recursos humanos y a
-- subgerencia, y hasta ahora el aviso tenía un solo destinatario: el de la
-- vacante, o el correo de contacto de la empresa cuando la postulación es
-- espontánea.
--
-- Dos cambios, los dos pequeños:
--
--   · `empleos.correo_postulacion` admite varias direcciones separadas por
--     coma. No hace falta tocar el tipo de la columna; lo que cambia es que
--     el código las separa antes de enviar y el panel deja escribirlas.
--
--   · `empresas.correo_postulaciones` es el destino de las espontáneas, que
--     no cuelgan de ninguna vacante. Antes caían en el correo de contacto
--     —el comercial—, que no es quien revisa currículos. Donde quede en
--     nulo se sigue usando aquel, de modo que las otras empresas del portal
--     no cambian de comportamiento.

alter table public.empresas
  add column if not exists correo_postulaciones text;

comment on column public.empresas.correo_postulaciones is
  'Destino de las postulaciones espontáneas. Admite varias direcciones separadas por coma. En nulo se usa correo_contacto.';

comment on column public.empleos.correo_postulacion is
  'Destino del aviso de esta vacante. Admite varias direcciones separadas por coma.';

update public.empresas
   set correo_postulaciones = 'recursoshumanos@qmedicalsac.com, subgerencia@qmedicalsac.com'
 where id = 'qmedical';

update public.empleos
   set correo_postulacion = 'recursoshumanos@qmedicalsac.com, subgerencia@qmedicalsac.com'
 where empresa_id = 'qmedical';
