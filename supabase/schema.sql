-- ============================================================
-- Hurgo Contratos · esquema SIMPLIFICADO para la demo (sin login por SMS)
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  contenido text,                       -- opcional: notas, o el texto si no se sube PDF
  contrato_original_url text,           -- URL del PDF que subio el coordinador
  conductor_nombre text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'visto', 'firmado', 'rechazado')),
  pdf_firmado_url text,
  firma_png text,
  firmado_en timestamptz,
  visto_en timestamptz,
  creado_en timestamptz not null default now()
);

alter table contratos enable row level security;

create policy "demo: cualquiera puede leer contratos"
  on contratos for select
  using (true);

create policy "demo: cualquiera puede crear contratos"
  on contratos for insert
  with check (true);

create policy "demo: cualquiera puede actualizar contratos"
  on contratos for update
  using (true);

-- ============================================================
-- Bucket para los PDFs ORIGINALES que sube el coordinador
-- Crear manualmente en Supabase Dashboard > Storage > New bucket:
--   nombre: contratos-originales   (marca la casilla "Public bucket")
-- Luego ejecuta esto para permitir que se suban archivos sin login:
-- ============================================================
create policy "demo: cualquiera puede subir contratos originales"
  on storage.objects for insert
  to public
  with check (bucket_id = 'contratos-originales');

create policy "demo: cualquiera puede leer contratos originales"
  on storage.objects for select
  to public
  using (bucket_id = 'contratos-originales');

-- ============================================================
-- Bucket para los PDFs FIRMADOS (igual que antes)
-- Crear manualmente en Supabase Dashboard > Storage > New bucket:
--   nombre: contratos-firmados   (privado, NO marques "Public")
-- ============================================================
