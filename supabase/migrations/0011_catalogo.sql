-- ---------------------------------------------------------------
-- Catálogo de productos, editable desde el panel
--
-- Q-MEDICAL actualiza su portafolio una vez al año, y hasta ahora eso
-- significaba pedir un cambio de código. Con estas tablas lo administra la
-- propia empresa.
--
-- La jerarquía es la que usa Q-MEDICAL en su resumen de productos:
--
--     línea → categoría → producto → presentación
--
-- La presentación es la unidad que se vende —una capacidad, una medida, un
-- modelo— y la que tiene fotografía propia. Por eso las fotos cuelgan de la
-- presentación y no del producto.
--
-- Las tablas llevan empresa_id aunque hoy solo las use Q-MEDICAL: las otras
-- dos empresas del grupo venden servicios, no catálogo, pero si mañana una
-- lo necesita no hay que rehacer el esquema.
-- ---------------------------------------------------------------

-- ----------------------------------------------------------- líneas
create table public.catalogo_lineas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       text not null references public.empresas (id) on delete cascade,
  slug             text not null,              -- va en la dirección de la web
  nombre           text not null,
  nombre_en        text,
  resumen          text not null default '',
  resumen_en       text,
  icono            text not null default '',   -- nombre del icono en la web
  orden            int  not null default 0,
  visible          boolean not null default true,
  actualizado      timestamptz not null default now(),
  actualizado_por  uuid references auth.users (id) on delete set null,
  unique (empresa_id, slug)
);

create index catalogo_lineas_empresa on public.catalogo_lineas (empresa_id, orden);

-- ------------------------------------------------------ categorías
create table public.catalogo_categorias (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       text not null references public.empresas (id) on delete cascade,
  linea_id         uuid not null references public.catalogo_lineas (id) on delete cascade,
  slug             text not null,
  nombre           text not null,
  nombre_en        text,
  orden            int  not null default 0,
  visible          boolean not null default true,
  actualizado      timestamptz not null default now(),
  actualizado_por  uuid references auth.users (id) on delete set null,
  unique (empresa_id, slug)
);

create index catalogo_categorias_linea on public.catalogo_categorias (linea_id, orden);

-- -------------------------------------------------------- productos
create table public.catalogo_productos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       text not null references public.empresas (id) on delete cascade,
  categoria_id     uuid not null references public.catalogo_categorias (id) on delete cascade,
  slug             text not null,
  nombre           text not null,
  nombre_en        text,
  descripcion      text not null default '',
  descripcion_en   text,
  destacado        boolean not null default false,
  orden            int  not null default 0,
  visible          boolean not null default true,
  actualizado      timestamptz not null default now(),
  actualizado_por  uuid references auth.users (id) on delete set null,
  unique (empresa_id, slug)
);

create index catalogo_productos_categoria on public.catalogo_productos (categoria_id, orden);

-- --------------------------------------------------- presentaciones
--
-- `caracteristicas` va como arreglo de texto porque es una lista de pares
-- sueltos —«Material: polipropileno», «Caja x 60 unidades»— que cambia de un
-- producto a otro. Normalizarla obligaría a una tabla de atributos que nadie
-- va a consultar por separado.
--
-- `registro_sanitario` y `normativa` nacen vacíos: la empresa todavía no los
-- entregó, y la ficha de la web los muestra solo cuando existen.
create table public.catalogo_presentaciones (
  id                  uuid primary key default gen_random_uuid(),
  producto_id         uuid not null references public.catalogo_productos (id) on delete cascade,
  medida              text not null default '',   -- «0.95 L», «3 ML», «Kit A»
  marca               text not null default '',
  marca_slug          text,                       -- si la marca tiene ficha propia
  unidad              text not null default '',   -- cómo se vende
  caracteristicas     text[] not null default '{}',
  descripcion         text,                       -- solo si difiere de la del producto
  registro_sanitario  text,
  normativa           text,
  imagen              text,                       -- ruta en el bucket `catalogo`
  orden               int  not null default 0,
  visible             boolean not null default true,
  actualizado         timestamptz not null default now(),
  actualizado_por     uuid references auth.users (id) on delete set null
);

create index catalogo_presentaciones_producto on public.catalogo_presentaciones (producto_id, orden);

-- ---------------------------------------------------------------
-- Permisos
--
-- La web lee sin identificarse, pero solo lo visible: es un catálogo
-- público. Escribir es cosa del maestro de la empresa, como en el resto
-- del panel.
-- ---------------------------------------------------------------
alter table public.catalogo_lineas          enable row level security;
alter table public.catalogo_categorias      enable row level security;
alter table public.catalogo_productos       enable row level security;
alter table public.catalogo_presentaciones  enable row level security;

create policy catalogo_lineas_publico on public.catalogo_lineas
  for select to anon using (visible);
create policy catalogo_lineas_maestro on public.catalogo_lineas
  for all to authenticated
  using (public.tiene_rol(empresa_id, '{maestro}'))
  with check (public.tiene_rol(empresa_id, '{maestro}'));

create policy catalogo_categorias_publico on public.catalogo_categorias
  for select to anon using (visible);
create policy catalogo_categorias_maestro on public.catalogo_categorias
  for all to authenticated
  using (public.tiene_rol(empresa_id, '{maestro}'))
  with check (public.tiene_rol(empresa_id, '{maestro}'));

create policy catalogo_productos_publico on public.catalogo_productos
  for select to anon using (visible);
create policy catalogo_productos_maestro on public.catalogo_productos
  for all to authenticated
  using (public.tiene_rol(empresa_id, '{maestro}'))
  with check (public.tiene_rol(empresa_id, '{maestro}'));

-- Las presentaciones no llevan empresa_id: cuelgan de su producto, y de ahí
-- sale el permiso. Así no hay dos sitios donde pueda quedar desincronizado.
create policy catalogo_presentaciones_publico on public.catalogo_presentaciones
  for select to anon using (
    visible and exists (
      select 1 from public.catalogo_productos p
      where p.id = producto_id and p.visible
    )
  );
create policy catalogo_presentaciones_maestro on public.catalogo_presentaciones
  for all to authenticated
  using (exists (
    select 1 from public.catalogo_productos p
    where p.id = producto_id and public.tiene_rol(p.empresa_id, '{maestro}')
  ))
  with check (exists (
    select 1 from public.catalogo_productos p
    where p.id = producto_id and public.tiene_rol(p.empresa_id, '{maestro}')
  ));

-- ---------------------------------------------------------------
-- Fotografías
--
-- Bucket público: son fotos de catálogo, pensadas para que las vea
-- cualquiera. Subirlas y borrarlas sigue siendo cosa del maestro.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 10485760,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy catalogo_fotos_lectura on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'catalogo');

create policy catalogo_fotos_maestro on storage.objects
  for all to authenticated
  using (bucket_id = 'catalogo' and public.tiene_rol(split_part(name, '/', 1), '{maestro}'))
  with check (bucket_id = 'catalogo' and public.tiene_rol(split_part(name, '/', 1), '{maestro}'));
