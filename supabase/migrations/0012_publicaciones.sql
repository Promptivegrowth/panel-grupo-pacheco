-- ---------------------------------------------------------------
-- Publicaciones de la web
--
-- El catálogo se edita aquí, pero la web es estática: lo que se guarda no
-- aparece hasta que el sitio se vuelve a compilar. El panel pide esa
-- compilación con un «deploy hook» de Vercel, y aquí queda anotado quién la
-- pidió y cuándo.
--
-- No se pide automáticamente en cada guardado a propósito: una tarde de
-- edición son decenas de cambios, y cada uno encolaría una compilación. El
-- botón lo pulsa la empresa cuando termina.
--
-- La tabla también sirve de freno: la pantalla no vuelve a ofrecer el botón
-- mientras la última petición sea reciente.
-- ---------------------------------------------------------------
create table public.publicaciones (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   text not null references public.empresas (id) on delete cascade,
  creado       timestamptz not null default now(),
  creado_por   uuid references auth.users (id) on delete set null,
  ok           boolean not null default true,
  detalle      text
);

create index publicaciones_empresa on public.publicaciones (empresa_id, creado desc);

alter table public.publicaciones enable row level security;

-- Es un dato interno: no lo lee nadie sin identificarse.
create policy publicaciones_maestro on public.publicaciones
  for all to authenticated
  using (public.tiene_rol(empresa_id, '{maestro}'))
  with check (public.tiene_rol(empresa_id, '{maestro}'));
