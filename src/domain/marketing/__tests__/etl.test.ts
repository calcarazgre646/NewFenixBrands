import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  normalizeEmail,
  isFakePhone,
  isFakeEmail,
  normalizeRuc,
  cleanClim100Row,
  mergeByRuc,
  aggregateTransactions,
  aggregateCobranzas,
  buildCustomerProfile,
  computeEtlStats,
} from "../etl";

// ─── normalizePhone ─────────────────────────────────────────────────────────

describe("normalizePhone", () => {
  it("null → null", () => expect(normalizePhone(null)).toBeNull());
  it("undefined → null", () => expect(normalizePhone(undefined)).toBeNull());
  it("empty → null", () => expect(normalizePhone("")).toBeNull());
  it("valid PY mobile 0981... → +595981...", () => {
    expect(normalizePhone("0981555123")).toBe("+595981555123");
  });
  it("strips spaces and dashes", () => {
    expect(normalizePhone("0981 555-123")).toBe("+595981555123");
  });
  it("handles 595 prefix", () => {
    expect(normalizePhone("595981555123")).toBe("+595981555123");
  });
  it("handles 9-digit without 0", () => {
    expect(normalizePhone("981555123")).toBe("+595981555123");
  });
  it("fake phone → null", () => {
    expect(normalizePhone("0981111111")).toBeNull();
  });
  it("fake phone 0980000000 → null", () => {
    expect(normalizePhone("0980000000")).toBeNull();
  });
  it("non-mobile (landline 021) → null", () => {
    expect(normalizePhone("0211234567")).toBeNull();
  });
  it("too short → null", () => {
    expect(normalizePhone("12345")).toBeNull();
  });
  it("too long → null", () => {
    expect(normalizePhone("098155512345678")).toBeNull();
  });
});

// ─── isFakePhone ────────────────────────────────────────────────────────────

describe("isFakePhone", () => {
  it("known fake → true", () => expect(isFakePhone("0981111111")).toBe(true));
  it("real phone → false", () => expect(isFakePhone("0981555123")).toBe(false));
  it("zeros → true", () => expect(isFakePhone("0000000000")).toBe(true));
});

// ─── normalizeEmail ─────────────────────────────────────────────────────────

describe("normalizeEmail", () => {
  it("null → null", () => expect(normalizeEmail(null)).toBeNull());
  it("undefined → null", () => expect(normalizeEmail(undefined)).toBeNull());
  it("empty → null", () => expect(normalizeEmail("")).toBeNull());
  it("valid email → lowercase", () => {
    expect(normalizeEmail("Test@Example.COM")).toBe("test@example.com");
  });
  it("strips whitespace", () => {
    expect(normalizeEmail("  user@test.com  ")).toBe("user@test.com");
  });
  it("no @ → null", () => expect(normalizeEmail("invalid")).toBeNull());
  it("fake domain sincorreo.com → null", () => {
    expect(normalizeEmail("user@sincorreo.com")).toBeNull();
  });
  it("fake domain sinnombre.com → null", () => {
    expect(normalizeEmail("a@sinnombre.com")).toBeNull();
  });
  it("fake domain sincoreo.com → null", () => {
    expect(normalizeEmail("x@sincoreo.com")).toBeNull();
  });
  it("fake domain sincorrreo.com → null", () => {
    expect(normalizeEmail("y@sincorrreo.com")).toBeNull();
  });
});

// ─── isFakeEmail ────────────────────────────────────────────────────────────

describe("isFakeEmail", () => {
  it("fake domain → true", () => expect(isFakeEmail("a@sincorreo.com")).toBe(true));
  it("real domain → false", () => expect(isFakeEmail("a@gmail.com")).toBe(false));
  it("no @ → true", () => expect(isFakeEmail("nodomain")).toBe(true));
  it("case insensitive → true", () => expect(isFakeEmail("a@SINCORREO.COM")).toBe(true));
});

// ─── normalizeRuc ──────────────────────────────────────────────────────────

describe("normalizeRuc", () => {
  it("strips DV: '3846622-8' → '3846622'", () => {
    expect(normalizeRuc("3846622-8")).toBe("3846622");
  });
  it("strips DV: '1410667-1' → '1410667'", () => {
    expect(normalizeRuc("1410667-1")).toBe("1410667");
  });
  it("no dash: '3846622' → '3846622'", () => {
    expect(normalizeRuc("3846622")).toBe("3846622");
  });
  it("trims padding: '3846622    ' → '3846622'", () => {
    expect(normalizeRuc("3846622    ")).toBe("3846622");
  });
  it("trims + strips DV: '  1410667-1  ' → '1410667'", () => {
    expect(normalizeRuc("  1410667-1  ")).toBe("1410667");
  });
  it("empty → empty", () => {
    expect(normalizeRuc("")).toBe("");
  });
  it("only spaces → empty", () => {
    expect(normalizeRuc("   ")).toBe("");
  });
  it("corporate RUC: '80012345-6' → '80012345'", () => {
    expect(normalizeRuc("80012345-6")).toBe("80012345");
  });
});

// ─── cleanClim100Row ────────────────────────────────────────────────────────

describe("cleanClim100Row", () => {
  it("valid row → cleaned (RUC normalized, DV stripped)", () => {
    const result = cleanClim100Row({
      c_codigo: "  CLI001  ",
      c_razsoc: " Empresa SA ",
      c_ruc: "80012345-6",
      c_telefo: "0981555123",
      c_email: "empresa@test.com",
      c_tipocl: "NORMAL",
      c_fecing: "2020-01-15",
    });
    expect(result).toEqual({
      erpCode: "CLI001",
      ruc: "80012345",
      razonSocial: "Empresa SA",
      phone: "+595981555123",
      email: "empresa@test.com",
      tipoCliente: "NORMAL",
      fechaIngreso: "2020-01-15",
    });
  });

  it("RUC with padding is trimmed: '3846622    ' → '3846622'", () => {
    const result = cleanClim100Row({
      c_codigo: "CLI010",
      c_razsoc: "Padded SA",
      c_ruc: "3846622    ",
    });
    expect(result?.ruc).toBe("3846622");
  });

  it("missing code → null", () => {
    expect(cleanClim100Row({ c_codigo: "", c_razsoc: "Test" })).toBeNull();
  });

  it("missing razon social → null", () => {
    expect(cleanClim100Row({ c_codigo: "CLI001", c_razsoc: "" })).toBeNull();
  });

  it("fake phone is cleaned out", () => {
    const result = cleanClim100Row({
      c_codigo: "CLI002",
      c_razsoc: "Test SA",
      c_telefo: "0981111111",
      c_email: null,
    });
    expect(result?.phone).toBeNull();
  });

  it("fake email is cleaned out", () => {
    const result = cleanClim100Row({
      c_codigo: "CLI003",
      c_razsoc: "Test SA",
      c_telefo: null,
      c_email: "x@sincorreo.com",
    });
    expect(result?.email).toBeNull();
  });

  it("handles alternative column names", () => {
    const result = cleanClim100Row({
      codigo: "CLI004",
      razon_social: "Alt SA",
    });
    expect(result?.erpCode).toBe("CLI004");
    expect(result?.razonSocial).toBe("Alt SA");
  });

  it("null optional fields → null", () => {
    const result = cleanClim100Row({
      c_codigo: "CLI005",
      c_razsoc: "Min SA",
    });
    expect(result?.ruc).toBeNull();
    expect(result?.phone).toBeNull();
    expect(result?.email).toBeNull();
    expect(result?.tipoCliente).toBeNull();
    expect(result?.fechaIngreso).toBeNull();
  });
});

// ─── aggregateTransactions ──────────────────────────────────────────────────

describe("aggregateTransactions", () => {
  it("empty rows → empty map", () => {
    expect(aggregateTransactions([]).size).toBe(0);
  });

  it("single customer, multiple txns", () => {
    const result = aggregateTransactions([
      { customerCode: "C1", monto: 100000, fecha: "2026-01-01" },
      { customerCode: "C1", monto: 200000, fecha: "2026-02-15" },
      { customerCode: "C1", monto: 150000, fecha: "2026-01-20" },
    ]);
    const agg = result.get("C1")!;
    expect(agg.totalPurchases).toBe(3);
    expect(agg.totalSpent).toBe(450000);
    expect(agg.avgTicket).toBe(150000);
    expect(agg.lastPurchase).toBe("2026-02-15");
  });

  it("multiple customers", () => {
    const result = aggregateTransactions([
      { customerCode: "C1", monto: 100000, fecha: "2026-01-01" },
      { customerCode: "C2", monto: 500000, fecha: "2026-03-01" },
    ]);
    expect(result.size).toBe(2);
    expect(result.get("C1")!.totalSpent).toBe(100000);
    expect(result.get("C2")!.totalSpent).toBe(500000);
  });

  it("skips empty customer code", () => {
    const result = aggregateTransactions([
      { customerCode: "", monto: 100000, fecha: "2026-01-01" },
      { customerCode: "  ", monto: 200000, fecha: "2026-01-01" },
    ]);
    expect(result.size).toBe(0);
  });

  it("trims customer code", () => {
    const result = aggregateTransactions([
      { customerCode: "  C1  ", monto: 100000, fecha: "2026-01-01" },
      { customerCode: "C1", monto: 200000, fecha: "2026-01-02" },
    ]);
    expect(result.get("C1")!.totalPurchases).toBe(2);
  });

  it("normalizes RUC with dash: '3846622-8' + '3846622' → same key", () => {
    const result = aggregateTransactions([
      { customerCode: "3846622-8", monto: 100000, fecha: "2026-01-01" },
      { customerCode: "3846622", monto: 200000, fecha: "2026-01-02" },
    ]);
    expect(result.get("3846622")!.totalPurchases).toBe(2);
    expect(result.get("3846622")!.totalSpent).toBe(300000);
  });
});

// ─── aggregateCobranzas ─────────────────────────────────────────────────────

describe("aggregateCobranzas", () => {
  it("empty rows → empty map", () => {
    expect(aggregateCobranzas([]).size).toBe(0);
  });

  it("aggregates pending amounts", () => {
    const result = aggregateCobranzas([
      { customerCode: "C1", pendingAmount: 100000 },
      { customerCode: "C1", pendingAmount: 200000 },
    ]);
    const agg = result.get("C1")!;
    expect(agg.hasPending).toBe(true);
    expect(agg.pendingAmount).toBe(300000);
  });

  it("zero total → hasPending false", () => {
    const result = aggregateCobranzas([
      { customerCode: "C1", pendingAmount: 0 },
    ]);
    const agg = result.get("C1")!;
    expect(agg.hasPending).toBe(false);
    expect(agg.pendingAmount).toBe(0);
  });
});

// ─── buildCustomerProfile ───────────────────────────────────────────────────

// ─── mergeByRuc ─────────────────────────────────────────────────────────────

describe("mergeByRuc", () => {
  it("empty → empty", () => {
    expect(mergeByRuc([])).toEqual([]);
  });

  it("skips rows without RUC", () => {
    const result = mergeByRuc([
      { erpCode: "C1", ruc: null, razonSocial: "No RUC", phone: null, email: null, tipoCliente: null, fechaIngreso: null },
      { erpCode: "C2", ruc: "", razonSocial: "Empty RUC", phone: null, email: null, tipoCliente: null, fechaIngreso: null },
    ]);
    expect(result).toEqual([]);
  });

  it("merges multiple codes under same RUC", () => {
    const result = mergeByRuc([
      { erpCode: "C1", ruc: "80012345", razonSocial: "Empresa SA", phone: "+595981555123", email: null, tipoCliente: "NORMAL", fechaIngreso: "2021-05-10" },
      { erpCode: "C2", ruc: "80012345", razonSocial: "Empresa SA", phone: null, email: "emp@test.com", tipoCliente: "NORMAL", fechaIngreso: "2020-01-01" },
      { erpCode: "C3", ruc: "80012345", razonSocial: "Empresa SA", phone: null, email: null, tipoCliente: null, fechaIngreso: "2022-06-15" },
    ]);
    expect(result).toHaveLength(1);
    const merged = result[0];
    expect(merged.ruc).toBe("80012345");
    expect(merged.erpCode).toBe("C1"); // first seen
    expect(merged.codeCount).toBe(3);
    expect(merged.phone).toBe("+595981555123"); // from first row
    expect(merged.email).toBe("emp@test.com"); // picked from second row
    expect(merged.fechaIngreso).toBe("2020-01-01"); // earliest
  });

  it("different RUCs stay separate", () => {
    const result = mergeByRuc([
      { erpCode: "C1", ruc: "111", razonSocial: "A", phone: null, email: null, tipoCliente: null, fechaIngreso: null },
      { erpCode: "C2", ruc: "222", razonSocial: "B", phone: null, email: null, tipoCliente: null, fechaIngreso: null },
    ]);
    expect(result).toHaveLength(2);
  });

  it("picks first non-null phone", () => {
    const result = mergeByRuc([
      { erpCode: "C1", ruc: "111", razonSocial: "A", phone: null, email: null, tipoCliente: null, fechaIngreso: null },
      { erpCode: "C2", ruc: "111", razonSocial: "A", phone: "+595981555999", email: null, tipoCliente: null, fechaIngreso: null },
    ]);
    expect(result[0].phone).toBe("+595981555999");
  });
});

// ─── buildCustomerProfile ───────────────────────────────────────────────────

describe("buildCustomerProfile", () => {
  const now = new Date("2026-03-20T12:00:00Z");

  it("no transactions → inactive tier", () => {
    const profile = buildCustomerProfile(
      { ruc: "111", erpCode: "C1", razonSocial: "Test", phone: null, email: null, tipoCliente: null, fechaIngreso: null, codeCount: 1 },
      undefined,
      undefined,
      now,
    );
    expect(profile.tier).toBe("inactive");
    expect(profile.totalSpent).toBe(0);
    expect(profile.purchaseCount).toBe(0);
    expect(profile.codeCount).toBe(1);
  });

  it("with transactions → calculates tier", () => {
    const profile = buildCustomerProfile(
      { ruc: "123", erpCode: "C2", razonSocial: "VIP SA", phone: "+595981555123", email: "a@b.com", tipoCliente: "NORMAL", fechaIngreso: "2020-01-01", codeCount: 3 },
      { totalPurchases: 15, totalSpent: 20_000_000, avgTicket: 1_333_333, lastPurchase: "2026-03-10T00:00:00Z" },
      { hasPending: true, pendingAmount: 500000 },
      now,
    );
    expect(profile.tier).toBe("vip");
    expect(profile.totalSpent).toBe(20_000_000);
    expect(profile.hasPendingDebt).toBe(true);
    expect(profile.pendingAmount).toBe(500000);
    expect(profile.codeCount).toBe(3);
  });

  it("at_risk: old purchase date", () => {
    const profile = buildCustomerProfile(
      { ruc: "456", erpCode: "C3", razonSocial: "Old SA", phone: null, email: null, tipoCliente: null, fechaIngreso: null, codeCount: 1 },
      { totalPurchases: 3, totalSpent: 500000, avgTicket: 166666, lastPurchase: "2024-01-01T00:00:00Z" },
      undefined,
      now,
    );
    expect(profile.tier).toBe("at_risk");
  });
});

// ─── RUC cross-match integration ────────────────────────────────────────────

describe("RUC cross-match (CLIM100 vs v_transacciones_dwh)", () => {
  const now = new Date("2026-03-27T12:00:00Z");

  it("CLIM100 RUC without dash matches txn RUC with dash", () => {
    // Simulates real data: CLIM100 has "3846622", txn has "3846622-8"
    const cleanRows = [
      cleanClim100Row({ c_codigo: "30008952", c_razsoc: "DARIO PICCO", c_ruc: "3846622    " })!,
      cleanClim100Row({ c_codigo: "30016501", c_razsoc: "TANIA PORTILLO", c_ruc: "3638281" })!,
    ];
    const merged = mergeByRuc(cleanRows);
    expect(merged).toHaveLength(2);
    expect(merged[0].ruc).toBe("3846622");
    expect(merged[1].ruc).toBe("3638281");

    // Transactions come with dash+DV
    const txnMap = aggregateTransactions([
      { customerCode: "3846622-8", monto: 434000, fecha: "01/02/2026" },
      { customerCode: "3846622-8", monto: 200000, fecha: "15/02/2026" },
      { customerCode: "3638281-7", monto: 119000, fecha: "01/02/2026" },
    ]);

    // After normalizeRuc, keys should match
    expect(txnMap.has("3846622")).toBe(true);
    expect(txnMap.has("3638281")).toBe(true);
    expect(txnMap.get("3846622")!.totalPurchases).toBe(2);
    expect(txnMap.get("3846622")!.totalSpent).toBe(634000);
    expect(txnMap.get("3638281")!.totalPurchases).toBe(1);

    // Build profiles — match by normalized RUC
    const profile1 = buildCustomerProfile(merged[0], txnMap.get(merged[0].ruc), undefined, now);
    expect(profile1.totalSpent).toBe(634000);
    expect(profile1.purchaseCount).toBe(2);
    expect(profile1.tier).not.toBe("inactive");

    const profile2 = buildCustomerProfile(merged[1], txnMap.get(merged[1].ruc), undefined, now);
    expect(profile2.totalSpent).toBe(119000);
    expect(profile2.purchaseCount).toBe(1);
  });

  it("cobranzas with dash also match normalized RUC", () => {
    const cobMap = aggregateCobranzas([
      { customerCode: "3846622-8", pendingAmount: 100000 },
      { customerCode: "  3846622-8  ", pendingAmount: 50000 },
    ]);
    expect(cobMap.has("3846622")).toBe(true);
    expect(cobMap.get("3846622")!.pendingAmount).toBe(150000);
  });
});

// ─── computeEtlStats ────────────────────────────────────────────────────────

describe("computeEtlStats", () => {
  it("empty array → all zeros", () => {
    const stats = computeEtlStats([]);
    expect(stats.totalSynced).toBe(0);
    expect(stats.withPhone).toBe(0);
    expect(stats.withEmail).toBe(0);
    expect(stats.withBoth).toBe(0);
    expect(stats.lastSyncedAt).toBeNull();
    expect(stats.tierBreakdown.vip).toBe(0);
  });

  it("counts phone/email/both correctly", () => {
    const stats = computeEtlStats([
      { phone: "+595981555123", email: "a@b.com", tier: "vip", syncedAt: "2026-03-20T00:00:00Z" },
      { phone: "+595981555124", email: null, tier: "frequent", syncedAt: "2026-03-19T00:00:00Z" },
      { phone: null, email: "c@d.com", tier: "inactive", syncedAt: "2026-03-18T00:00:00Z" },
      { phone: null, email: null, tier: "inactive", syncedAt: "2026-03-17T00:00:00Z" },
    ]);
    expect(stats.totalSynced).toBe(4);
    expect(stats.withPhone).toBe(2);
    expect(stats.withEmail).toBe(2);
    expect(stats.withBoth).toBe(1);
    expect(stats.lastSyncedAt).toBe("2026-03-20T00:00:00Z");
  });

  it("counts tier breakdown correctly", () => {
    const stats = computeEtlStats([
      { phone: null, email: null, tier: "vip", syncedAt: "" },
      { phone: null, email: null, tier: "vip", syncedAt: "" },
      { phone: null, email: null, tier: "frequent", syncedAt: "" },
      { phone: null, email: null, tier: "at_risk", syncedAt: "" },
      { phone: null, email: null, tier: "inactive", syncedAt: "" },
    ]);
    expect(stats.tierBreakdown.vip).toBe(2);
    expect(stats.tierBreakdown.frequent).toBe(1);
    expect(stats.tierBreakdown.occasional).toBe(0);
    expect(stats.tierBreakdown.at_risk).toBe(1);
    expect(stats.tierBreakdown.inactive).toBe(1);
  });
});
