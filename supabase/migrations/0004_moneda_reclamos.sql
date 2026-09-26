-- Moneda del monto reclamado (algunos servicios, como el transporte
-- internacional de WOLI, se facturan en dólares).
alter table public.reclamos
  add column moneda text not null default 'PEN' check (moneda in ('PEN', 'USD'));
