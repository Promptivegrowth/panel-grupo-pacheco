-- ============================================================
-- Archivos adjuntos en los mensajes (solicitudes de cotización).
--
-- La web los envía con el formulario; la API del portal los valida y
-- los guarda en el bucket privado `mensajes`. Cada mensaje lista los
-- suyos en `adjuntos`: [{ "ruta", "nombre", "tipo", "tamano" }].
-- Los ve y los borra el rol maestro de la empresa, como los mensajes.
-- ============================================================

alter table public.mensajes
  add column adjuntos jsonb not null default '[]';

-- Hasta 4 MB en total por envío (límite de cuerpo de las funciones de
-- Vercel: 4,5 MB); cada archivo, como máximo 4 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mensajes', 'mensajes', false, 4194304,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
);

-- Ruta: {empresa}/{año}/{id del mensaje}/{archivo}
create policy mensajes_adjuntos_lee on storage.objects
  for select to authenticated
  using (bucket_id = 'mensajes' and public.tiene_rol(split_part(name, '/', 1), '{maestro}'));

create policy mensajes_adjuntos_borra on storage.objects
  for delete to authenticated
  using (bucket_id = 'mensajes' and public.tiene_rol(split_part(name, '/', 1), '{maestro}'));
