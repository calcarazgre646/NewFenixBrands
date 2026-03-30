/**
 * domain/commissions/__tests__/calculations.test.ts
 *
 * Tests para el cálculo de comisiones — 8 roles, escalas escalonadas.
 */
import { describe, it, expect } from "vitest";
import {
  calcCumplimiento,
  findTier,
  calcPercentageCommission,
  calcFixedCommission,
  calcCommission,
  calcAllCommissions,
  buildCommissionSummary,
} from "../calculations";
import { SCALE_BY_ROLE } from "../scales";
import type { SellerGoal, SellerSales } from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function goal(overrides: Partial<SellerGoal> = {}): SellerGoal {
  return {
    vendedorCodigo: 100,
    vendedorNombre: "Test Vendedor",
    rolComision: "vendedor_tienda",
    canal: "retail",
    año: 2026,
    mes: 3,
    trimestre: 1,
    metaVentas: 10_000_000,
    metaCobranza: 0,
    sucursalCodigo: "ESTRELLA",
    ...overrides,
  };
}

function sale(overrides: Partial<SellerSales> = {}): SellerSales {
  return {
    vendedorCodigo: 100,
    vendedorNombre: "Test Vendedor",
    sucursal: "ESTRELLA",
    canal: "B2C",
    año: 2026,
    mes: 3,
    ventaNeta: 10_000_000,
    unidades: 50,
    transacciones: 30,
    ...overrides,
  };
}

// ─── calcCumplimiento ──────────────────────────────────────────────────────

describe("calcCumplimiento", () => {
  it("100% cuando real == meta", () => {
    expect(calcCumplimiento(10_000_000, 10_000_000)).toBe(100);
  });

  it("0% cuando meta es 0", () => {
    expect(calcCumplimiento(5_000_000, 0)).toBe(0);
  });

  it("0% cuando meta es negativa", () => {
    expect(calcCumplimiento(5_000_000, -1)).toBe(0);
  });

  it("50% cuando real es mitad de meta", () => {
    expect(calcCumplimiento(5_000_000, 10_000_000)).toBe(50);
  });

  it("150% cuando real supera meta", () => {
    expect(calcCumplimiento(15_000_000, 10_000_000)).toBe(150);
  });

  it("0% real y 0% meta → 0", () => {
    expect(calcCumplimiento(0, 0)).toBe(0);
  });
});

// ─── findTier ──────────────────────────────────────────────────────────────

describe("findTier", () => {
  const tiers = SCALE_BY_ROLE.vendedor_tienda.tiers;

  it("0% → primer tramo (0%)", () => {
    expect(findTier(tiers, 0).value).toBe(0);
  });

  it("69.99% → primer tramo (0%)", () => {
    expect(findTier(tiers, 69.99).value).toBe(0);
  });

  it("70% → segundo tramo (0.85%)", () => {
    expect(findTier(tiers, 70).value).toBe(0.85);
  });

  it("85% → tercer tramo (0.95%)", () => {
    expect(findTier(tiers, 85).value).toBe(0.95);
  });

  it("100% → quinto tramo (1.15%)", () => {
    expect(findTier(tiers, 100).value).toBe(1.15);
  });

  it("120% → último tramo (1.35%)", () => {
    expect(findTier(tiers, 120).value).toBe(1.35);
  });

  it("200% → último tramo (1.35%)", () => {
    expect(findTier(tiers, 200).value).toBe(1.35);
  });
});

// ─── calcPercentageCommission ──────────────────────────────────────────────

describe("calcPercentageCommission", () => {
  it("10M ventas × 1.15% = 115,000 Gs.", () => {
    expect(calcPercentageCommission(10_000_000, 1.15)).toBe(115_000);
  });

  it("0 ventas → 0", () => {
    expect(calcPercentageCommission(0, 1.15)).toBe(0);
  });

  it("redondea al guaraní", () => {
    expect(calcPercentageCommission(999_999, 0.85)).toBe(8_500);
  });
});

// ─── calcFixedCommission ───────────────────────────────────────────────────

describe("calcFixedCommission", () => {
  it("retorna monto fijo", () => {
    expect(calcFixedCommission(600_000)).toBe(600_000);
  });

  it("0 → 0", () => {
    expect(calcFixedCommission(0)).toBe(0);
  });
});

// ─── calcCommission — Vendedor Tienda (Retail, %) ──────────────────────────

describe("calcCommission — vendedor_tienda", () => {
  it("cumplimiento 100% → 1.15% comisión", () => {
    const r = calcCommission(goal(), 10_000_000);
    expect(r.cumplimientoVentasPct).toBe(100);
    expect(r.comisionVentasPct).toBe(1.15);
    expect(r.comisionVentasGs).toBe(115_000);
    expect(r.comisionTotalGs).toBe(115_000);
    expect(r.comisionCobranzaGs).toBe(0);
  });

  it("cumplimiento 50% → 0% comisión", () => {
    const r = calcCommission(goal(), 5_000_000);
    expect(r.cumplimientoVentasPct).toBe(50);
    expect(r.comisionVentasPct).toBe(0);
    expect(r.comisionTotalGs).toBe(0);
  });

  it("cumplimiento 85% → 0.95%", () => {
    const r = calcCommission(goal(), 8_500_000);
    expect(r.comisionVentasPct).toBe(0.95);
    expect(r.comisionVentasGs).toBe(80_750);
  });

  it("cumplimiento 130% → 1.35%", () => {
    const r = calcCommission(goal(), 13_000_000);
    expect(r.comisionVentasPct).toBe(1.35);
    expect(r.comisionVentasGs).toBe(175_500);
  });
});

// ─── calcCommission — Supervisor Tienda (Retail, monto fijo) ───────────────

describe("calcCommission — supervisor_tienda", () => {
  const sup = goal({ rolComision: "supervisor_tienda" });

  it("cumplimiento 99% → Gs. 0", () => {
    const r = calcCommission(sup, 9_900_000);
    expect(r.comisionTotalGs).toBe(0);
    expect(r.tipoComision).toBe("fixed");
  });

  it("cumplimiento 100% → Gs. 600,000", () => {
    const r = calcCommission(sup, 10_000_000);
    expect(r.comisionTotalGs).toBe(600_000);
  });

  it("cumplimiento 115% → Gs. 700,000", () => {
    const r = calcCommission(sup, 11_500_000);
    expect(r.comisionTotalGs).toBe(700_000);
  });

  it("cumplimiento 125% → Gs. 800,000", () => {
    const r = calcCommission(sup, 12_500_000);
    expect(r.comisionTotalGs).toBe(800_000);
  });
});

// ─── calcCommission — Vendedor Mayorista (%, ventas + cobranza) ────────────

describe("calcCommission — vendedor_mayorista", () => {
  const may = goal({
    rolComision: "vendedor_mayorista",
    canal: "mayorista",
    metaVentas: 20_000_000,
    metaCobranza: 15_000_000,
  });

  it("100% ventas + 100% cobranza", () => {
    const r = calcCommission(may, 20_000_000, 15_000_000);
    expect(r.comisionVentasPct).toBe(1.15);
    expect(r.comisionVentasGs).toBe(230_000);
    expect(r.comisionCobranzaPct).toBe(1.15);
    expect(r.comisionCobranzaGs).toBe(172_500);
    expect(r.comisionTotalGs).toBe(402_500);
  });

  it("50% ventas (0%) + 90% cobranza (1.05%)", () => {
    const r = calcCommission(may, 10_000_000, 13_500_000);
    expect(r.comisionVentasPct).toBe(0);
    expect(r.comisionVentasGs).toBe(0);
    expect(r.comisionCobranzaPct).toBe(1.05);
    expect(r.comisionCobranzaGs).toBe(141_750);
    expect(r.comisionTotalGs).toBe(141_750);
  });

  it("sin meta cobranza → solo ventas", () => {
    const mayNoC = { ...may, metaCobranza: 0 };
    const r = calcCommission(mayNoC, 20_000_000, 15_000_000);
    expect(r.comisionCobranzaGs).toBe(0);
    expect(r.comisionTotalGs).toBe(r.comisionVentasGs);
  });
});

// ─── calcCommission — Vendedor UTP ─────────────────────────────────────────

describe("calcCommission — vendedor_utp", () => {
  const utp = goal({
    rolComision: "vendedor_utp",
    canal: "utp",
    metaVentas: 8_000_000,
    metaCobranza: 0,
  });

  it("cumplimiento 85% → 0.12%", () => {
    const r = calcCommission(utp, 6_800_000);
    expect(r.comisionVentasPct).toBe(0.12);
  });

  it("cumplimiento 120% → 0.23%", () => {
    const r = calcCommission(utp, 9_600_000);
    expect(r.comisionVentasPct).toBe(0.23);
  });
});

// ─── calcCommission — Gerencia UTP ─────────────────────────────────────────

describe("calcCommission — gerencia_utp", () => {
  const gutP = goal({
    rolComision: "gerencia_utp",
    canal: "utp",
    metaVentas: 50_000_000,
    metaCobranza: 0,
  });

  it("cumplimiento 100% → 1.60%", () => {
    const r = calcCommission(gutP, 50_000_000);
    expect(r.comisionVentasPct).toBe(1.60);
    expect(r.comisionVentasGs).toBe(800_000);
  });
});

// ─── calcAllCommissions ────────────────────────────────────────────────────

describe("calcAllCommissions", () => {
  it("cruza metas con ventas por vendedor", () => {
    const goals = [
      goal({ vendedorCodigo: 1, vendedorNombre: "Ana" }),
      goal({ vendedorCodigo: 2, vendedorNombre: "Carlos" }),
    ];
    const sales = [
      sale({ vendedorCodigo: 1, ventaNeta: 10_000_000 }),
      sale({ vendedorCodigo: 2, ventaNeta: 7_000_000 }),
    ];
    const results = calcAllCommissions(goals, sales);
    expect(results).toHaveLength(2);
    expect(results[0].comisionVentasPct).toBe(1.15); // 100%
    expect(results[1].comisionVentasPct).toBe(0.85); // 70%
  });

  it("vendedor sin ventas → 0% comisión", () => {
    const goals = [goal({ vendedorCodigo: 1 })];
    const results = calcAllCommissions(goals, []);
    expect(results[0].ventaReal).toBe(0);
    expect(results[0].comisionTotalGs).toBe(0);
  });

  it("agrega ventas de múltiples registros del mismo vendedor", () => {
    const goals = [goal({ vendedorCodigo: 1 })];
    const sales = [
      sale({ vendedorCodigo: 1, ventaNeta: 5_000_000 }),
      sale({ vendedorCodigo: 1, ventaNeta: 5_000_000 }),
    ];
    const results = calcAllCommissions(goals, sales);
    expect(results[0].ventaReal).toBe(10_000_000); // 100%
    expect(results[0].comisionVentasPct).toBe(1.15);
  });
});

// ─── buildCommissionSummary ────────────────────────────────────────────────

describe("buildCommissionSummary", () => {
  it("resume por canal y rol", () => {
    const goals = [
      goal({ vendedorCodigo: 1, rolComision: "vendedor_tienda", canal: "retail" }),
      goal({ vendedorCodigo: 2, rolComision: "vendedor_mayorista", canal: "mayorista" }),
    ];
    const sales = [
      sale({ vendedorCodigo: 1, ventaNeta: 10_000_000 }),
      sale({ vendedorCodigo: 2, ventaNeta: 15_000_000 }),
    ];
    const results = calcAllCommissions(goals, sales);
    const summary = buildCommissionSummary(results, 2026, 3);

    expect(summary.totalVendedores).toBe(2);
    expect(summary.totalComisionesGs).toBeGreaterThan(0);
    expect(summary.byChannel.retail.count).toBe(1);
    expect(summary.byChannel.mayorista.count).toBe(1);
    expect(summary.byRole.vendedor_tienda.count).toBe(1);
    expect(summary.byRole.vendedor_mayorista.count).toBe(1);
  });

  it("vacío → 0s", () => {
    const summary = buildCommissionSummary([], 2026, 3);
    expect(summary.totalVendedores).toBe(0);
    expect(summary.totalComisionesGs).toBe(0);
  });
});

// ─── Escalas completas ─────────────────────────────────────────────────────

describe("SCALE_BY_ROLE", () => {
  it("tiene 8 roles registrados", () => {
    expect(Object.keys(SCALE_BY_ROLE)).toHaveLength(8);
  });

  it("cada escala tiene tramos ordenados ascendentemente", () => {
    for (const [role, scale] of Object.entries(SCALE_BY_ROLE)) {
      for (let i = 1; i < scale.tiers.length; i++) {
        expect(scale.tiers[i].minPct).toBeGreaterThanOrEqual(scale.tiers[i - 1].minPct);
      }
      // Último tramo tiene maxPct Infinity
      expect(scale.tiers[scale.tiers.length - 1].maxPct).toBe(Infinity);
      expect(scale.role).toBe(role);
    }
  });

  it("supervisor_tienda es tipo fixed", () => {
    expect(SCALE_BY_ROLE.supervisor_tienda.type).toBe("fixed");
  });

  it("todos los demás son tipo percentage", () => {
    for (const [role, scale] of Object.entries(SCALE_BY_ROLE)) {
      if (role !== "supervisor_tienda") {
        expect(scale.type).toBe("percentage");
      }
    }
  });
});
