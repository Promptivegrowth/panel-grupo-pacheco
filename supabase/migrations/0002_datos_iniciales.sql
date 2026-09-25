-- ============================================================
-- Datos iniciales: las tres empresas, sus datos de contacto tal
-- como se publican hoy y tres vacantes de ejemplo para LP.
-- ============================================================

insert into public.empresas (id, nombre, razon_social, ruc, direccion, sitio_url, color, orden, origenes, correo_reclamos, correo_contacto) values
  ('lp', 'Laboratorios Pacheco', 'Laboratorios Pacheco S.A.C.', '20600937813',
   'Calle Gamma 274, Urb. Parque Internacional de Industria y Comercio, Callao',
   'https://www.laboratoriospacheco.com', '#8EBF45', 1,
   array['https://www.laboratoriospacheco.com', 'https://laboratoriospacheco.com',
         'http://localhost:5173', 'http://localhost:4173'],
   'administracion@laboratoriospacheco.com', 'gestioncomercial@laboratoriospacheco.com'),
  ('qmedical', 'Q-Medical', 'Q-MEDICAL S.A.C.', '20505719396',
   'Av. Arica N° 1442, Urb. Chacra Colorada, Breña, Lima',
   'https://qmedicalsac.com', '#1E5AA8', 2,
   array['https://qmedicalsac.com', 'https://www.qmedicalsac.com', 'http://localhost:4321'],
   'cotizaciones_licitaciones@qmedicalsac.com', 'cotizaciones_licitaciones@qmedicalsac.com'),
  ('woli', 'WOLI', 'World Logistics International S.A.C.', '20608160061',
   'Av. Venezuela 1684, Breña, Lima',
   'https://wlicargo.com', '#153F59', 3,
   array['https://wlicargo.com', 'https://www.wlicargo.com', 'http://localhost:4321'],
   'gerencia@wlicargo.com', 'gerencia@wlicargo.com');

-- ---------------------------------------------------------------
-- Laboratorios Pacheco
-- ---------------------------------------------------------------
insert into public.datos_contacto (empresa_id, tipo, etiqueta, valor, detalle, red, orden) values
  ('lp', 'whatsapp',  'WhatsApp',          '51942319378', 'Hola, quisiera cotizar un servicio de acondicionado.', null, 1),
  ('lp', 'telefono',  'Comercial',         '987984071', null, null, 1),
  ('lp', 'telefono',  'Marketing',         '942319378', null, null, 2),
  ('lp', 'telefono',  'Dirección Técnica', '940267318', null, null, 3),
  ('lp', 'telefono',  'Administración',    '989088149', null, null, 4),
  ('lp', 'correo',    'Comercial',         'gestioncomercial@laboratoriospacheco.com', null, null, 1),
  ('lp', 'correo',    'Marketing',         'marketing@laboratoriospacheco.com', null, null, 2),
  ('lp', 'correo',    'Dirección Técnica', 'aseguramientodelacalidad@laboratoriospacheco.com', null, null, 3),
  ('lp', 'correo',    'Administración',    'administracion@laboratoriospacheco.com', null, null, 4),
  ('lp', 'direccion', 'Planta y oficinas', 'Calle Gamma 274, Parque Internacional de Industria y Comercio, Callao',
   'https://www.google.com/maps/search/?api=1&query=Calle+Gamma+274+Parque+Internacional+de+Industria+y+Comercio+Callao', null, 1),
  ('lp', 'red', 'LinkedIn',  'https://www.linkedin.com/company/laboratorios-pacheco-s-a-c/', null, 'linkedin', 1),
  ('lp', 'red', 'Facebook',  'https://www.facebook.com/profile.php?id=61572439226741',     null, 'facebook', 2),
  ('lp', 'red', 'Instagram', 'https://www.instagram.com/labpacheco2023/',                   null, 'instagram', 3),
  ('lp', 'red', 'YouTube',   'https://www.youtube.com/@LABORATORIOSPACHECO',                null, 'youtube', 4),
  ('lp', 'red', 'TikTok',    'https://www.tiktok.com/@laboratoriospacheco',                 null, 'tiktok', 5);

-- ---------------------------------------------------------------
-- Q-Medical
-- ---------------------------------------------------------------
insert into public.datos_contacto (empresa_id, tipo, etiqueta, valor, valor_en, detalle, red, orden) values
  ('qmedical', 'whatsapp',  'WhatsApp', '51977814006', null,
   'Hola, Q-MEDICAL. Escribo desde su página web y quisiera información sobre sus dispositivos médicos y productos de bioseguridad.', null, 1),
  ('qmedical', 'telefono',  'Central',  '014247290', null, null, null, 1),
  ('qmedical', 'correo',    'Cotizaciones y licitaciones', 'cotizaciones_licitaciones@qmedicalsac.com', null, null, null, 1),
  ('qmedical', 'direccion', 'Oficina',  'Av. Arica N° 1442, Urb. Chacra Colorada, Breña, Lima — Perú', null, null, null, 1),
  ('qmedical', 'horario',   'Horario',  'Lunes a viernes, 8:00 a. m. – 6:00 p. m.', 'Monday to Friday, 8:00 a.m. – 6:00 p.m.', null, null, 1),
  ('qmedical', 'red', 'Instagram', 'https://www.instagram.com/qmedicalperu/', null, null, 'instagram', 1),
  ('qmedical', 'red', 'Facebook',  'https://www.facebook.com/Drogueria.QMedicalsac', null, null, 'facebook', 2),
  ('qmedical', 'red', 'LinkedIn',  'https://www.linkedin.com/company/q-medical-s-a-c/', null, null, 'linkedin', 3),
  ('qmedical', 'red', 'YouTube',   'https://www.youtube.com/channel/UCFh2U0cEywVbI2dtXEfIbtw', null, null, 'youtube', 4);

-- ---------------------------------------------------------------
-- WOLI · World Logistics International
-- (las redes publicadas hoy son enlaces genéricos: se cargan igual
--  para no cambiar nada y quedan marcadas para que se corrijan)
-- ---------------------------------------------------------------
insert into public.datos_contacto (empresa_id, tipo, etiqueta, valor, valor_en, detalle, red, orden) values
  ('woli', 'whatsapp',  'WhatsApp', '51912507555', null, 'Hola WOLI / Hello WOLI', null, 1),
  ('woli', 'telefono',  'Central',  '912507555', null, null, null, 1),
  ('woli', 'correo',    'Gerencia', 'gerencia@wlicargo.com', null, null, null, 1),
  ('woli', 'direccion', 'Oficina',  'Av. Venezuela 1684, Breña — Lima, Perú', null,
   'https://maps.google.com/?q=Av.+Venezuela+1684+Breña+Lima+Perú', null, 1),
  ('woli', 'horario',   'Horario',  'Lunes a viernes · 9:00 – 18:00 h', 'Monday to Friday · 9:00 – 18:00', null, null, 1),
  ('woli', 'red', 'LinkedIn',  'https://www.linkedin.com',  null, null, 'linkedin', 1),
  ('woli', 'red', 'Facebook',  'https://www.facebook.com',  null, null, 'facebook', 2),
  ('woli', 'red', 'Instagram', 'https://www.instagram.com', null, null, 'instagram', 3);

-- ---------------------------------------------------------------
-- Trabaja con nosotros · tres vacantes de ejemplo (LP)
-- ---------------------------------------------------------------
insert into public.empleos (empresa_id, titulo, area, ubicacion, modalidad, jornada, resumen, requisitos, funciones, beneficios, correo_postulacion, orden) values
  ('lp', 'Operario(a) de acondicionado', 'Producción', 'Callao', 'Presencial', 'Tiempo completo',
   'Buscamos operarios para el acondicionado y reacondicionado de productos farmacéuticos en nuestra planta certificada BPM.',
   array['Secundaria completa.',
         'Experiencia mínima de 6 meses en acondicionado o producción farmacéutica (deseable).',
         'Atención al detalle y disposición para el trabajo en equipo.',
         'Disponibilidad para laborar en Callao.'],
   array['Etiquetado, rotulado y armado de kits según la orden de producción.',
         'Registro de actividades en los formatos de Buenas Prácticas de Manufactura.',
         'Orden y limpieza del área de trabajo.'],
   array['Planilla con todos los beneficios de ley.',
         'Capacitación continua en BPM.',
         'Estabilidad laboral.'],
   'administracion@laboratoriospacheco.com', 1),
  ('lp', 'Químico(a) farmacéutico(a) de Aseguramiento de la Calidad', 'Aseguramiento de la Calidad', 'Callao', 'Presencial', 'Tiempo completo',
   'Incorporamos un químico farmacéutico para reforzar el área de Aseguramiento de la Calidad y la liberación de lotes.',
   array['Título de químico farmacéutico, colegiado y habilitado.',
         'Experiencia mínima de 2 años en aseguramiento de la calidad en laboratorio o droguería.',
         'Conocimiento de BPM, BPA y normativa de DIGEMID.',
         'Manejo de Office a nivel intermedio.'],
   array['Revisión de expedientes de lote y liberación de producto terminado.',
         'Gestión de desviaciones, acciones correctivas y control de cambios.',
         'Participación en inspecciones de DIGEMID y auditorías de clientes.'],
   array['Planilla con todos los beneficios de ley.',
         'Línea de carrera dentro del área técnica.'],
   'administracion@laboratoriospacheco.com', 2),
  ('lp', 'Auxiliar de almacén', 'Almacén', 'Callao', 'Presencial', 'Tiempo completo',
   'Buscamos un auxiliar de almacén para la recepción, control y despacho de productos farmacéuticos.',
   array['Secundaria completa.',
         'Experiencia mínima de 1 año en almacén, de preferencia con productos farmacéuticos.',
         'Conocimiento de inventarios y kárdex.',
         'Manejo básico de Excel.'],
   array['Recepción, ubicación y despacho de mercadería.',
         'Control de inventarios y registro de temperaturas.',
         'Registro en sistema y en los formatos de Buenas Prácticas de Almacenamiento.'],
   array['Planilla con todos los beneficios de ley.',
         'Capacitación en BPA.'],
   'administracion@laboratoriospacheco.com', 3);
