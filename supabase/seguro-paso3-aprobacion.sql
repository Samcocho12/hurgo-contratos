-- ============================================================
-- HURGO CONTRATOS - PASO 3: COLA DE APROBACION
--
-- SEGURO DE EJECUTAR AHORA. Solo agrega columnas.
--
-- Los conductores que YA existen quedan aprobados automaticamente
-- (no queremos dejar por fuera a quien ya esta trabajando).
-- Los que se registren desde ahora nacen pendientes.
-- ============================================================

-- 1. Se crea con default true: los registros existentes quedan aprobados.
alter table conductores add column if not exists aprobado boolean not null default true;

-- 2. De aqui en adelante, todo registro nuevo nace PENDIENTE.
alter table conductores alter column aprobado set default false;

-- 3. Trazabilidad de la aprobacion
alter table conductores add column if not exists aprobado_en   timestamptz;
alter table conductores add column if not exists aprobado_por  text;
alter table conductores add column if not exists solicitud_ip  text;
alter table conductores add column if not exists auto_registro boolean not null default false;

comment on column conductores.aprobado is
  'false = se auto-registro y espera que el coordinador lo confirme.';
comment on column conductores.solicitud_ip is
  'IP desde la que se hizo el auto-registro. Util si hay intentos sospechosos.';

-- 4. Para listar rapido las solicitudes pendientes
create index if not exists idx_conductores_aprobado on conductores(aprobado);
