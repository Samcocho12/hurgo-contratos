-- ============================================================
-- HURGO CONTRATOS - PASO 2: CERRAR LA BASE
--
-- Quita el acceso directo del navegador a las tablas. A partir de
-- aqui solo el servidor (service_role, desde las rutas /api/) puede
-- leer y escribir.
--
-- SEGURO DE EJECUTAR AHORA: ninguna pagina consulta Supabase
-- directamente; todo pasa por las rutas de API. El login del
-- coordinador usa Supabase Auth, que no depende de estas tablas.
--
-- NO toca los buckets de archivos: eso va en un paso aparte, cuando
-- las URLs firmadas esten listas.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Borrar las politicas abiertas
-- ------------------------------------------------------------
drop policy if exists "demo: cualquiera puede leer contratos"       on public.contratos;
drop policy if exists "demo: cualquiera puede crear contratos"      on public.contratos;
drop policy if exists "demo: cualquiera puede actualizar contratos" on public.contratos;

-- Estas daban acceso total a cualquier usuario autenticado.
drop policy if exists "coordinadores gestionan guias"   on public.guias;
drop policy if exists "coordinadores gestionan eventos" on public.guia_eventos;


-- ------------------------------------------------------------
-- 2. RLS activo en todas las tablas
--    Sin politicas, RLS niega por defecto a anon y authenticated.
--    service_role (el servidor) la ignora y sigue trabajando igual.
-- ------------------------------------------------------------
alter table public.contratos       enable row level security;
alter table public.conductores     enable row level security;
alter table public.contrato_anexos enable row level security;
alter table public.guias           enable row level security;
alter table public.guia_eventos    enable row level security;


-- ------------------------------------------------------------
-- 3. Quitar los permisos de tabla
--    RLS ya bastaria, pero sin grants no hay ni por donde intentarlo.
-- ------------------------------------------------------------
revoke all on public.contratos       from anon, authenticated;
revoke all on public.conductores     from anon, authenticated;
revoke all on public.contrato_anexos from anon, authenticated;
revoke all on public.guias           from anon, authenticated;
revoke all on public.guia_eventos    from anon, authenticated;

-- Y que las tablas nuevas tampoco nazcan abiertas.
alter default privileges in schema public revoke all on tables from anon, authenticated;


-- ------------------------------------------------------------
-- 4. Comprobacion
--    Todas deben salir con rls = true y sin politicas.
-- ------------------------------------------------------------
select
  c.relname                                   as tabla,
  c.relrowsecurity                            as rls_activo,
  coalesce(count(p.policyname), 0)            as politicas
from pg_class c
left join pg_namespace n on n.oid = c.relnamespace
left join pg_policies  p on p.tablename = c.relname and p.schemaname = 'public'
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'contratos', 'conductores', 'contrato_anexos', 'guias', 'guia_eventos',
    'passkeys', 'dispositivos', 'auditoria', 'anticipos', 'anticipo_soportes'
  )
group by c.relname, c.relrowsecurity
order by c.relname;
