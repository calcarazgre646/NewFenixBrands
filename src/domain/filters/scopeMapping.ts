/**
 * domain/filters/scopeMapping.ts
 *
 * Mapea el `channel_scope` del perfil de usuario al ChannelFilter de la app.
 *
 * Reglas:
 *   - null o "total" → "total" (sin restricción)
 *   - "b2c"          → "b2c"
 *   - "b2b" / "b2b_mayoristas" / "b2b_utp" → "b2b"
 *     (la data no distingue sub-canales aún a nivel de scope)
 *   - cualquier otro valor desconocido → "total" (fallback seguro)
 *
 * Extracto a módulo separado para tests puros.
 */
import type { ChannelFilter } from "@/domain/filters/types";

export function scopeToChannel(scope: string | null): ChannelFilter {
  if (!scope || scope === "total") return "total";
  if (scope === "b2c") return "b2c";
  if (scope.startsWith("b2b")) return "b2b";
  return "total";
}
