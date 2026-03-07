/**
 * domain/logistics/arrivals.ts
 *
 * Funciones puras para procesar datos de importación.
 * No React, no side effects.
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

function getDaysUntil(date: Date | null): number {
  if (!date) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getArrivalStatus(date: Date | null): ArrivalStatus {
  if (!date) return "upcoming";
  const now  = new Date();
  const bom  = new Date(now.getFullYear(), now.getMonth(), 1);
  const bonm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const bo2m = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  if (date < bom)  return "past";
  if (date < bonm) return "this_month";
  if (date < bo2m) return "next_month";
  return "upcoming";
}

export function statusLabel(status: ArrivalStatus, daysUntil: number): string {
  if (status === "past")       return "Pasado";
  if (status === "this_month") return daysUntil <= 0 ? "Este Mes" : `Este Mes · ${daysUntil}d`;
  if (status === "next_month") return `Prox. Mes · ${daysUntil}d`;
  return daysUntil < 999 ? `En ${daysUntil}d` : "Proximo";
}

// ─── Transform imports → arrivals ────────────────────────────────────────────

export function toArrivals(rows: LogisticsImport[]): LogisticsArrival[] {
  return rows
    .filter(r => {
      const m = r.brand.toLowerCase();
      return KNOWN_BRANDS.has(m) && (r.eta || r.etaLabel);
    })
    .map(r => {
      const status    = getArrivalStatus(r.eta);
      const daysUntil = getDaysUntil(r.eta);
      const dateLabel = r.eta
        ? r.eta.toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })
        : r.etaLabel || "—";
      return {
        ...r,
        status,
        daysUntil,
        dateLabel,
        brandNorm: r.brand.toLowerCase(),
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
    const k = [a.brandNorm, a.supplier, a.etaLabel].join("|||");
    const bucket = map.get(k) ?? [];
    bucket.push(a);
    map.set(k, bucket);
  }

  return [...map.values()].map(rows => {
    const f = rows[0];
    return {
      key:        [f.brandNorm, f.supplier, f.etaLabel].join("|||"),
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
  const activeGroups = groups.filter(g => g.status !== "past");
  const active       = arrivals.filter(a => a.status !== "past");
  const next         = active.find(a => a.eta != null);

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
    byBrand,
    byOrigin,
  };
}
