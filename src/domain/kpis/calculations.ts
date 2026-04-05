/**
 * domain/kpis/calculations.ts
 *
 * Funciones PURAS de cálculo de KPIs.
 * Sin React. Sin Supabase. Sin efectos secundarios.
 * Input → Output. Testeables unitariamente.
 *
 * REGLA: Si una fórmula cambia, se cambia aquí y se propaga a toda la app.
 * No hay fórmulas inline en hooks ni componentes.
 *
 * ─── CONTRATOS GLOBALES (aplican a TODAS las funciones) ──────────────────────
 *
 * @contract division-by-zero
 *   Toda división por cero retorna 0. Nunca se retorna Infinity ni NaN.
 *
 * @contract percentages
 *   Todos los porcentajes se expresan en escala 0-100 (no 0-1).
 *   Ejemplo: margen del 40% = 40, no 0.4.
 *   Esto aplica a TODO el sistema — components, hooks y queries usan 0-100.
 *
 * @contract null-values
 *   Los valores nulos o undefined de la BD se convierten antes de llegar aquí:
 *   - Números nulos → 0 (vía toInt/toNum en normalize.ts)
 *   - Strings nulos → "" (vía trimStr en normalize.ts)
 *   Estas funciones asumen inputs numéricos ya normalizados.
 *
 * @contract negative-net-sales
 *   Si netSales llega negativo a una función de margen, se trata como 0
 *   (retorna 0). No se calculan márgenes sobre ventas negativas netas.
 */

/**
 * Margen bruto = (neto - costo) / neto × 100
 *
 * @contract negative-net-sales
 *   Si neto ≤ 0 (período con devoluciones > ventas, o sin ventas),
 *   retorna 0. No se calcula margen sobre base negativa o nula.
 */
export function calcGrossMargin(neto: number, cogs: number): number {
  if (neto <= 0) return 0;
  return ((neto - cogs) / neto) * 100;
}

/**
 * GMROI = Margen Bruto Anualizado / Valor Inventario
 * Fórmula: (margenBruto × 12/meses) / invValor
 *
 * @param grossMarginPesos  Margen bruto en Gs. (neto - costo)
 * @param invValue          Valor del inventario a costo (Gs.)
 * @param months            Meses transcurridos en el período
 */
export function calcGMROI(
  grossMarginPesos: number,
  invValue: number,
  months: number
): number {
  if (invValue === 0 || months === 0) return 0;
  return (grossMarginPesos * (12 / months)) / invValue;
}

/**
 * Rotación de Inventario = COGS Anualizado / Valor Inventario
 *
 * @param cogs      Costo de ventas del período
 * @param invValue  Valor del inventario a costo
 * @param months    Meses transcurridos
 */
export function calcInventoryTurnover(
  cogs: number,
  invValue: number,
  months: number
): number {
  if (invValue === 0 || months === 0) return 0;
  return (cogs * (12 / months)) / invValue;
}

/**
 * YoY (Year over Year) = (actual - anterior) / anterior × 100
 * Retorna 0 si el valor anterior es 0 (evita división por cero).
 */
export function calcYoY(current: number, prior: number): number {
  if (prior === 0) return 0;
  return ((current - prior) / prior) * 100;
}

/**
 * LfL (Like for Like) = mismo cálculo que YoY pero el caller es responsable
 * de que los períodos sean simétricos (mismos meses, mismos días).
 */
export const calcLfL = calcYoY;

/**
 * Clasifica la salud del margen bruto según umbrales configurables.
 * Acepta config opcional para inyección desde config remota.
 */
export type MarginHealth = "healthy" | "moderate" | "low";

import type { MarginConfig } from "@/domain/config/types";
import { DEFAULT_MARGIN_CONFIG } from "@/domain/config/defaults";

export function classifyMarginHealth(
  marginPct: number,
  channel: "b2b" | "b2c" | "total" = "total",
  config: MarginConfig = DEFAULT_MARGIN_CONFIG,
): MarginHealth {
  if (channel === "b2b") {
    if (marginPct >= config.b2bHealthy) return "healthy";
    if (marginPct >= config.b2bModerate) return "moderate";
    return "low";
  }
  // B2C y Total (Fénix)
  if (marginPct >= config.b2cHealthy) return "healthy";
  if (marginPct >= config.b2cModerate) return "moderate";
  return "low";
}

/** Returns the gauge zone boundaries for a channel */
export function marginHealthThresholds(
  channel: "b2b" | "b2c" | "total" = "total",
  config: MarginConfig = DEFAULT_MARGIN_CONFIG,
): { red: number; yellow: number } {
  if (channel === "b2b") return { red: config.b2bModerate, yellow: config.b2bHealthy };
  return { red: config.b2cModerate, yellow: config.b2cHealthy };
}

/**
 * Dependencia de Ofertas = descuentos / bruto × 100
 * Qué % del bruto se entregó como descuento.
 */
export function calcMarkdownDependency(dcto: number, bruto: number): number {
  if (bruto === 0) return 0;
  return (dcto / bruto) * 100;
}

/**
 * Tasa de Devoluciones = ABS(ventas negativas) / ventas positivas × 100
 * Spec de Derlys (26/02/2026):
 *   ABS(SUM(montos negativos)) / SUM(ventas positivas) × 100
 */
export function calcReturnsRate(
  absNegativeSales: number,
  positiveSales: number
): number {
  if (positiveSales === 0) return 0;
  return (Math.abs(absNegativeSales) / positiveSales) * 100;
}

/**
 * AOV (Average Order Value / Ticket Promedio)
 * = Venta Total / Cantidad de Facturas
 */
export function calcAOV(totalSales: number, totalTickets: number): number {
  if (totalTickets === 0) return 0;
  return totalSales / totalTickets;
}

/**
 * UPT (Units Per Transaction)
 * = Unidades Vendidas / Cantidad de Facturas
 */
export function calcUPT(totalUnits: number, totalTickets: number): number {
  if (totalTickets === 0) return 0;
  return totalUnits / totalTickets;
}

/**
 * Tendencia basada en cambio porcentual.
 * Considera la dirección positiva del KPI.
 */
export function calcTrend(
  changePct: number,
  positiveDirection: "up" | "down",
  threshold = 0.5
): "up" | "down" | "neutral" {
  if (Math.abs(changePct) < threshold) return "neutral";
  if (positiveDirection === "up")  return changePct > 0 ? "up" : "down";
  return changePct < 0 ? "up" : "down";
}

/**
 * Calcula cuántos días de cobertura tiene un SKU.
 * @param stock         Unidades en stock
 * @param avgDailySales Promedio de ventas diarias (puede ser mensual/30)
 */
export function calcCoverageDays(stock: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return stock > 0 ? 999 : 0;
  return Math.round(stock / avgDailySales);
}

/**
 * Clasifica riesgo de stock basado en días de cobertura vs lead time.
 */
export function classifyStockRisk(
  coverageDays: number,
  leadTimeDays: number
): "critical" | "low" | "balanced" | "overstock" {
  if (coverageDays <= 0)                     return "critical";
  if (coverageDays < leadTimeDays * 0.5)     return "critical";
  if (coverageDays < leadTimeDays)           return "low";
  if (coverageDays > leadTimeDays * 3)       return "overstock";
  return "balanced";
}

// ─── Funciones agregadas Sprint 2B ───────────────────────────────────────────
// Contratos definidos en domain/kpis/__tests__/fenix.contract.test.ts
// Fuente: "KPI FENIX.xlsx" — PST=1 (próximo sprint)

/**
 * EBITDA Contribución = Ingresos - COGS - Opex directos
 * No hay división — puede ser negativo si opex > margen bruto.
 *
 * @param neto  Ventas netas del período (Gs.)
 * @param cogs  Costo de ventas del período (Gs.)
 * @param opex  Gastos operativos directos: alquileres, RRHH, comisiones TC (Gs.)
 */
export function calcEBITDA(neto: number, cogs: number, opex: number): number {
  return neto - cogs - opex;
}

/**
 * Cumplimiento OTB = OTB ejecutado / OTB aprobado × 100
 * > 100%: sobre-ejecución. < 100%: sub-ejecución (alerta de stock).
 *
 * @param ejecutado  OTB ejecutado en el período
 * @param aprobado   OTB aprobado (presupuesto de compra)
 */
export function calcOTBCompliance(ejecutado: number, aprobado: number): number {
  if (aprobado === 0) return 0;
  return (ejecutado / aprobado) * 100;
}

/**
 * Sell-through = unidades vendidas / unidades recibidas × 100
 * Puede ser > 100% si se vende stock previo al período de recepción.
 *
 * @param vendidas   Unidades vendidas en el período
 * @param recibidas  Unidades recibidas/ingresadas en el período
 */
export function calcSellThrough(vendidas: number, recibidas: number): number {
  if (recibidas === 0) return 0;
  return (vendidas / recibidas) * 100;
}

/**
 * OOS Rate = SKU-store-days sin stock / SKU-store-days totales × 100
 *
 * @param oosSkuStoreDays    Días × SKU × tienda con stock = 0
 * @param totalSkuStoreDays  Días × SKU × tienda totales del período
 */
export function calcOOSRate(
  oosSkuStoreDays: number,
  totalSkuStoreDays: number
): number {
  if (totalSkuStoreDays === 0) return 0;
  return (oosSkuStoreDays / totalSkuStoreDays) * 100;
}

/**
 * DSO (Days Sales Outstanding) = Cuentas por cobrar / Ventas promedio diarias
 * Retorna días de cobranza. A menor DSO, más rápido se cobra.
 *
 * @param cxc            Saldo de cuentas por cobrar (Gs.)
 * @param avgDailySales  Ventas promedio diarias del período (Gs./día)
 */
export function calcDSO(cxc: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return 0;
  return cxc / avgDailySales;
}

/**
 * Tasa de Conversión = tickets / tráfico × 100
 * > 100% indica datos de tráfico incorrectos.
 *
 * @param tickets  Cantidad de transacciones (facturas)
 * @param traffic  Visitantes que ingresaron a la tienda
 */
export function calcConversionRate(tickets: number, traffic: number): number {
  if (traffic === 0) return 0;
  return (tickets / traffic) * 100;
}

/**
 * Uplift de Promo = (ventas promo - baseline) / baseline × 100
 * Mismo patrón que calcYoY pero aplicado a períodos promocionales.
 * Baseline = promedio de ventas en semanas comparables sin promo.
 *
 * @param ventasPromo  Ventas durante el período de promoción
 * @param baseline     Ventas esperadas sin promoción (semanas comparables)
 */
export function calcPromoUplift(ventasPromo: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((ventasPromo - baseline) / baseline) * 100;
}

/**
 * ROI de Promoción = ingresos incrementales / costo de la promo
 * Retorna un ratio (no porcentaje). ROI < 1 → promo a pérdida.
 *
 * @param ingresosIncrementales  Uplift en Gs. (ventas promo - baseline)
 * @param costoPromo             Costo total de la promo: descuentos + POSM + activación
 */
export function calcPromoROI(
  ingresosIncrementales: number,
  costoPromo: number
): number {
  if (costoPromo === 0) return 0;
  return ingresosIncrementales / costoPromo;
}
