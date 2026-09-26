-- ============================================================
-- Q-Medical publica un directorio de correos por área y su libro de
-- reclamaciones avisa a Dirección Técnica. Además, las etiquetas de
-- área necesitan traducción en las webs bilingües.
-- ============================================================

alter table public.datos_contacto add column etiqueta_en text;

update public.empresas
set correo_reclamos = 'direccion_tecnica@qmedicalsac.com'
where id = 'qmedical';

update public.datos_contacto
set etiqueta_en = 'Quotations and tenders'
where empresa_id = 'qmedical' and tipo = 'correo' and valor = 'cotizaciones_licitaciones@qmedicalsac.com';

insert into public.datos_contacto (empresa_id, tipo, etiqueta, etiqueta_en, valor, orden) values
  ('qmedical', 'correo', 'Dirección técnica', 'Technical direction', 'direccion_tecnica@qmedicalsac.com', 2),
  ('qmedical', 'correo', 'Importaciones',     'Imports',             'importaciones@qmedicalsac.com',     3),
  ('qmedical', 'correo', 'Marketing',         'Marketing',           'marketing@qmedicalsac.com',         4),
  ('qmedical', 'correo', 'Facturación',       'Invoicing',           'psantillan@qmedicalsac.com',        5),
  ('qmedical', 'correo', 'Cobranzas',         'Accounts receivable', 'finanzas@qmedicalsac.com',          6);
