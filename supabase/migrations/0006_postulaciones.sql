-- ============================================================
-- Postulaciones a las vacantes de «Trabaja con nosotros».
--
-- Llegan desde la web por la API del portal (clave de servicio), con el
-- CV en el bucket privado `postulaciones`. Las gestionan los roles
-- maestro y empleos de la empresa.
-- ============================================================

create table public.postulaciones (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        text not null references public.empresas (id) on delete cascade,
  -- La vacante puede borrarse después: el título queda copiado en `puesto`.
  empleo_id         uuid references public.empleos (id) on delete set null,
  puesto            text not null,
  area_interes      text,
  nombre            text not null,
  tipo_documento    text not null check (tipo_documento in ('DNI', 'CE', 'Pasaporte')),
  numero_documento  text not null,
  correo            text not null,
  telefono          text not null,
  ubigeo            text,
  departamento      text,
  provincia         text,
  distrito          text,
  estudios          text not null,
  carrera           text,
  experiencia       text not null,
  experiencia_bpm   boolean not null default false,
  disponibilidad    text not null,
  pretension        numeric(12, 2),
  linkedin          text,
  presentacion      text,
  cv_path           text,
  cv_nombre         text,
  estado            text not null default 'nueva'
                      check (estado in ('nueva', 'revisada', 'preseleccionada', 'descartada')),
  notas             text,
  correo_aviso      timestamptz,
  correo_acuse      timestamptz,
  correo_error      text,
  ip_hash           text,
  creado            timestamptz not null default now(),
  actualizado       timestamptz not null default now(),
  actualizado_por   uuid references auth.users (id) on delete set null
);

create index postulaciones_empresa on public.postulaciones (empresa_id, creado desc);
create index postulaciones_empleo on public.postulaciones (empleo_id);
create index postulaciones_ip on public.postulaciones (ip_hash, creado);

create trigger postulaciones_actualizado before update on public.postulaciones
  for each row execute function public.marcar_actualizado();

alter table public.postulaciones enable row level security;

-- Solo lectura, cambio de estado/notas y borrado desde el portal. El alta
-- es exclusiva de la API (clave de servicio), así que no hay política de insert.
create policy postulaciones_lee on public.postulaciones
  for select to authenticated
  using (public.tiene_rol(empresa_id, '{maestro,empleos}'));

create policy postulaciones_edita on public.postulaciones
  for update to authenticated
  using (public.tiene_rol(empresa_id, '{maestro,empleos}'))
  with check (public.tiene_rol(empresa_id, '{maestro,empleos}'));

create policy postulaciones_borra on public.postulaciones
  for delete to authenticated
  using (public.tiene_rol(empresa_id, '{maestro,empleos}'));

-- CV: PDF o Word, hasta 4 MB (el límite de cuerpo de las funciones de
-- Vercel es 4,5 MB). Ruta: {empresa}/{año}/{id}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'postulaciones', 'postulaciones', false, 4194304,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
);

create policy postulaciones_cv_lee on storage.objects
  for select to authenticated
  using (bucket_id = 'postulaciones' and public.tiene_rol(split_part(name, '/', 1), '{maestro,empleos}'));

create policy postulaciones_cv_borra on storage.objects
  for delete to authenticated
  using (bucket_id = 'postulaciones' and public.tiene_rol(split_part(name, '/', 1), '{maestro,empleos}'));
