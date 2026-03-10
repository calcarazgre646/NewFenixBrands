/**
 * domain/logistics/arrivals.ts
 *
 * Funciones puras para procesar datos de importación.
 * No React, no side effects.
 *
 * HISTORIAL:
 *   - 08/03/2026: Implementación inicial (4 statuses: past, this_month, next_month, upcoming)
 *   - 10/03/2026: Agregado status "overdue" para ETAs vencidas dentro del mes actual.
 *     Bug: ETAs del 5/Mar mostraban "Este Mes" el 10/Mar — sin señal de atraso.
 *     Fix: nueva clasificación "overdue" con label "Atrasado · Xd".
 *     También: unificado `today` como parámetro para pureza y testabilidad.
 */
import type { LogisticsImport } from "@/queries/logistics.queries";
import type {
  LogisticsArrival,
  LogisticsGroup,
  LogisticsSummary,
  ArrivalStatus,
} from "./types";

// ─── Status helpers ──────────────────────────────────────────────────────────

const KNOWN_BRANDS = new Set(["martel", "wrangler", "lee"]);

/**
 * Días hasta la fecha ETA. Negativo = ya pasó.
 * Recibe `today` como parámetro para pureza (testeable, sin side effects).
 */
function getDaysUntil(date: Date | null, today: Date): number {
  if (!date) return 999;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Clasifica estado del arribo.
 *
 * - past:       ETA en un mes anterior al actual
 * - overdue:    ETA en el mes actual pero la fecha ya pasó (atrasado)
 * - this_month: ETA en el mes actual, aún no llegó
 * - next_month: ETA en el mes siguiente
 * - upcoming:   ETA en 2+ meses
 */
function getArrivalStatus(date: Date | null, today: Date): ArrivalStatus {
  if (!date) return "upcoming";
  const bom  = new Date(today.getFullYear(), today.getMonth(), 1);
  const bonm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const bo2m = new Date(today.getFullYear(), today.getMonth() + 2, 1);

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  if (date < bom)       return "past";
  if (date < todayStart) return "overdue";
  if (date < bonm)      return "this_month";
  if (date < bo2m)      return "next_month";
  return "upcoming";
}

export function statusLabel(status: ArrivalStatus, daysUntil: number): string {
  if (status === "past")       return "Pasado";
  if (status === "overdue")    return `Atrasado · ${Math.abs(daysUntil)}d`;
  if (status === "this_month") return daysUntil === 0 ? "Hoy" : `Este Mes · ${daysUntil}d`;
  if (status === "next_month") return `Prox. Mes · ${daysUntil}d`;
  return daysUntil < 999 ? `En ${daysUntil}d` : "Proximo";
}

// ─── Transform imports → arrivals ────────────────────────────────────────────

export function toArrivals(rows: LogisticsImport[], now?: Date): LogisticsArrival[] {
  const today = now ?? new Date();

  return rows
    .filter(r => {
      const m = r.brand.toLowerCase();
      return KNOWN_BRANDS.has(m) && (r.eta || r.etaLabel);
    })
    .map(r => {
      const status    = getArrivalStatus(r.eta, today);
      const daysUntil = getDaysUntil(r.eta, today);
      const dateLabel = r.eta
        ? r.eta.toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })
        : r.etaLabel || "—";
      // Usar fecha ISO para grouping key — evita inconsistencias de formato en BD
      const etaKey = r.eta ? r.eta.toISOString().split("T")[0] : r.etaLabel;
      return {
        ...r,
        status,
        daysUntil,
        dateLabel,
        brandNorm: r.brand.toLowerCase(),
        etaKey,
      };
    })
    .sort((a, b) => {
      if (!a.eta && !b.eta) return 0;
      if (!a.eta) return 1;
      if (!b.eta) return -1;
      return a.eta.getTime() - b.eta.getTime();
    });
}

// ─── Grouping by (brand + supplier + ETA) ────────────────────────────────────

export function groupArrivals(arrivals: LogisticsArrival[]): LogisticsGroup[] {
  const map = new Map<string, LogisticsArrival[]>();

  for (const a of arrivals) {
    // Usar etaKey (fecha ISO o label crudo) en vez de etaLabel crudo
    // para evitar que "3/5/2026" y "03/05/2026" generen grupos distintos
    const k = [a.brandNorm, a.supplier, a.etaKey].join("|||");
    const bucket = map.get(k) ?? [];
    bucket.push(a);
    map.set(k, bucket);
  }

  return [...map.values()].map(rows => {
    const f = rows[0];
    return {
      key:        [f.brandNorm, f.supplier, f.etaKey].join("|||"),
      rows,
      totalUnits: rows.reduce((s, r) => s + r.quantity, 0),
      brand:      f.brand,
      supplier:   f.supplier,
      origin:     f.origin,
      categories: [...new Set(rows.map(r => r.category).filter(Boolean))],
      status:     f.status,
      daysUntil:  f.daysUntil,
      dateLabel:  f.dateLabel,
      brandNorm:  f.brandNorm,
    };
  });
}

// ─── Summary stats ───────────────────────────────────────────────────────────

export function computeSummary(
  groups: LogisticsGroup[],
  arrivals: LogisticsArrival[],
): LogisticsSummary {
  // "overdue" counts as active — it's not past, it's urgently late
  const activeGroups = groups.filter(g => g.status !== "past");
  const active       = arrivals.filter(a => a.status !== "past");
  const next         = active.find(a => a.eta != null && a.status !== "overdue");

  const overdueCount = arrivals.filter(a => a.status === "overdue").length;

  const byBrand:  Record<string, number> = {};
  const byOrigin: Record<string, number> = {};
  for (const a of active) {
    byBrand[a.brand]              = (byBrand[a.brand]  ?? 0) + a.quantity;
    const origin = a.origin || "Sin dato";
    byOrigin[origin]              = (byOrigin[origin]   ?? 0) + a.quantity;
  }

  return {
    activeOrders: activeGroups.length,
    totalUnits:   active.reduce((s, a) => s + a.quantity, 0),
    nextDate:     next ? next.dateLabel : "—",
    overdueCount,
    byBrand,
    byOrigin,
  };
}
