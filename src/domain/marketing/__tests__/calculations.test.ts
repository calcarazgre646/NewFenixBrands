import { describe, it, expect } from "vitest";
import {
  calcOpenRate,
  calcClickRate,
  calcConversionRate,
  calcCAC,
  calcLTV,
  calcROAS,
  calcRecurrence,
  classifyCustomerTier,
} from "../calculations";

// ─── calcOpenRate ───────────────────────────────────────────────────────────

describe("calcOpenRate", () => {
  it("div por 0: calcOpenRate(10, 0) → 0", () => expect(calcOpenRate(10, 0)).toBe(0));
  it("calcOpenRate(25, 100) → 25", () => expect(calcOpenRate(25, 100)).toBe(25));
  it("calcOpenRate(0, 100) → 0", () => expect(calcOpenRate(0, 100)).toBe(0));
  it("calcOpenRate(100, 100) → 100", () => expect(calcOpenRate(100, 100)).toBe(100));
  it("calcOpenRate(50, 200) → 25", () => expect(calcOpenRate(50, 200)).toBe(25));
});

// ─── calcClickRate ──────────────────────────────────────────────────────────

describe("calcClickRate", () => {
  it("div por 0: calcClickRate(5, 0) → 0", () => expect(calcClickRate(5, 0)).toBe(0));
  it("calcClickRate(10, 100) → 10", () => expect(calcClickRate(10, 100)).toBe(10));
  it("calcClickRate(0, 50) → 0", () => expect(calcClickRate(0, 50)).toBe(0));
  it("calcClickRate(3, 200) → 1.5", () => expect(calcClickRate(3, 200)).toBe(1.5));
});

// ─── calcConversionRate ─────────────────────────────────────────────────────

describe("calcConversionRate", () => {
  it("div por 0: calcConversionRate(5, 0) → 0", () => expect(calcConversionRate(5, 0)).toBe(0));
  it("calcConversionRate(10, 100) → 10", () => expect(calcConversionRate(10, 100)).toBe(10));
  it("calcConversionRate(0, 100) → 0", () => expect(calcConversionRate(0, 100)).toBe(0));
  it("calcConversionRate(100, 100) → 100", () => expect(calcConversionRate(100, 100)).toBe(100));
});

// ─── calcCAC ────────────────────────────────────────────────────────────────

describe("calcCAC", () => {
  it("div por 0: calcCAC(1000, 0) → 0", () => expect(calcCAC(1000, 0)).toBe(0));
  it("calcCAC(10000, 10) → 1000", () => expect(calcCAC(10000, 10)).toBe(1000));
  it("calcCAC(0, 10) → 0", () => expect(calcCAC(0, 10)).toBe(0));
});

// ─── calcLTV ────────────────────────────────────────────────────────────────

describe("calcLTV", () => {
  it("calcLTV(500000, 4, 3) → 6000000", () => expect(calcLTV(500000, 4, 3)).toBe(6000000));
  it("calcLTV(0, 4, 3) → 0", () => expect(calcLTV(0, 4, 3)).toBe(0));
  it("calcLTV(500000, 0, 3) → 0", () => expect(calcLTV(500000, 0, 3)).toBe(0));
  it("calcLTV(500000, 4, 0) → 0", () => expect(calcLTV(500000, 4, 0)).toBe(0));
});

// ─── calcROAS ───────────────────────────────────────────────────────────────

describe("calcROAS", () => {
  it("div por 0: calcROAS(1000, 0) → 0", () => expect(calcROAS(1000, 0)).toBe(0));
  it("calcROAS(5000, 1000) → 5", () => expect(calcROAS(5000, 1000)).toBe(5));
  it("calcROAS(0, 1000) → 0", () => expect(calcROAS(0, 1000)).toBe(0));
  it("calcROAS(500, 1000) → 0.5 (loss)", () => expect(calcROAS(500, 1000)).toBe(0.5));
});

// ─── calcRecurrence ─────────────────────────────────────────────────────────

describe("calcRecurrence", () => {
  it("div por 0: calcRecurrence(5, 0) → 0", () => expect(calcRecurrence(5, 0)).toBe(0));
  it("calcRecurrence(30, 100) → 30", () => expect(calcRecurrence(30, 100)).toBe(30));
  it("calcRecurrence(0, 100) → 0", () => expect(calcRecurrence(0, 100)).toBe(0));
  it("calcRecurrence(100, 100) → 100", () => expect(calcRecurrence(100, 100)).toBe(100));
});

// ─── classifyCustomerTier ───────────────────────────────────────────────────

describe("classifyCustomerTier", () => {
  it("nunca compró → inactive", () => {
    expect(classifyCustomerTier(0, 0, null)).toBe("inactive");
  });

  it("null daysSinceLastPurchase → inactive", () => {
    expect(classifyCustomerTier(5000000, 3, null)).toBe("inactive");
  });

  it("VIP: alto gasto + alta frecuencia + reciente", () => {
    expect(classifyCustomerTier(15_000_000, 12, 30)).toBe("vip");
  });

  it("VIP boundary: exactamente 10M + 10 compras + 89 días", () => {
    expect(classifyCustomerTier(10_000_000, 10, 89)).toBe("vip");
  });

  it("NOT VIP: 10M but only 9 purchases", () => {
    expect(classifyCustomerTier(10_000_000, 9, 30)).toBe("frequent");
  });

  it("NOT VIP: 10M + 10 purchases but 90 days (not <90)", () => {
    expect(classifyCustomerTier(10_000_000, 10, 90)).toBe("frequent");
  });

  it("Frequent: ≥5 compras + <180 días", () => {
    expect(classifyCustomerTier(2_000_000, 5, 100)).toBe("frequent");
  });

  it("Frequent boundary: 5 compras + 179 días", () => {
    expect(classifyCustomerTier(1_000_000, 5, 179)).toBe("frequent");
  });

  it("NOT Frequent: 5 compras but 180 days", () => {
    expect(classifyCustomerTier(1_000_000, 5, 180)).toBe("occasional");
  });

  it("Occasional: ≥1 compra + <365 días", () => {
    expect(classifyCustomerTier(100_000, 2, 200)).toBe("occasional");
  });

  it("Occasional boundary: 364 días", () => {
    expect(classifyCustomerTier(100_000, 1, 364)).toBe("occasional");
  });

  it("At Risk: compró pero hace ≥365 días", () => {
    expect(classifyCustomerTier(100_000, 1, 365)).toBe("at_risk");
  });

  it("At Risk: compró hace 500 días", () => {
    expect(classifyCustomerTier(5_000_000, 8, 500)).toBe("at_risk");
  });
});
