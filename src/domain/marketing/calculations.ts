/**
 * domain/marketing/calculations.ts
 *
 * Funciones PURAS de cálculo de métricas de marketing.
 * Sin React. Sin Supabase. Sin efectos secundarios.
 *
 * @contract division-by-zero
 *   Toda división por cero retorna 0. Nunca Infinity ni NaN.
 *
 * @contract percentages
 *   Porcentajes en escala 0-100.
 */
import type { CustomerTier } from "./types";

/** Open rate = (opened / delivered) × 100 */
export function calcOpenRate(opened: number, delivered: number): number {
  if (delivered === 0) return 0;
  return (opened / delivered) * 100;
}

/** Click rate = (clicked / delivered) × 100 */
export function calcClickRate(clicked: number, delivered: number): number {
  if (delivered === 0) return 0;
  return (clicked / delivered) * 100;
}

/** Conversion rate = (converted / sent) × 100 */
export function calcConversionRate(converted: number, sent: number): number {
  if (sent === 0) return 0;
  return (converted / sent) * 100;
}

/** CAC = totalCost / newCustomers */
export function calcCAC(totalCost: number, newCustomers: number): number {
  if (newCustomers === 0) return 0;
  return totalCost / newCustomers;
}

/** LTV = avgTicket × purchasesPerYear × lifespanYears */
export function calcLTV(
  avgTicket: number,
  purchasesPerYear: number,
  lifespanYears: number,
): number {
  return avgTicket * purchasesPerYear * lifespanYears;
}

/** ROAS = revenue / adSpend */
export function calcROAS(revenue: number, adSpend: number): number {
  if (adSpend === 0) return 0;
  return revenue / adSpend;
}

/** Recurrence rate = (repeatCustomers / totalCustomers) × 100 */
export function calcRecurrence(
  repeatCustomers: number,
  totalCustomers: number,
): number {
  if (totalCustomers === 0) return 0;
  return (repeatCustomers / totalCustomers) * 100;
}

/**
 * Clasifica un cliente en tier según su comportamiento de compra.
 *
 * VIP:        gastó ≥ 10M Gs. Y compró ≥ 10 veces Y última compra < 90 días
 * Frequent:   compró ≥ 5 veces Y última compra < 180 días
 * Occasional: compró ≥ 1 vez Y última compra < 365 días
 * At Risk:    compró ≥ 1 vez PERO última compra ≥ 365 días
 * Inactive:   nunca compró
 */
export function classifyCustomerTier(
  totalSpent: number,
  purchaseCount: number,
  daysSinceLastPurchase: number | null,
): CustomerTier {
  if (purchaseCount === 0 || daysSinceLastPurchase === null) return "inactive";

  if (totalSpent >= 10_000_000 && purchaseCount >= 10 && daysSinceLastPurchase < 90) {
    return "vip";
  }
  if (purchaseCount >= 5 && daysSinceLastPurchase < 180) {
    return "frequent";
  }
  if (daysSinceLastPurchase < 365) {
    return "occasional";
  }
  return "at_risk";
}
