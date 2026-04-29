import { describe, it, expect } from "vitest";
import {
  isPaidInMonth,
  calcRowDSO,
  aggregateCobranzaByVendedor,
  calcOverallDSO,
  parseISO,
  daysBetween,
  canonicalSellerName,
} from "../calculations";
import type { CobranzaRow } from "../types";

function row(overrides: Partial<CobranzaRow>): CobranzaRow {
  return {
    codigoCliente:    1,
    vendedorNombre:   "EDGAR LOPEZ",
    montoTotal:       1_000_000,
    pendientePago:    0,
    fechaFactura:     "2026-04-01",
    fechaPago:        "2026-04-15",
    fechaVencimiento: "2026-04-30",
    ...overrides,
  };
}

const NAME_TO_CODIGO = new Map<string, { codigo: number; nombre: string }>([
  ["EDGAR LOPEZ",       { codigo: 9, nombre: "EDGAR LOPEZ" }],
  ["CARLOS GAMARRA",    { codigo: 27, nombre: "CARLOS GAMARRA" }],
  ["AGUSTIN MENDOZA",   { codigo: 12, nombre: "AGUSTIN MENDOZA" }],
]);

// ─── parseISO / daysBetween ────────────────────────────────────────────────

describe("parseISO", () => {
  it("parses YYYY-MM-DD", () => {
    const d = parseISO("2026-04-15");
    expect(d).toEqual(expect.objectContaining({ year: 2026, month: 4, day: 15 }));
  });
  it("returns null for invalid", () => {
    expect(parseISO("")).toBe(null);
    expect(parseISO("bogus")).toBe(null);
    expect(parseISO("2026-13-01")).toBe(null);
    expect(parseISO("2026-01-32")).toBe(null);
  });
});

describe("daysBetween", () => {
  it("computes inclusive day diff", () => {
    const a = parseISO("2026-04-01")!;
    const b = parseISO("2026-04-15")!;
    expect(daysBetween(a, b)).toBe(14);
  });
  it("handles month boundary", () => {
    const a = parseISO("2026-01-31")!;
    const b = parseISO("2026-02-01")!;
    expect(daysBetween(a, b)).toBe(1);
  });
  it("returns negative for reversed dates", () => {
    const a = parseISO("2026-04-15")!;
    const b = parseISO("2026-04-01")!;
    expect(daysBetween(a, b)).toBe(-14);
  });
});

// ─── canonicalSellerName ───────────────────────────────────────────────────

describe("canonicalSellerName", () => {
  it("trims and uppercases", () => {
    expect(canonicalSellerName("  edgar lopez  ")).toBe("EDGAR LOPEZ");
  });
  it("returns null for empty/null", () => {
    expect(canonicalSellerName("")).toBe(null);
    expect(canonicalSellerName(null)).toBe(null);
    expect(canonicalSellerName(undefined)).toBe(null);
  });
});

// ─── isPaidInMonth ─────────────────────────────────────────────────────────

describe("isPaidInMonth", () => {
  it("matches when fecha_pago is in the month", () => {
    expect(isPaidInMonth(row({ fechaPago: "2026-04-15" }), 2026, 4)).toBe(true);
  });
  it("rejects different month or year", () => {
    expect(isPaidInMonth(row({ fechaPago: "2026-03-31" }), 2026, 4)).toBe(false);
    expect(isPaidInMonth(row({ fechaPago: "2025-04-15" }), 2026, 4)).toBe(false);
  });
  it("rejects null fecha_pago (cuota sin pagar)", () => {
    expect(isPaidInMonth(row({ fechaPago: null }), 2026, 4)).toBe(false);
  });
});

// ─── calcRowDSO ────────────────────────────────────────────────────────────

describe("calcRowDSO", () => {
  it("computes pago - factura", () => {
    expect(calcRowDSO(row({ fechaFactura: "2026-04-01", fechaPago: "2026-04-15" }))).toBe(14);
  });
  it("returns null if either date missing", () => {
    expect(calcRowDSO(row({ fechaFactura: null }))).toBe(null);
    expect(calcRowDSO(row({ fechaPago: null }))).toBe(null);
  });
  it("returns null if pago anterior a factura (anomalía)", () => {
    expect(calcRowDSO(row({ fechaFactura: "2026-04-15", fechaPago: "2026-04-01" }))).toBe(null);
  });
});

// ─── aggregateCobranzaByVendedor ───────────────────────────────────────────

describe("aggregateCobranzaByVendedor", () => {
  it("groups paid quotas by vendedor name → codigo", () => {
    const rows: CobranzaRow[] = [
      row({ vendedorNombre: "EDGAR LOPEZ",    montoTotal: 1_000_000, fechaFactura: "2026-04-01", fechaPago: "2026-04-10" }),
      row({ vendedorNombre: "EDGAR LOPEZ",    montoTotal: 2_000_000, fechaFactura: "2026-04-05", fechaPago: "2026-04-25" }),
      row({ vendedorNombre: "CARLOS GAMARRA", montoTotal:   500_000, fechaFactura: "2026-04-02", fechaPago: "2026-04-08" }),
    ];

    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);

    expect(result.byCodigo.get(9)).toEqual({
      vendedorCodigo: 9,
      vendedorNombre: "EDGAR LOPEZ",
      cobranzaGs:     3_000_000,
      cuotasCobradas: 2,
      dsoDias:        (9 + 20) / 2,
    });
    expect(result.byCodigo.get(27)).toEqual({
      vendedorCodigo: 27,
      vendedorNombre: "CARLOS GAMARRA",
      cobranzaGs:     500_000,
      cuotasCobradas: 1,
      dsoDias:        6,
    });
  });

  it("includes negative montos (notas de crédito)", () => {
    const rows: CobranzaRow[] = [
      row({ vendedorNombre: "EDGAR LOPEZ", montoTotal: 5_000_000 }),
      row({ vendedorNombre: "EDGAR LOPEZ", montoTotal: -1_500_000 }),
    ];
    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);
    expect(result.byCodigo.get(9)?.cobranzaGs).toBe(3_500_000);
    expect(result.byCodigo.get(9)?.cuotasCobradas).toBe(2);
  });

  it("excludes payments outside the month", () => {
    const rows: CobranzaRow[] = [
      row({ vendedorNombre: "EDGAR LOPEZ", fechaPago: "2026-03-31" }),
      row({ vendedorNombre: "EDGAR LOPEZ", fechaPago: "2026-05-01" }),
      row({ vendedorNombre: "EDGAR LOPEZ", fechaPago: null }),
      row({ vendedorNombre: "EDGAR LOPEZ", fechaPago: "2026-04-15", montoTotal: 999 }),
    ];
    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);
    expect(result.byCodigo.get(9)?.cobranzaGs).toBe(999);
    expect(result.byCodigo.get(9)?.cuotasCobradas).toBe(1);
  });

  it("buckets unmapped vendedor names (e.g. UNIFORMES) into unattributed", () => {
    const rows: CobranzaRow[] = [
      row({ vendedorNombre: "UNIFORMES", montoTotal: 10_000_000 }),
      row({ vendedorNombre: "UNIFORMES", montoTotal:  2_000_000, fechaPago: "2026-04-20", fechaFactura: "2026-04-01" }),
    ];
    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);
    expect(result.byCodigo.size).toBe(0);
    expect(result.unattributed).toEqual([
      expect.objectContaining({
        bucket:         "UNIFORMES",
        cobranzaGs:     12_000_000,
        cuotasCobradas: 2,
      }),
    ]);
  });

  it("buckets null vendedor as SIN_VENDEDOR", () => {
    const rows: CobranzaRow[] = [
      row({ vendedorNombre: null, montoTotal: 700_000 }),
    ];
    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);
    expect(result.unattributed[0].bucket).toBe("SIN_VENDEDOR");
    expect(result.unattributed[0].cobranzaGs).toBe(700_000);
  });

  it("normalises whitespace and case in vendedor name", () => {
    const rows: CobranzaRow[] = [
      row({ vendedorNombre: "  edgar lopez  " }),
    ];
    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);
    expect(result.byCodigo.get(9)?.cobranzaGs).toBe(1_000_000);
  });

  it("returns null DSO when all rows have invalid dates", () => {
    const rows: CobranzaRow[] = [
      row({ vendedorNombre: "EDGAR LOPEZ", fechaFactura: null }),
      row({ vendedorNombre: "EDGAR LOPEZ", fechaFactura: "2026-04-15", fechaPago: "2026-04-01" }), // pago anterior → inválido
    ];
    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);
    // 2 cuotas pagadas en el mes (la 2da con f_pago=2026-04-01 sí está en abril)
    expect(result.byCodigo.get(9)?.cuotasCobradas).toBe(2);
    expect(result.byCodigo.get(9)?.dsoDias).toBe(null);
  });
});

// ─── calcOverallDSO ────────────────────────────────────────────────────────

describe("calcOverallDSO", () => {
  it("weighted by cuotasCobradas across vendedores + unattributed", () => {
    const rows: CobranzaRow[] = [
      // EDGAR: 2 cuotas, DSO 10 y 20 → avg 15
      row({ vendedorNombre: "EDGAR LOPEZ", fechaFactura: "2026-04-01", fechaPago: "2026-04-11" }),
      row({ vendedorNombre: "EDGAR LOPEZ", fechaFactura: "2026-04-01", fechaPago: "2026-04-21" }),
      // CARLOS: 1 cuota, DSO 5
      row({ vendedorNombre: "CARLOS GAMARRA", fechaFactura: "2026-04-10", fechaPago: "2026-04-15" }),
    ];
    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);
    // Weighted: (15*2 + 5*1) / 3 = 35/3 ≈ 11.67
    const overall = calcOverallDSO(result);
    expect(overall).toBeCloseTo(35 / 3, 5);
  });

  it("returns null when no valid DSO", () => {
    const rows: CobranzaRow[] = [
      row({ vendedorNombre: "EDGAR LOPEZ", fechaFactura: null, fechaPago: "2026-04-15" }),
    ];
    const result = aggregateCobranzaByVendedor(rows, 2026, 4, NAME_TO_CODIGO);
    expect(calcOverallDSO(result)).toBe(null);
  });
});
