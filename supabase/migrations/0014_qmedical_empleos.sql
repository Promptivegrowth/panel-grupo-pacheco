-- ---------------------------------------------------------------
-- Q-MEDICAL: «Trabaja con nosotros» y el origen del despliegue
-- ---------------------------------------------------------------

-- El despliegue de la web vive hoy en qmedical.vercel.app, porque el dominio
-- todavía apunta al hosting anterior. Sin ese origen registrado, el navegador
-- bloquea por CORS todo lo que la web envía al portal: contacto, cotización,
-- el Libro de Reclamaciones y, desde ahora, las postulaciones. Se deja junto
-- al dominio definitivo, que seguirá sirviendo cuando el dominio se mude.
update public.empresas
   set origenes = array(
     select distinct unnest(origenes || array['https://qmedical.vercel.app'])
   )
 where id = 'qmedical';

-- Dos vacantes de ejemplo, para que la empresa vea la pantalla con contenido
-- y pueda editarlas o borrarlas desde el panel. Salen de áreas que la propia
-- droguería tiene: almacén certificado BPA y la atención a instituciones.
insert into public.empleos
  (empresa_id, titulo, area, ubicacion, modalidad, jornada, resumen, reporta_a,
   funciones, requisitos, beneficios, correo_postulacion, publicado, orden)
values
  ('qmedical',
   'Químico(a) farmacéutico(a) — Dirección Técnica',
   'Dirección Técnica',
   'Breña, Lima',
   'Presencial',
   'Tiempo completo',
   'Buscamos un químico farmacéutico para la Dirección Técnica de la droguería: '
   'liberación de lotes, control de la documentación sanitaria y acompañamiento '
   'en las inspecciones de DIGEMID.',
   'Gerencia General',
   array[
     'Liberar los lotes recibidos y verificar su documentación sanitaria.',
     'Mantener vigente el registro sanitario de los productos que se comercializan.',
     'Supervisar el cumplimiento de las Buenas Prácticas de Almacenamiento (BPA).',
     'Atender las inspecciones de DIGEMID y las auditorías de clientes institucionales.',
     'Capacitar al personal de almacén en el manejo de dispositivos médicos.'
   ],
   array[
     'Título de químico(a) farmacéutico(a), colegiado y habilitado.',
     'Experiencia mínima de 2 años como director técnico en droguería o laboratorio.',
     'Conocimiento de la normativa de DIGEMID y de las BPA.',
     'Manejo de Office a nivel intermedio.'
   ],
   array[
     'Planilla con todos los beneficios de ley.',
     'Capacitación continua en normativa sanitaria.',
     'Estabilidad laboral en una empresa con 23 años en el mercado.'
   ],
   'cotizaciones_licitaciones@qmedicalsac.com',
   true, 1),

  ('qmedical',
   'Ejecutivo(a) comercial de licitaciones',
   'Comercial',
   'Breña, Lima',
   'Híbrido',
   'Tiempo completo',
   'Incorporamos un ejecutivo comercial para atender licitaciones públicas y '
   'compras corporativas de hospitales, clínicas y laboratorios.',
   'Jefatura Comercial',
   array[
     'Revisar las convocatorias del SEACE y preparar las propuestas técnicas y económicas.',
     'Elaborar cotizaciones con la documentación sanitaria que exige cada expediente.',
     'Dar seguimiento a las órdenes de compra y coordinar las entregas con almacén.',
     'Mantener la relación con las áreas de logística de las instituciones atendidas.'
   ],
   array[
     'Formación en administración, negocios internacionales o carreras afines.',
     'Experiencia mínima de 1 año en licitaciones públicas o ventas institucionales.',
     'Conocimiento del SEACE y de la documentación de dispositivos médicos.',
     'Manejo de Excel a nivel intermedio.'
   ],
   array[
     'Planilla con todos los beneficios de ley.',
     'Esquema híbrido de trabajo.',
     'Comisiones por cumplimiento de metas.'
   ],
   'cotizaciones_licitaciones@qmedicalsac.com',
   true, 2);
