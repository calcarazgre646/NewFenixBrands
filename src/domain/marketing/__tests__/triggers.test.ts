import { describe, it, expect } from "vitest";
import {
  evaluateInactivity,
  evaluateOverduePayment,
  evaluateReturn,
  evaluatePostPurchase,
  evaluateFirstPurchase,
  evaluateSecondPurchase,
  evaluateHighTicket,
  evaluateLowTicket,
  evaluateLowStock,
  shouldFireTrigger,
  matchCustomersToTrigger,
} from "../triggers";
import type { SamCustomer, SamTrigger } from "../types";

const NOW = new Date("2026-03-20T12:00:00Z");

// ─── evaluateInactivity ─────────────────────────────────────────────────────

describe("evaluateInactivity", () => {
  it("null lastPurchase → true (never purchased)", () => {
    expect(evaluateInactivity(null, 90, NOW)).toBe(true);
  });
  it("purchased 100 days ago, threshold 90 → true", () => {
    expect(evaluateInactivity("2025-12-11T00:00:00Z", 90, NOW)).toBe(true);
  });
  it("purchased 30 days ago, threshold 90 → false", () => {
    expect(evaluateInactivity("2026-02-18T00:00:00Z", 90, NOW)).toBe(false);
  });
  it("purchased exactly on threshold → true", () => {
    // 90 days before 2026-03-20 = 2025-12-21
    expect(evaluateInactivity("2025-12-20T12:00:00Z", 90, NOW)).toBe(true);
  });
});

// ─── evaluateOverduePayment ─────────────────────────────────────────────────

describe("evaluateOverduePayment", () => {
  it("has pending + amount > 0 → true", () => {
    expect(evaluateOverduePayment(true, 500000)).toBe(true);
  });
  it("no pending → false", () => {
    expect(evaluateOverduePayment(false, 500000)).toBe(false);
  });
  it("pending but amount = 0 → false", () => {
    expect(evaluateOverduePayment(true, 0)).toBe(false);
  });
});

// ─── evaluateReturn ─────────────────────────────────────────────────────────

describe("evaluateReturn", () => {
  it("true → true", () => expect(evaluateReturn(true)).toBe(true));
  it("false → false", () => expect(evaluateReturn(false)).toBe(false));
});

// ─── evaluatePostPurchase ───────────────────────────────────────────────────

describe("evaluatePostPurchase", () => {
  it("null lastPurchase → false", () => {
    expect(evaluatePostPurchase(null, 7, NOW)).toBe(false);
  });
  it("purchased 3 days ago, within 7 → true", () => {
    expect(evaluatePostPurchase("2026-03-17T00:00:00Z", 7, NOW)).toBe(true);
  });
  it("purchased 10 days ago, within 7 → false", () => {
    expect(evaluatePostPurchase("2026-03-10T00:00:00Z", 7, NOW)).toBe(false);
  });
  it("purchased today → true", () => {
    expect(evaluatePostPurchase("2026-03-20T00:00:00Z", 7, NOW)).toBe(true);
  });
});

// ─── evaluateFirstPurchase ──────────────────────────────────────────────────

describe("evaluateFirstPurchase", () => {
  it("1 purchase → true", () => expect(evaluateFirstPurchase(1)).toBe(true));
  it("0 purchases → false", () => expect(evaluateFirstPurchase(0)).toBe(false));
  it("2 purchases → false", () => expect(evaluateFirstPurchase(2)).toBe(false));
});

// ─── evaluateSecondPurchase ─────────────────────────────────────────────────

describe("evaluateSecondPurchase", () => {
  it("2 purchases → true", () => expect(evaluateSecondPurchase(2)).toBe(true));
  it("1 purchase → false", () => expect(evaluateSecondPurchase(1)).toBe(false));
  it("3 purchases → false", () => expect(evaluateSecondPurchase(3)).toBe(false));
});

// ─── evaluateHighTicket ─────────────────────────────────────────────────────

describe("evaluateHighTicket", () => {
  it("last > avg → true", () => expect(evaluateHighTicket(200000, 150000)).toBe(true));
  it("last = avg → false", () => expect(evaluateHighTicket(150000, 150000)).toBe(false));
  it("last < avg → false", () => expect(evaluateHighTicket(100000, 150000)).toBe(false));
  it("avg = 0 → false", () => expect(evaluateHighTicket(100000, 0)).toBe(false));
});

// ─── evaluateLowTicket ──────────────────────────────────────────────────────

describe("evaluateLowTicket", () => {
  it("last < avg × 0.5 → true", () => expect(evaluateLowTicket(50000, 200000)).toBe(true));
  it("last = avg × 0.5 → false", () => expect(evaluateLowTicket(100000, 200000)).toBe(false));
  it("last > avg × 0.5 → false", () => expect(evaluateLowTicket(150000, 200000)).toBe(false));
  it("avg = 0 → false", () => expect(evaluateLowTicket(50000, 0)).toBe(false));
  it("custom threshold 0.3", () => expect(evaluateLowTicket(50000, 200000, 0.3)).toBe(true));
});

// ─── evaluateLowStock ───────────────────────────────────────────────────────

describe("evaluateLowStock", () => {
  it("quantity < threshold → true", () => expect(evaluateLowStock(5, 10)).toBe(true));
  it("quantity = threshold → false", () => expect(evaluateLowStock(10, 10)).toBe(false));
  it("quantity > threshold → false", () => expect(evaluateLowStock(15, 10)).toBe(false));
});

// ─── shouldFireTrigger ──────────────────────────────────────────────────────

describe("shouldFireTrigger", () => {
  it("inactive trigger → false", () => {
    expect(shouldFireTrigger({ isActive: false, frequencyCap: 1, lastFiredAt: null }, NOW)).toBe(false);
  });
  it("never fired + active → true", () => {
    expect(shouldFireTrigger({ isActive: true, frequencyCap: 1, lastFiredAt: null }, NOW)).toBe(true);
  });
  it("fired yesterday, cap 1 day → true", () => {
    expect(shouldFireTrigger({ isActive: true, frequencyCap: 1, lastFiredAt: "2026-03-19T12:00:00Z" }, NOW)).toBe(true);
  });
  it("fired today, cap 1 day → false", () => {
    expect(shouldFireTrigger({ isActive: true, frequencyCap: 1, lastFiredAt: "2026-03-20T00:00:00Z" }, NOW)).toBe(false);
  });
  it("fired 5 days ago, cap 7 → false", () => {
    expect(shouldFireTrigger({ isActive: true, frequencyCap: 7, lastFiredAt: "2026-03-15T12:00:00Z" }, NOW)).toBe(false);
  });
  it("fired 7 days ago, cap 7 → true", () => {
    expect(shouldFireTrigger({ isActive: true, frequencyCap: 7, lastFiredAt: "2026-03-13T12:00:00Z" }, NOW)).toBe(true);
  });
});

// ─── matchCustomersToTrigger ────────────────────────────────────────────────

describe("matchCustomersToTrigger", () => {
  const baseCustomer: SamCustomer = {
    id: "c1",
    erpCode: "C001",
    ruc: "80000001-0",
    razonSocial: "Test SA",
    phone: null,
    email: null,
    tipoCliente: null,
    tier: "inactive",
    totalSpent: 0,
    purchaseCount: 0,
    avgTicket: 0,
    lastPurchase: null,
    hasPendingDebt: false,
    pendingAmount: 0,
    fechaIngreso: null,
    codeCount: 1,
    syncedAt: "",
    createdAt: "",
    updatedAt: "",
  };

  const baseTrigger: SamTrigger = {
    id: "t1",
    name: "Test",
    category: "inactivity",
    description: null,
    channel: "email",
    templateId: null,
    campaignId: null,
    conditions: { inactivityDays: 90 },
    frequencyCap: 1,
    priority: 5,
    isActive: true,
    fireCount: 0,
    lastFiredAt: null,
    createdAt: "",
    updatedAt: "",
  };

  it("inactivity trigger: matches customers without recent purchase", () => {
    const customers = [
      { ...baseCustomer, id: "c1", lastPurchase: null },
      { ...baseCustomer, id: "c2", lastPurchase: "2026-03-10T00:00:00Z" },
      { ...baseCustomer, id: "c3", lastPurchase: "2025-01-01T00:00:00Z" },
    ];
    const matched = matchCustomersToTrigger(customers, baseTrigger, NOW);
    expect(matched.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("overdue trigger: matches customers with pending debt", () => {
    const trigger = { ...baseTrigger, category: "overdue" as const };
    const customers = [
      { ...baseCustomer, id: "c1", hasPendingDebt: true, pendingAmount: 500000 },
      { ...baseCustomer, id: "c2", hasPendingDebt: false, pendingAmount: 0 },
    ];
    const matched = matchCustomersToTrigger(customers, trigger, NOW);
    expect(matched.map((c) => c.id)).toEqual(["c1"]);
  });

  it("first_purchase trigger: matches customers with exactly 1 purchase", () => {
    const trigger = { ...baseTrigger, category: "first_purchase" as const };
    const customers = [
      { ...baseCustomer, id: "c1", purchaseCount: 1 },
      { ...baseCustomer, id: "c2", purchaseCount: 0 },
      { ...baseCustomer, id: "c3", purchaseCount: 2 },
    ];
    const matched = matchCustomersToTrigger(customers, trigger, NOW);
    expect(matched.map((c) => c.id)).toEqual(["c1"]);
  });

  it("return trigger: always returns empty (requires external data)", () => {
    const trigger = { ...baseTrigger, category: "return" as const };
    const matched = matchCustomersToTrigger([baseCustomer], trigger, NOW);
    expect(matched).toHaveLength(0);
  });

  it("low_stock trigger: always returns empty (requires inventory data)", () => {
    const trigger = { ...baseTrigger, category: "low_stock" as const };
    const matched = matchCustomersToTrigger([baseCustomer], trigger, NOW);
    expect(matched).toHaveLength(0);
  });
});
