-- ============================================================
-- Cierra el bucket contratos-originales
--
-- Cuando la app era una demo, cualquiera podia subir y leer los PDFs
-- originales sin estar logueado: esas dos policies lo permitian.
--
-- Hoy ningun navegador toca Storage. El servidor baja y sube los archivos
-- con la service_role (que se salta RLS) y entrega solo URLs firmadas que
-- expiran en 10 minutos, asi que estas policies ya no sirven para nada y
-- lo unico que hacen es dejar una puerta abierta si alguien vuelve a
-- marcar el bucket como publico por error.
--
-- Correr en Supabase > SQL Editor.
-- ============================================================

drop policy if exists "demo: cualquiera puede subir contratos originales" on storage.objects;
drop policy if exists "demo: cualquiera puede leer contratos originales"  on storage.objects;

-- Por si quedo alguna otra de la epoca de la demo, con otro nombre.
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and (qual like '%contratos-originales%' or with_check like '%contratos-originales%'
        or qual like '%contratos-firmados%'   or with_check like '%contratos-firmados%'
        or qual like '%anticipos%'            or with_check like '%anticipos%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
    raise notice 'policy eliminada: %', p.policyname;
  end loop;
end $$;

-- Y deja los tres buckets privados, pase lo que pase en el Dashboard.
update storage.buckets set public = false
  where id in ('contratos-originales', 'contratos-firmados', 'anticipos');


-- ------------------------------------------------------------
-- VERIFICACION: las dos consultas deben salir vacia / todo en false
-- ------------------------------------------------------------
-- select policyname from pg_policies
--   where schemaname = 'storage' and tablename = 'objects';
--
-- select id, public from storage.buckets;
