/**
 * domain/salesPulse/types.ts
 *
 * Tipos del payload del Sales Pulse Semanal.
 * Espejo del jsonb que devuelve la RPC compute_sales_pulse en BD data/ERP.
 * Los campos numéricos vienen ya normalizados (0 cuando nulos).
 */

export interface SalesPulseSales {
  netoWeek: number;
  unitsWeek: number;
  netoPrevWeek: number;
  netoYearAgo: number;
  /** WoW % en escala 0-100. null cuando no hay base de comparación. */
  wowPct: number | null;
  /** YoY % en escala 0-100. null cuando no hay base de comparación. */
  yoyPct: number | null;
}

export interface SalesPulseMonthly {
  monthLabel: string;
  monthActual: number;
  monthTarget: number;
  /** % de cumplimiento (0-100). null cuando target=0. */
  monthProgressPct: number | null;
  daysElapsed: number;
  daysInMonth: number;
  /** Proyección lineal al cierre del mes. */
  runRateProjection: number;
  gapToTarget: number;
}

export interface BrandMover {
  name: string;
  neto: number;
  netoPrev: number;
  /** WoW % en escala 0-100. null si la base previa fue 0. */
  wowPct: number | null;
}

export interface SkuMover {
  sku: string;
  description: string;
  brand: string;
  units: number;
  neto: number;
}

export interface StoreMover {
  store: string;
  channel: "B2C" | "B2B";
  neto: number;
  netoPrev: number;
  wowPct: number | null;
}

export interface SalesPulseMovers {
  brands: BrandMover[];
  skus: SkuMover[];
  stores: StoreMover[];
}

export interface NoveltyExample {
  sku: string;
  description: string;
  brand: string;
  /** Unidades sin distribuir (residentes en STOCK/RETAILS). */
  units: number;
}

export interface LowSthExample {
  sku: string;
  description: string;
  brand: string;
  unitsReceived: number;
  /** sell-through 0-100. */
  sthPct: number;
}

export interface DsoSnapshot {
  /** Días al corte de la semana. null si no hay base (ventas 30d=0). */
  currentDays: number | null;
  /** Días al corte de hace 4 semanas. null si no hay base. */
  fourWeeksAgoDays: number | null;
  cxcCurrent: number;
  cxcFourWeeksAgo: number;
}

export interface SalesPulseAlerts {
  noveltyUndistributed: { count: number; examples: NoveltyExample[] };
  lowSellThrough30d:    { count: number; examples: LowSthExample[] };
  dso:                  DsoSnapshot;
}

export interface FreshnessSource {
  sourceName: string;
  refreshedAt: string;     // ISO timestamptz
  status: string;
}

export interface SalesPulseFreshness {
  sources: FreshnessSource[];
  /** Última fecha con datos en mv_ventas_diarias. */
  maxDataDate: string | null;
}

export interface SalesPulsePayload {
  weekStart: string;       // YYYY-MM-DD (lunes)
  weekEnd:   string;       // YYYY-MM-DD (domingo)
  isoWeek:   number;
  year:      number;
  sales:     SalesPulseSales;
  monthly:   SalesPulseMonthly;
  movers:    SalesPulseMovers;
  alerts:    SalesPulseAlerts;
  freshness: SalesPulseFreshness;
}

/** Origen del envío. */
export type PulseTrigger = "cron" | "manual";

/** Estado del audit log de un run. */
export type PulseRunStatus = "pending" | "sent" | "failed" | "partial";
