-- ============================================================
-- Dónde se muestra cada teléfono o correo en la web de LP:
--   'pie'      → pie de página (y teléfonos del menú móvil)
--   'contacto' → «Contacto por área» de la página Contacto
-- Por defecto, en los dos. Las webs que no usan esta columna la ignoran.
-- ============================================================

alter table public.datos_contacto
  add column mostrar_en text[] not null default '{pie,contacto}'
    check (mostrar_en <@ array['pie', 'contacto']);

-- Pedido del cliente (septiembre 2026):
--   Pie: solo Comercial y Dirección Técnica.
--   Contacto por área: solo Comercial y Administración.
--   Marketing: fuera de la web (se conserva oculto en el portal).
update public.datos_contacto set mostrar_en = '{pie}'
  where empresa_id = 'lp' and tipo in ('telefono', 'correo') and etiqueta = 'Dirección Técnica';
update public.datos_contacto set mostrar_en = '{contacto}'
  where empresa_id = 'lp' and tipo in ('telefono', 'correo') and etiqueta = 'Administración';
update public.datos_contacto set visible = false
  where empresa_id = 'lp' and tipo in ('telefono', 'correo') and etiqueta = 'Marketing';
