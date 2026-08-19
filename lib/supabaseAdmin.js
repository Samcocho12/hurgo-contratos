// SOLO se usa dentro de pages/api/** (servidor). Nunca lo importes en el navegador:
// la service_role key salta la seguridad (RLS) y debe permanecer secreta.
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
