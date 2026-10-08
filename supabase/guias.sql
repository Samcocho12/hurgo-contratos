-- ============================================================
-- Hurgo Contratos · Módulo de GUÍAS DE ENVÍO + rastreo público
-- Ejecutar en: Supabase > SQL Editor > New query
-- Se puede ejecutar aunque ya hayas corrido una versión anterior:
-- actualiza tablas y estados sin perder guías.
-- Requiere que ya existan las tablas "contratos" y "conductores".
--
-- La RUTA de cada guía es el CONTRATO FIRMADO del conductor
-- (el título del contrato indica la ruta). No hay tabla de rutas aparte.
--
-- Estados de una guía:
--   creada (automático) -> recogiendo -> en_camino -> entregada
--   cancelada (solo coordinación)
--
-- Seguridad: estas tablas NO quedan abiertas al público (anon).
--  * Coordinadores (sesión de Supabase Auth) -> acceso directo por RLS.
--  * Conductores y clientes -> solo a través de /api/* (service_role).
-- ============================================================

-- ---------- guías ----------
create table if not exists public.guias (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique check (numero ~ '^HG[0-9]{10}$'),
  conductor_placa text not null,
  conductor_nombre text,
  contrato_id uuid references public.contratos(id) on delete set null,   -- la ruta
  ruta_nombre text,                    -- copia del título del contrato (se conserva si el contrato se borra)

  remitente_nombre text not null,
  remitente_telefono text,
  origen_ciudad text not null,
  origen_direccion text,

  destinatario_nombre text not null,
  destinatario_telefono text not null,
  destino_ciudad text not null,
  destino_direccion text not null,

  contenido text not null,
  unidades integer not null default 1 check (unidades > 0),
  peso_kg numeric(10,2) check (peso_kg is null or peso_kg > 0),
  valor_declarado numeric(14,0) check (valor_declarado is null or valor_declarado >= 0),
  observaciones text,

  estado text not null default 'creada',
  recibido_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  entregado_en timestamptz
);

-- Actualización desde versiones anteriores: la ruta pasa a ser el contrato.
alter table public.guias add column if not exists ruta_nombre text;
update public.guias g set ruta_nombre = c.titulo
  from public.contratos c
  where g.contrato_id = c.id and g.ruta_nombre is null;
alter table public.guias drop column if exists ruta_id;
drop table if exists public.rutas;

create index if not exists guias_placa_idx on public.guias (conductor_placa, creado_en desc);
create index if not exists guias_estado_idx on public.guias (estado);
create index if not exists guias_contrato_idx on public.guias (contrato_id);

create table if not exists public.guia_eventos (
  id uuid primary key default gen_random_uuid(),
  guia_id uuid not null references public.guias(id) on delete cascade,
  estado text not null,
  ubicacion text,
  nota text,                 -- visible para el cliente en el rastreo público
  recibido_por text,
  autor text not null check (autor in ('conductor','coordinador')),
  autor_detalle text,        -- placa del conductor o correo del coordinador
  creado_en timestamptz not null default now()
);

create index if not exists guia_eventos_guia_idx on public.guia_eventos (guia_id, creado_en desc);

-- ---------- estados (pasa los de la versión anterior a los nuevos) ----------
alter table public.guias drop constraint if exists guias_estado_check;
alter table public.guia_eventos drop constraint if exists guia_eventos_estado_check;

update public.guias set estado = case estado
  when 'recogida' then 'recogiendo'
  when 'en_transito' then 'en_camino'
  when 'en_reparto' then 'en_camino'
  when 'novedad' then 'en_camino'
  else estado end;

update public.guia_eventos set estado = case estado
  when 'recogida' then 'recogiendo'
  when 'en_transito' then 'en_camino'
  when 'en_reparto' then 'en_camino'
  when 'novedad' then 'en_camino'
  else estado end;

alter table public.guias add constraint guias_estado_check
  check (estado in ('creada','recogiendo','en_camino','entregada','cancelada'));
alter table public.guia_eventos add constraint guia_eventos_estado_check
  check (estado in ('creada','recogiendo','en_camino','entregada','cancelada'));

-- ---------- cada evento nuevo actualiza el estado actual de la guía ----------
create or replace function public.guia_aplicar_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.guias set
    estado = new.estado,
    actualizado_en = new.creado_en,
    entregado_en = case when new.estado = 'entregada' then new.creado_en else entregado_en end,
    recibido_por = case when new.estado = 'entregada' then new.recibido_por else recibido_por end
  where id = new.guia_id;
  return new;
end;
$$;

drop trigger if exists guia_eventos_aplicar on public.guia_eventos;
create trigger guia_eventos_aplicar
  after insert on public.guia_eventos
  for each row execute function public.guia_aplicar_evento();

-- ---------- seguridad ----------
alter table public.guias enable row level security;
alter table public.guia_eventos enable row level security;

drop policy if exists "coordinadores gestionan guias" on public.guias;
create policy "coordinadores gestionan guias"
  on public.guias for all to authenticated
  using (true) with check (true);

drop policy if exists "coordinadores gestionan eventos" on public.guia_eventos;
create policy "coordinadores gestionan eventos"
  on public.guia_eventos for all to authenticated
  using (true) with check (true);
