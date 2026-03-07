/**
 * api/client.ts
 *
 * Supabase clients — dos instancias:
 *   - dataClient: BD operacional del cliente (ventas, inventario, KPIs)
 *   - authClient: BD de la app (usuarios, calendario)
 *
 * REGLA: Nunca importar directamente desde @supabase/supabase-js en otros archivos.
 * Siempre usar estos clients exportados aquí.
 */
import { createClient } from "@supabase/supabase-js";

const DATA_URL  = import.meta.env.VITE_CLIENT_SUPABASE_URL  as string;
const DATA_KEY  = import.meta.env.VITE_CLIENT_SUPABASE_ANON_KEY as string;
const AUTH_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const AUTH_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!DATA_URL || !DATA_KEY) {
  throw new Error(
    "Missing VITE_CLIENT_SUPABASE_URL or VITE_CLIENT_SUPABASE_ANON_KEY in .env.local"
  );
}
if (!AUTH_URL || !AUTH_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local"
  );
}

/** Cliente para la BD operacional del cliente (ventas, inventario, KPIs, logística) */
export const dataClient = createClient(DATA_URL, DATA_KEY);

/** Cliente para la BD de la app (auth de usuarios, calendario) */
export const authClient = createClient(AUTH_URL, AUTH_KEY);
