-- ---------------------------------------------------------------
-- El «detalle» de una presentación, en su propio campo
-- ---------------------------------------------------------------
--
-- Q-MEDICAL entregó en octubre de 2026 su lista de productos con cuatro
-- datos por presentación, en este orden: marca, unidad de venta,
-- características y detalle. El detalle es el empaque de despacho —«Caja x
-- 60 unidades», «Caja por 20 rollos»— y en algunos productos la empresa
-- pidió expresamente no publicarlo, ni siquiera el rótulo.
--
-- Hasta ahora ese dato viajaba como la última línea de `caracteristicas`, y
-- la web lo adivinaba por no llevar dos puntos. Con la lista nueva eso ya no
-- alcanza: las características vienen escritas como un bloque y el detalle
-- tiene que salir siempre al final, o no salir. Un campo propio lo dice sin
-- adivinar.
--
-- Vacío o nulo significa «no se publica»: la fila desaparece de la ficha.

alter table public.catalogo_presentaciones
  add column if not exists detalle    text,
  add column if not exists detalle_en text;

comment on column public.catalogo_presentaciones.detalle is
  'Empaque de despacho («Caja x 60 unidades»). Va al final de la ficha. Vacío: no se publica, ni el rótulo.';
comment on column public.catalogo_presentaciones.detalle_en is
  'Traducción del detalle. Vacía: se muestra el castellano.';
