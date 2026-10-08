-- ============================================================
-- Cierra la tabla "perfiles"
--
-- Esta tabla no la crea ni la usa la app: no aparece en ningun archivo
-- de supabase/ ni en ningun .js. Vino de alguna plantilla vieja.
--
-- El problema era que anon y authenticated tenian TODOS los permisos
-- sobre ella (select, insert, update, delete, truncate). La llave anon
-- viaja dentro del bundle del navegador, o sea que es publica: cualquiera
-- que abriera el inspector podia leer esa tabla, cambiarla o vaciarla,
-- aunque la app nunca la tocara.
--
-- Se le quitan los permisos y se le prende RLS, igual que a todas las
-- demas tablas. Queda alcanzable solo desde el servidor con service_role.
--
-- Correr en Supabase > SQL Editor.
-- ============================================================

revoke all on public.perfiles from anon, authenticated;
alter table public.perfiles enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'perfiles'
  loop
    execute format('drop policy %I on public.perfiles', p.policyname);
  end loop;
end $$;


-- ------------------------------------------------------------
-- VERIFICACION
-- ------------------------------------------------------------
-- Debe salir vacio:
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'perfiles'
--   and grantee in ('anon', 'authenticated');
--
-- Debe salir true:
-- select relrowsecurity from pg_class where relname = 'perfiles';


-- ------------------------------------------------------------
-- ANTES DE BORRARLA DEL TODO
-- Estas plantillas suelen traer un trigger que inserta una fila en
-- perfiles cada vez que alguien se registra. Si existe y se borra la
-- tabla, se rompe la creacion de coordinadores. Revisar primero:
-- ------------------------------------------------------------
-- select count(*) from public.perfiles;
--
-- select tgname, tgrelid::regclass as sobre_tabla
-- from pg_trigger
-- where not tgisinternal
--   and (tgrelid = 'public.perfiles'::regclass
--     or tgfoid in (select oid from pg_proc where prosrc like '%perfiles%'));
--
-- Si no hay trigger y la tabla esta vacia:
-- drop table public.perfiles;
--
-- HECHO el 2026-10-07: 0 filas, ningun trigger. La tabla ya no existe.
-- Este archivo queda como registro de por que se borro.
