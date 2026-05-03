/**
 * domain/salesPulse/narrative.ts
 *
 * Funciones PURAS de:
 *   1. Parser jsonb crudo del RPC → SalesPulsePayload tipado.
 *   2. Generadores de copy para los 5 bloques del email.
 *
 * Sin React, sin DOM, sin fetch. Todo testeable input→output.
 */

import type {
  BrandMover,
  DsoSnapshot,
  FreshnessSource,
  LowSthExample,
  NoveltyExample,
  SalesPulseAlerts,
  SalesPulseFreshness,
  SalesPulseMonthly,
  SalesPulseMovers,
  SalesPulsePayload,
  SalesPulseSales,
  SkuMover,
  StoreMover,
} from "./types";

// ─── Helpers numéricos defensivos ───────────────────────────────────────────

function toNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStr(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

// ─── Parser jsonb → payload tipado ──────────────────────────────────────────

/**
 * Convierte el jsonb crudo retornado por compute_sales_pulse en el shape
 * tipado. Defensivo: si falta una clave, retorna un objeto vacío seguro
 * (count=0, examples=[], sales en cero).
 */
export function parsePulsePayload(raw: unknown): SalesPulsePayload {
  const r = (raw ?? {}) as Record<string, unknown>;

  return {
    weekStart: toStr(r.week_start),
    weekEnd:   toStr(r.week_end),
    isoWeek:   toNum(r.iso_week),
    year:      toNum(r.year),
    sales:     parseSales(r.sales),
    monthly:   parseMonthly(r.monthly),
    movers:    parseMovers(r.movers),
    alerts:    parseAlerts(r.alerts),
    freshness: parseFreshness(r.freshness),
  };
}

function parseSales(raw: unknown): SalesPulseSales {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    netoWeek:      toNum(r.neto_week),
    unitsWeek:     toNum(r.units_week),
    netoPrevWeek:  toNum(r.neto_prev_week),
    netoYearAgo:   toNum(r.neto_year_ago),
    wowPct:        toNullableNum(r.wow_pct),
    yoyPct:        toNullableNum(r.yoy_pct),
  };
}

function parseMonthly(raw: unknown): SalesPulseMonthly {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    monthLabel:        toStr(r.month_label),
    monthActual:       toNum(r.month_actual),
    monthTarget:       toNum(r.month_target),
    monthProgressPct:  toNullableNum(r.month_progress_pct),
    daysElapsed:       toNum(r.days_elapsed),
    daysInMonth:       toNum(r.days_in_month),
    runRateProjection: toNum(r.run_rate_projection),
    gapToTarget:       toNum(r.gap_to_target),
  };
}

function parseMovers(raw: unknown): SalesPulseMovers {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    brands: asArray(r.brands).map(parseBrandMover),
    skus:   asArray(r.skus).map(parseSkuMover),
    stores: asArray(r.stores).map(parseStoreMover),
  };
}

function parseBrandMover(raw: unknown): BrandMover {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    name:     toStr(r.name),
    neto:     toNum(r.neto),
    netoPrev: toNum(r.neto_prev),
    wowPct:   toNullableNum(r.wow_pct),
  };
}

function parseSkuMover(raw: unknown): SkuMover {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    sku:         toStr(r.sku),
    description: toStr(r.description) || toStr(r.sku),
    brand:       toStr(r.brand),
    units:       toNum(r.units),
    neto:        toNum(r.neto),
  };
}

function parseStoreMover(raw: unknown): StoreMover {
  const r = (raw ?? {}) as Record<string, unknown>;
  const channel = toStr(r.channel) === "B2B" ? "B2B" : "B2C";
  return {
    store:    toStr(r.store),
    channel,
    neto:     toNum(r.neto),
    netoPrev: toNum(r.neto_prev),
    wowPct:   toNullableNum(r.wow_pct),
  };
}

function parseAlerts(raw: unknown): SalesPulseAlerts {
  const r = (raw ?? {}) as Record<string, unknown>;
  const novelty = (r.novelty_undistributed ?? {}) as Record<string, unknown>;
  const lowSth  = (r.low_sell_through_30d ?? {}) as Record<string, unknown>;
  return {
    noveltyUndistributed: {
      count:    toNum(novelty.count),
      examples: asArray(novelty.examples).map(parseNoveltyExample),
    },
    lowSellThrough30d: {
      count:    toNum(lowSth.count),
      examples: asArray(lowSth.examples).map(parseLowSthExample),
    },
    dso: parseDso(r.dso),
  };
}

function parseNoveltyExample(raw: unknown): NoveltyExample {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    sku:         toStr(r.sku),
    description: toStr(r.description) || toStr(r.sku),
    brand:       toStr(r.brand),
    units:       toNum(r.units),
  };
}

function parseLowSthExample(raw: unknown): LowSthExample {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    sku:           toStr(r.sku),
    description:   toStr(r.description) || toStr(r.sku),
    brand:         toStr(r.brand),
    unitsReceived: toNum(r.units_received),
    sthPct:        toNum(r.sth_pct),
  };
}

function parseDso(raw: unknown): DsoSnapshot {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    currentDays:        toNullableNum(r.current_days),
    fourWeeksAgoDays:   toNullableNum(r.four_weeks_ago_days),
    cxcCurrent:         toNum(r.cxc_current),
    cxcFourWeeksAgo:    toNum(r.cxc_four_weeks_ago),
  };
}

function parseFreshness(raw: unknown): SalesPulseFreshness {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    sources:     asArray(r.sources).map(parseFreshnessSource),
    maxDataDate: r.max_data_date ? toStr(r.max_data_date) : null,
  };
}

function parseFreshnessSource(raw: unknown): FreshnessSource {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    sourceName:  toStr(r.source_name),
    refreshedAt: toStr(r.refreshed_at),
    status:      toStr(r.status),
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ─── Generadores de copy ────────────────────────────────────────────────────

const PYG_FORMATTER = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

/**
 * Formatea un monto en guaraníes con separador de miles paraguayo.
 * Usa "Gs." como prefijo (forma corta de "₲" usada en el ERP del cliente).
 */
export function formatPyg(value: number): string {
  return `Gs. ${PYG_FORMATTER.format(Math.round(value))}`;
}

/**
 * Formatea un % con 1 decimal y signo. Para deltas. null → '—'.
 */
export function formatDelta(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "▲ +" : pct < 0 ? "▼ " : "= ";
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Headline de la semana. "Semana 18 (28 abr – 4 may): Gs.X · ▲ +5% WoW · ▲ +12% YoY".
 * Las fechas se formatean en español corto (DD MMM).
 */
export function buildHeadline(p: SalesPulsePayload): string {
  const start = formatDateShort(p.weekStart);
  const end   = formatDateShort(p.weekEnd);
  const wow   = p.sales.wowPct === null ? "" : ` · ${formatDelta(p.sales.wowPct)} WoW`;
  const yoy   = p.sales.yoyPct === null ? "" : ` · ${formatDelta(p.sales.yoyPct)} YoY`;
  return `Semana ${p.isoWeek} (${start} – ${end}): ${formatPyg(p.sales.netoWeek)}${wow}${yoy}`;
}

const MES_CORTO = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export function formatDateShort(iso: string): string {
  // ISO date "YYYY-MM-DD" → "DD MMM" en español.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = parseInt(m[2], 10) - 1;
  const day   = parseInt(m[3], 10);
  return `${day} ${MES_CORTO[month] ?? ""}`.trim();
}

/**
 * Etiqueta del momentum semanal a partir de WoW%. Usa thresholds explícitos:
 *   ≥ +20 → "se disparó"
 *   ≥ +5  → "creció"
 *   > -5  → "se mantuvo"
 *   > -20 → "cayó"
 *   ≤ -20 → "se desplomó"
 */
export function classifyMomentum(wowPct: number | null): string {
  if (wowPct === null) return "sin base de comparación";
  if (wowPct >= 20)  return "se disparó";
  if (wowPct >= 5)   return "creció";
  if (wowPct > -5)   return "se mantuvo";
  if (wowPct > -20)  return "cayó";
  return "se desplomó";
}

/**
 * Texto de cumplimiento mensual: "Mayo 2026: 71% del target · proyectamos
 * cerrar en Gs.X (faltan Gs.Y)". Si target=0 → "sin meta cargada".
 */
export function buildMonthlyLine(m: SalesPulseMonthly): string {
  if (m.monthTarget <= 0) {
    return `${m.monthLabel}: ${formatPyg(m.monthActual)} acumulado · sin meta cargada`;
  }
  const pct = m.monthProgressPct ?? 0;
  const gap = m.gapToTarget > 0
    ? ` · faltan ${formatPyg(m.gapToTarget)} para llegar`
    : ` · proyectamos superar la meta`;
  return `${m.monthLabel}: ${pct.toFixed(0)}% del target · ` +
         `proyección de cierre ${formatPyg(m.runRateProjection)}${gap}`;
}

/**
 * "Stale" si la fuente más rezagada se refrescó hace más de 24h.
 * Devuelve `{ stale, hours, lastRefresh }`.
 */
export function freshnessAge(freshness: SalesPulseFreshness, now: Date): {
  stale: boolean;
  hoursAgo: number;
  lastRefresh: string | null;
} {
  if (freshness.sources.length === 0) {
    return { stale: true, hoursAgo: Infinity, lastRefresh: null };
  }
  const oldest = freshness.sources.reduce<string>(
    (acc, s) => (acc === "" || s.refreshedAt < acc ? s.refreshedAt : acc),
    "",
  );
  const ts = Date.parse(oldest);
  if (!Number.isFinite(ts)) return { stale: true, hoursAgo: Infinity, lastRefresh: oldest || null };
  const hoursAgo = Math.max(0, (now.getTime() - ts) / 3_600_000);
  return { stale: hoursAgo > 24, hoursAgo, lastRefresh: oldest };
}
