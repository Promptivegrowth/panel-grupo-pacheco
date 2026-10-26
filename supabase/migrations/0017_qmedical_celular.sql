-- ---------------------------------------------------------------
-- Q-MEDICAL: el celular, también en «Datos de la web»
-- ---------------------------------------------------------------
--
-- La web de Q-MEDICAL pasa a armar sus datos de contacto con lo que hay en
-- el portal. El pie muestra, además de la central, el celular 977 814 006
-- —la empresa lo pidió en sus observaciones—, pero en el portal solo estaba
-- la central: sin esta fila, el celular desaparecería de la web al conectar
-- los datos. Queda editable como cualquier otro teléfono.

insert into public.datos_contacto (empresa_id, tipo, etiqueta, etiqueta_en, valor, orden, visible)
select 'qmedical', 'telefono', 'Celular', 'Mobile', '977814006', 2, true
 where not exists (
   select 1 from public.datos_contacto
    where empresa_id = 'qmedical' and tipo = 'telefono'
      and regexp_replace(valor, '\D', '', 'g') in ('977814006', '51977814006')
 );
