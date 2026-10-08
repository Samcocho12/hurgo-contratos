-- ============================================================
-- HURGO CONTRATOS - MODULO DE ANTICIPOS
--
-- SEGURO DE EJECUTAR: solo crea tablas nuevas, no toca nada existente.
--
-- Flujo:
--   solicitado -> aprobado -> pagado -> legalizado
--                \-> rechazado
--
-- El conductor pide (monto + motivo). El coordinador aprueba (puede
-- ajustar el monto), rechaza, o marca como pagado. Despues el conductor
-- sube soportes y se cuadra lo gastado contra lo entregado.
-- ============================================================

create table if not exists anticipos (
  id                uuid primary key default gen_random_uuid(),
  conductor_placa   text not null references conductores(placa) on delete cascade,
  conductor_nombre  text,

  -- lo que pide el conductor
  monto_solicitado  numeric(12,2) not null check (monto_solicitado > 0),
  motivo            text not null,
  destino           text,                     -- opcional: "Santa Marta - Barranquilla"

  estado            text not null default 'solicitado',
  -- solicitado | aprobado | rechazado | pagado | legalizado

  -- decision del coordinador
  monto_aprobado    numeric(12,2),
  revisado_por      text,
  revisado_en       timestamptz,
  motivo_rechazo    text,

  -- pago
  pagado_en         timestamptz,
  metodo_pago       text,                     -- transferencia | efectivo | otro
  referencia_pago   text,

  -- legalizacion
  legalizado_en     timestamptz,
  nota_cierre       text,

  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

create index if not exists idx_anticipos_placa  on anticipos(conductor_placa);
create index if not exists idx_anticipos_estado on anticipos(estado);
create index if not exists idx_anticipos_fecha  on anticipos(creado_en desc);

comment on column anticipos.monto_aprobado is
  'Puede ser menor al solicitado: el coordinador decide cuanto entrega.';


-- ------------------------------------------------------------
-- Soportes: las facturas y recibos con los que el conductor legaliza
-- ------------------------------------------------------------
create table if not exists anticipo_soportes (
  id           uuid primary key default gen_random_uuid(),
  anticipo_id  uuid not null references anticipos(id) on delete cascade,
  descripcion  text not null,                 -- "Peaje Rio Frio", "Hotel"
  monto        numeric(12,2) not null check (monto >= 0),
  archivo_url  text,                          -- foto o PDF del recibo
  creado_en    timestamptz not null default now()
);

create index if not exists idx_soportes_anticipo on anticipo_soportes(anticipo_id);


-- ------------------------------------------------------------
-- Cerradas desde el principio: solo el servidor (service_role) entra.
-- ------------------------------------------------------------
alter table anticipos         enable row level security;
alter table anticipo_soportes enable row level security;

revoke all on anticipos, anticipo_soportes from anon;
revoke all on anticipos, anticipo_soportes from authenticated;
