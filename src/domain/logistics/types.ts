/**
 * domain/logistics/types.ts
 *
 * Tipos del dominio de logística / importaciones.
 * Trabaja sobre LogisticsImport de queries/logistics.queries.ts.
 */
import type { LogisticsImport } from "@/queries/logistics.queries";

export type ArrivalStatus = "overdue" | "past" | "this_month" | "next_month" | "upcoming";

export interface LogisticsArrival extends LogisticsImport {
  status:    ArrivalStatus;
  daysUntil: number;
  dateLabel: string;
  brandNorm: string;
  /** Fecha ISO normalizada para grouping key (evita inconsistencias de formato BD) */
  etaKey:    string;
}

export interface LogisticsGroup {
  key:         string;
  rows:        LogisticsArrival[];
  totalUnits:  number;
  brand:       string;
  supplier:    string;
  origin:      string;
  categories:  string[];
  status:      ArrivalStatus;
  daysUntil:   number;
  dateLabel:   string;
  brandNorm:   string;
}

export interface LogisticsSummary {
  activeOrders: number;
  totalUnits:   number;
  nextDate:     string;
  /** Embarques con ETA vencida (dentro del mes actual pero ya pasaron) */
  overdueCount: number;
  byBrand:      Record<string, number>;
  byOrigin:     Record<string, number>;
}
