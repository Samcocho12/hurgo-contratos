-- ============================================================
-- HURGO CONTRATOS - COMPUTADORES DE CONFIANZA DEL COORDINADOR
--
-- SEGURO DE EJECUTAR: solo crea una tabla nueva.
--
-- El segundo factor (codigo de la app de autenticacion) lo maneja
-- Supabase Auth; el secreto nunca pasa por nuestro codigo. Esta tabla
-- guarda solo QUE computadores ya pasaron la verificacion, para no
-- pedir el codigo cada vez en el mismo equipo.
-- ============================================================

create table if not exists coordinador_dispositivos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null,              -- auth.users.id del coordinador
  correo        text,
  token_hash    text not null unique,       -- hash del id que vive en la cookie
  etiqueta      text,                       -- "Chrome en Windows"
  ip            text,
  creado_en     timestamptz not null default now(),
  ultimo_uso    timestamptz,
  expira_en     timestamptz not null,
  revocado      boolean not null default false
);

create index if not exists idx_coord_disp_usuario on coordinador_dispositivos(usuario_id);

comment on table coordinador_dispositivos is
  'Computadores donde el coordinador ya confirmo su codigo. No guarda credenciales.';


-- Cerrada como todas: solo el servidor entra.
alter table coordinador_dispositivos enable row level security;
revoke all on coordinador_dispositivos from anon, authenticated;
