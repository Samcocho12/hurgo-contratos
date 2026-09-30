-- ============================================================
-- HURGO CONTRATOS · Esquema seguro
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
--
-- IMPORTANTE: no ejecutes esto hasta que las rutas /api/ esten
-- desplegadas en Vercel. Este script CIERRA el acceso directo
-- desde el navegador y la app dejaria de funcionar sin ellas.
-- ============================================================


-- ------------------------------------------------------------
-- 1. BORRAR LAS POLITICAS ABIERTAS DE LA DEMO
-- ------------------------------------------------------------
drop policy if exists "demo: cualquiera puede leer contratos" on contratos;
drop policy if exists "demo: cualquiera puede crear contratos" on contratos;
drop policy if exists "demo: cualquiera puede actualizar contratos" on contratos;
drop policy if exists "demo: cualquiera puede subir contratos originales" on storage.objects;
drop policy if exists "demo: cualquiera puede leer contratos originales" on storage.objects;


-- ------------------------------------------------------------
-- 2. CAMPOS NUEVOS EN CONDUCTORES
-- ------------------------------------------------------------
alter table conductores add column if not exists pin_hash            text;
alter table conductores add column if not exists enrolamiento_hash   text;
alter table conductores add column if not exists enrolamiento_expira timestamptz;
alter table conductores add column if not exists enrolado_en         timestamptz;
alter table conductores add column if not exists intentos_fallidos   int  not null default 0;
alter table conductores add column if not exists bloqueado_hasta     timestamptz;
alter table conductores add column if not exists activo              boolean not null default true;

comment on column conductores.pin_hash is
  'Hash bcrypt del PIN. El PIN lo define el CONDUCTOR, nunca el coordinador.';
comment on column conductores.enrolamiento_hash is
  'Hash del codigo de enrolamiento de un solo uso. Se borra al consumirse.';


-- ------------------------------------------------------------
-- 3. PASSKEYS (huella / rostro)
-- ------------------------------------------------------------
create table if not exists passkeys (
  id              uuid primary key default gen_random_uuid(),
  conductor_placa text not null references conductores(placa) on delete cascade,
  credential_id   text not null unique,   -- base64url
  public_key      text not null,          -- base64url, llave PUBLICA (inutil por si sola)
  counter         bigint not null default 0,
  transports      text[],
  dispositivo     text,                   -- etiqueta legible: "Xiaomi Redmi"
  creado_en       timestamptz not null default now(),
  ultimo_uso      timestamptz
);

create index if not exists idx_passkeys_placa on passkeys(conductor_placa);


-- ------------------------------------------------------------
-- 4. DISPOSITIVOS VINCULADOS
--    El PIN SOLO funciona desde un dispositivo de esta tabla.
-- ------------------------------------------------------------
create table if not exists dispositivos (
  id              uuid primary key default gen_random_uuid(),
  conductor_placa text not null references conductores(placa) on delete cascade,
  token_hash      text not null unique,   -- hash del id que vive en la cookie httpOnly
  etiqueta        text,
  creado_en       timestamptz not null default now(),
  ultimo_uso      timestamptz,
  revocado        boolean not null default false
);

create index if not exists idx_dispositivos_placa on dispositivos(conductor_placa);


-- ------------------------------------------------------------
-- 5. AUDITORIA
--    Append-only. Nada la borra ni la edita, ni el coordinador.
-- ------------------------------------------------------------
create table if not exists auditoria (
  id          bigserial primary key,
  ocurrido_en timestamptz not null default now(),
  actor_tipo  text not null,              -- 'conductor' | 'coordinador' | 'sistema'
  actor_id    text,                       -- placa o email
  accion      text not null,              -- 'login_passkey', 'firma', 'codigo_generado'...
  objetivo    text,                       -- id de contrato, placa afectada...
  ip          text,
  user_agent  text,
  detalle     jsonb
);

create index if not exists idx_auditoria_fecha  on auditoria(ocurrido_en desc);
create index if not exists idx_auditoria_actor  on auditoria(actor_id);


-- ------------------------------------------------------------
-- 6. CERRAR TODO A CAL Y CANTO
--    Sin politicas permisivas, RLS niega por defecto.
--    Solo service_role (servidor) puede leer y escribir.
-- ------------------------------------------------------------
alter table contratos    enable row level security;
alter table conductores  enable row level security;
alter table passkeys     enable row level security;
alter table dispositivos enable row level security;
alter table auditoria    enable row level security;

revoke all on contratos,    conductores, passkeys, dispositivos, auditoria from anon;
revoke all on contratos,    conductores, passkeys, dispositivos, auditoria from authenticated;

-- (no se crea NINGUNA policy: con RLS activo y sin policies, anon no ve nada)


-- ------------------------------------------------------------
-- 7. BUCKETS PRIVADOS
--    Ejecutar despues de marcarlos como privados en el Dashboard.
-- ------------------------------------------------------------
update storage.buckets set public = false
  where id in ('contratos-originales', 'contratos-firmados');

-- Sin policies en storage.objects para anon: los PDFs solo se sirven
-- mediante URLs firmadas que genera el servidor y expiran en minutos.
