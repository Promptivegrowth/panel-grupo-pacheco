-- ============================================================
-- Portal administrativo · Grupo Pacheco
-- Esquema, permisos (RLS) y almacenamiento.
--
-- Una sola base para las tres webs del grupo: cada fila lleva la
-- empresa a la que pertenece y los permisos se resuelven por
-- empresa y rol.
--
--   maestro  → todo en las empresas asignadas (reclamos, mensajes,
--              datos de contacto y empleos).
--   empleos  → solo publicaciones de «Trabaja con nosotros».
--
-- Las webs públicas leen con la clave publicable (rol anon) y solo
-- ven lo publicado. Los formularios NO escriben directamente: pasan
-- por la API del portal, que valida, numera, genera el PDF y usa la
-- clave de servicio.
-- ============================================================

-- ---------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------
create table public.empresas (
  id               text primary key,          -- 'lp' | 'qmedical' | 'woli'
  nombre           text not null,              -- nombre comercial
  razon_social     text not null,
  ruc              text not null,
  direccion        text not null,              -- domicilio del establecimiento
  sitio_url        text not null,
  color            text not null,              -- color de marca en el portal
  orden            int  not null default 0,
  -- Orígenes desde los que la web puede enviar formularios (CORS).
  origenes         text[] not null default '{}',
  -- Destinos internos de los avisos.
  correo_reclamos  text,
  correo_contacto  text,
  creado           timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Miembros: quién entra al portal, a qué empresa y con qué rol
-- ---------------------------------------------------------------
create type public.rol_portal as enum ('maestro', 'empleos');

create table public.miembros (
  user_id     uuid not null references auth.users (id) on delete cascade,
  empresa_id  text not null references public.empresas (id) on delete cascade,
  rol         public.rol_portal not null,
  creado      timestamptz not null default now(),
  primary key (user_id, empresa_id)
);

-- ¿El usuario actual tiene alguno de estos roles en la empresa?
-- security definer: consulta miembros sin depender de su propia RLS.
create function public.tiene_rol(p_empresa text, p_roles public.rol_portal[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.miembros m
    where m.user_id = auth.uid()
      and m.empresa_id = p_empresa
      and m.rol = any (p_roles)
  );
$$;

revoke all on function public.tiene_rol(text, public.rol_portal[]) from public;
grant execute on function public.tiene_rol(text, public.rol_portal[]) to authenticated;

-- ---------------------------------------------------------------
-- Datos de contacto editables de cada web
-- (WhatsApp, teléfonos, correos, dirección, horario, redes)
-- ---------------------------------------------------------------
create table public.datos_contacto (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       text not null references public.empresas (id) on delete cascade,
  tipo             text not null check (tipo in ('whatsapp', 'telefono', 'correo', 'direccion', 'horario', 'red')),
  etiqueta         text not null default '',   -- «Comercial», «Planta», …
  valor            text not null,              -- número, correo, texto o URL
  valor_en         text,                       -- versión en inglés (webs bilingües)
  detalle          text,                       -- mensaje de WhatsApp, enlace de mapa…
  red              text check (red is null or red in ('linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'x')),
  orden            int  not null default 0,
  visible          boolean not null default true,
  actualizado      timestamptz not null default now(),
  actualizado_por  uuid references auth.users (id) on delete set null,
  check (tipo <> 'red' or red is not null)
);

create index datos_contacto_empresa on public.datos_contacto (empresa_id, tipo, orden);

-- ---------------------------------------------------------------
-- Mensajes del formulario de contacto / cotización
-- ---------------------------------------------------------------
create table public.mensajes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   text not null references public.empresas (id) on delete cascade,
  creado       timestamptz not null default now(),
  tipo         text not null default 'contacto' check (tipo in ('contacto', 'cotizacion')),
  nombre       text not null,
  empresa      text,
  correo       text,
  telefono     text,
  asunto       text,                           -- servicio de interés
  mensaje      text,
  datos        jsonb not null default '{}',    -- campos propios de cada web
  pagina       text,
  leido        boolean not null default false,
  archivado    boolean not null default false,
  ip_hash      text
);

create index mensajes_empresa on public.mensajes (empresa_id, creado desc);

-- ---------------------------------------------------------------
-- Libro de reclamaciones (D.S. 011-2011-PCM y modificatorias)
-- ---------------------------------------------------------------
create table public.contadores_reclamos (
  empresa_id  text not null references public.empresas (id) on delete cascade,
  anio        int  not null,
  ultimo      int  not null default 0,
  primary key (empresa_id, anio)
);

-- Correlativo atómico por empresa y año. Solo lo usa la API (service_role).
create function public.siguiente_correlativo(p_empresa text, p_anio int)
returns int
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.contadores_reclamos as c (empresa_id, anio, ultimo)
  values (p_empresa, p_anio, 1)
  on conflict (empresa_id, anio) do update set ultimo = c.ultimo + 1
  returning ultimo;
$$;

revoke all on function public.siguiente_correlativo(text, int) from public, anon, authenticated;

create table public.reclamos (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           text not null references public.empresas (id) on delete restrict,
  anio                 int  not null,
  correlativo          int  not null,
  codigo               text not null unique,     -- p. ej. 000001-2026
  creado               timestamptz not null default now(),
  tipo                 text not null check (tipo in ('reclamo', 'queja')),
  -- 1. Consumidor reclamante
  nombre               text not null,
  tipo_documento       text not null check (tipo_documento in ('DNI', 'CE', 'Pasaporte', 'RUC')),
  numero_documento     text not null,
  domicilio            text,
  telefono             text,
  correo               text not null,
  menor_edad           boolean not null default false,
  apoderado            text,
  -- 2. Bien contratado
  bien_tipo            text not null check (bien_tipo in ('producto', 'servicio')),
  monto                numeric(12, 2),
  bien_descripcion     text not null,
  -- 3. Detalle
  detalle              text not null,
  pedido               text not null,
  -- 4. Proveedor
  estado               text not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'respondido')),
  vence                date not null,            -- 15 días hábiles
  respuesta            text,
  respondido           timestamptz,
  respondido_por       uuid references auth.users (id) on delete set null,
  -- Documentos y avisos
  pdf_path             text,
  correo_constancia    timestamptz,              -- constancia enviada al consumidor
  correo_aviso         timestamptz,              -- aviso interno enviado
  correo_respuesta     timestamptz,              -- respuesta enviada al consumidor
  correo_error         text,
  ip_hash              text,
  unique (empresa_id, anio, correlativo)
);

create index reclamos_empresa on public.reclamos (empresa_id, creado desc);

-- ---------------------------------------------------------------
-- Trabaja con nosotros
-- ---------------------------------------------------------------
create table public.empleos (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         text not null references public.empresas (id) on delete cascade,
  titulo             text not null,
  area               text,
  ubicacion          text,
  modalidad          text not null default 'Presencial' check (modalidad in ('Presencial', 'Híbrido', 'Remoto')),
  jornada            text not null default 'Tiempo completo' check (jornada in ('Tiempo completo', 'Medio tiempo', 'Por turnos', 'Prácticas')),
  resumen            text not null,
  requisitos         text[] not null default '{}',
  funciones          text[] not null default '{}',
  beneficios         text[] not null default '{}',
  correo_postulacion text not null,
  publicado          boolean not null default true,
  fecha_publicacion  date not null default current_date,
  fecha_cierre       date,
  orden              int  not null default 0,
  creado             timestamptz not null default now(),
  actualizado        timestamptz not null default now(),
  actualizado_por    uuid references auth.users (id) on delete set null
);

create index empleos_empresa on public.empleos (empresa_id, publicado, orden);

-- ---------------------------------------------------------------
-- Marca de actualización automática
-- ---------------------------------------------------------------
create function public.marcar_actualizado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

create trigger datos_contacto_actualizado before update on public.datos_contacto
  for each row execute function public.marcar_actualizado();
create trigger empleos_actualizado before update on public.empleos
  for each row execute function public.marcar_actualizado();

-- ============================================================
-- RLS
-- ============================================================
alter table public.empresas            enable row level security;
alter table public.miembros            enable row level security;
alter table public.datos_contacto      enable row level security;
alter table public.mensajes            enable row level security;
alter table public.contadores_reclamos enable row level security;
alter table public.reclamos            enable row level security;
alter table public.empleos             enable row level security;

-- Empresas: datos institucionales públicos (el portal los muestra antes del login).
create policy empresas_lectura on public.empresas
  for select to anon, authenticated using (true);

-- Miembros: cada usuario ve solo sus propias filas.
create policy miembros_propios on public.miembros
  for select to authenticated using (user_id = auth.uid());

-- Datos de contacto: la web lee lo visible; el maestro gestiona.
create policy datos_contacto_publico on public.datos_contacto
  for select to anon using (visible);
create policy datos_contacto_maestro_lee on public.datos_contacto
  for select to authenticated using (visible or public.tiene_rol(empresa_id, '{maestro}'));
create policy datos_contacto_maestro_crea on public.datos_contacto
  for insert to authenticated with check (public.tiene_rol(empresa_id, '{maestro}'));
create policy datos_contacto_maestro_edita on public.datos_contacto
  for update to authenticated
  using (public.tiene_rol(empresa_id, '{maestro}'))
  with check (public.tiene_rol(empresa_id, '{maestro}'));
create policy datos_contacto_maestro_borra on public.datos_contacto
  for delete to authenticated using (public.tiene_rol(empresa_id, '{maestro}'));

-- Mensajes: solo el maestro; los inserta la API.
create policy mensajes_maestro_lee on public.mensajes
  for select to authenticated using (public.tiene_rol(empresa_id, '{maestro}'));
create policy mensajes_maestro_edita on public.mensajes
  for update to authenticated
  using (public.tiene_rol(empresa_id, '{maestro}'))
  with check (public.tiene_rol(empresa_id, '{maestro}'));
create policy mensajes_maestro_borra on public.mensajes
  for delete to authenticated using (public.tiene_rol(empresa_id, '{maestro}'));

-- Reclamos: solo el maestro lee y responde. Nadie los borra: son un
-- registro legal que debe conservarse.
create policy reclamos_maestro_lee on public.reclamos
  for select to authenticated using (public.tiene_rol(empresa_id, '{maestro}'));
create policy reclamos_maestro_responde on public.reclamos
  for update to authenticated
  using (public.tiene_rol(empresa_id, '{maestro}'))
  with check (public.tiene_rol(empresa_id, '{maestro}'));

-- Contadores: sin políticas → inaccesibles salvo para service_role.

-- Empleos: la web ve lo publicado y vigente; maestro y empleos gestionan.
create policy empleos_publico on public.empleos
  for select to anon
  using (publicado and (fecha_cierre is null or fecha_cierre >= current_date));
create policy empleos_gestion_lee on public.empleos
  for select to authenticated
  using (
    (publicado and (fecha_cierre is null or fecha_cierre >= current_date))
    or public.tiene_rol(empresa_id, '{maestro,empleos}')
  );
create policy empleos_gestion_crea on public.empleos
  for insert to authenticated with check (public.tiene_rol(empresa_id, '{maestro,empleos}'));
create policy empleos_gestion_edita on public.empleos
  for update to authenticated
  using (public.tiene_rol(empresa_id, '{maestro,empleos}'))
  with check (public.tiene_rol(empresa_id, '{maestro,empleos}'));
create policy empleos_gestion_borra on public.empleos
  for delete to authenticated using (public.tiene_rol(empresa_id, '{maestro,empleos}'));

-- Los inserts de la API no pasan por RLS (service_role), pero se retira
-- cualquier privilegio de escritura a anon por si acaso.
revoke insert, update, delete on public.mensajes, public.reclamos, public.contadores_reclamos from anon;

-- ============================================================
-- Almacenamiento: PDF de las hojas de reclamación (privado)
-- Ruta: {empresa}/{año}/{código}.pdf
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reclamos', 'reclamos', false, 5242880, array['application/pdf']);

create policy reclamos_pdf_maestro on storage.objects
  for select to authenticated
  using (bucket_id = 'reclamos' and public.tiene_rol(split_part(name, '/', 1), '{maestro}'));
