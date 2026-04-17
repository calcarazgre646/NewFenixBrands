/**
 * domain/marketing/triggers.ts
 *
 * Evaluadores PUROS de triggers de marketing.
 * Sin React. Sin Supabase. Sin efectos secundarios.
 *
 * Cada función evalúa una condición específica contra datos del cliente.
 */
import type { SamCustomer, SamTrigger } from "./types";

/** Cliente inactivo si no compró en los últimos N días */
export function evaluateInactivity(
  lastPurchase: string | null,
  inactivityDays: number,
  now: Date = new Date(),
): boolean {
  if (!lastPurchase) return true; // nunca compró = inactivo
  const last = new Date(lastPurchase);
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= inactivityDays;
}

/** Cliente tiene deuda pendiente */
export function evaluateOverduePayment(
  hasPending: boolean,
  pendingAmount: number,
): boolean {
  return hasPending && pendingAmount > 0;
}

/** Cliente tiene devolución en el período */
export function evaluateReturn(hasReturnInPeriod: boolean): boolean {
  return hasReturnInPeriod;
}

/** Post-compra: última compra fue hace ≤ N días */
export function evaluatePostPurchase(
  lastPurchase: string | null,
  withinDays: number,
  now: Date = new Date(),
): boolean {
  if (!lastPurchase) return false;
  const last = new Date(lastPurchase);
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= withinDays;
}

/** Primera compra: exactamente 1 compra */
export function evaluateFirstPurchase(totalPurchases: number): boolean {
  return totalPurchases === 1;
}

/** Segunda compra: exactamente 2 compras */
export function evaluateSecondPurchase(totalPurchases: number): boolean {
  return totalPurchases === 2;
}

/** Ticket alto: última compra > promedio del cliente */
export function evaluateHighTicket(lastTicket: number, avgTicket: number): boolean {
  if (avgTicket === 0) return false;
  return lastTicket > avgTicket;
}

/** Ticket bajo: última compra < avgTicket × threshold (ej: 0.5) */
export function evaluateLowTicket(
  lastTicket: number,
  avgTicket: number,
  threshold: number = 0.5,
): boolean {
  if (avgTicket === 0) return false;
  return lastTicket < avgTicket * threshold;
}

/** Stock bajo: cantidad < umbral */
export function evaluateLowStock(quantity: number, threshold: number): boolean {
  return quantity < threshold;
}

/**
 * Determina si un trigger debería dispararse basado en frequency cap.
 * El trigger no debe dispararse si fue disparado más recientemente que
 * el frequency cap (en días).
 */
export function shouldFireTrigger(
  trigger: Pick<SamTrigger, "isActive" | "frequencyCap" | "lastFiredAt">,
  now: Date = new Date(),
): boolean {
  if (!trigger.isActive) return false;
  if (!trigger.lastFiredAt) return true;

  const lastFired = new Date(trigger.lastFiredAt);
  const diffDays = Math.floor((now.getTime() - lastFired.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= trigger.frequencyCap;
}

/**
 * Evalúa qué clientes matchean un trigger dado (dry run).
 * Solo evalúa las condiciones del trigger contra cada cliente.
 * No dispara nada, solo retorna los clientes que matchean.
 */
export function matchCustomersToTrigger(
  customers: SamCustomer[],
  trigger: SamTrigger,
  now: Date = new Date(),
): SamCustomer[] {
  const { category, conditions } = trigger;

  return customers.filter((customer) => {
    switch (category) {
      case "inactivity":
        return evaluateInactivity(
          customer.lastPurchase,
          conditions.inactivityDays ?? 90,
          now,
        );
      case "overdue":
        return evaluateOverduePayment(
          customer.hasPendingDebt,
          customer.pendingAmount,
        );
      case "post_purchase":
        return evaluatePostPurchase(
          customer.lastPurchase,
          conditions.withinDays ?? 7,
          now,
        );
      case "first_purchase":
        return evaluateFirstPurchase(customer.purchaseCount);
      case "second_purchase":
        return evaluateSecondPurchase(customer.purchaseCount);
      case "high_ticket":
        return evaluateHighTicket(
          customer.avgTicket,
          conditions.ticketThreshold ?? customer.avgTicket,
        );
      case "low_ticket":
        return evaluateLowTicket(
          customer.avgTicket,
          conditions.ticketThreshold ?? customer.avgTicket,
          0.5,
        );
      case "return":
        // Return evaluation requires external data (not in SamCustomer)
        // Always false in dry run — requires execution context
        return false;
      case "low_stock":
        // Low stock evaluation requires inventory data (not in SamCustomer)
        // Always false in dry run — requires execution context
        return false;
      default:
        return false;
    }
  });
}
