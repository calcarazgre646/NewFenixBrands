import { describe, expect, it } from "vitest";
import { buildSubject, renderSalesPulseHtml } from "../htmlTemplate";
import { parsePulsePayload } from "../narrative";

const FIXTURE_FULL = parsePulsePayload({
  week_start: "2026-04-27", week_end: "2026-05-03", iso_week: 18, year: 2026,
  sales: { neto_week: 123_000_000, units_week: 450, neto_prev_week: 100_000_000, neto_year_ago: 90_000_000, wow_pct: 23, yoy_pct: 36.7 },
  monthly: { month_label: "Mayo 2026", month_actual: 50_000_000, month_target: 70_000_000,
             month_progress_pct: 71.4, days_elapsed: 3, days_in_month: 31,
             run_rate_projection: 516_666_667, gap_to_target: 0 },
  movers: {
    brands: [
      { name: "Martel", neto: 50_000_000, neto_prev: 40_000_000, wow_pct: 25 },
      { name: "Lee",    neto: 30_000_000, neto_prev: 32_000_000, wow_pct: -6.3 },
    ],
    skus: [{ sku: "S1", description: "Camisa azul", brand: "Martel", units: 10, neto: 1_000_000 }],
    stores: [{ store: "ESTRELLA", channel: "B2C", neto: 20_000_000, neto_prev: 18_000_000, wow_pct: 11.1 }],
  },
  alerts: {
    novelty_undistributed: { count: 2, examples: [{ sku: "X", description: "Camisa nueva", brand: "Lee", units: 12 }] },
    low_sell_through_30d:  { count: 1, examples: [{ sku: "Y", description: "Pantalón viejo", brand: "Wrangler", units_received: 30, sth_pct: 12.5 }] },
    dso: { current_days: 42, four_weeks_ago_days: 38, cxc_current: 5_000_000_000, cxc_four_weeks_ago: 4_500_000_000 },
  },
  freshness: {
    sources: [{ source_name: "mv_ventas_diarias", refreshed_at: "2026-05-04T10:15:00Z", status: "ok" }],
    max_data_date: "2026-05-03",
  },
});

const NOW = new Date("2026-05-04T12:00:00Z");

describe("renderSalesPulseHtml", () => {
  it("renderiza con doctype + html + estructura completa", () => {
    const html = renderSalesPulseHtml(FIXTURE_FULL, { now: NOW });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<html lang=\"es\">");
    expect(html).toContain("Sales Pulse · Sem 18");
    expect(html).toContain("Pulso de la semana");
    expect(html).toContain("Cumplimiento mensual");
    expect(html).toContain("Top movers");
    expect(html).toContain("Alertas accionables");
  });

  it("incluye headline con fechas y deltas", () => {
    const html = renderSalesPulseHtml(FIXTURE_FULL, { now: NOW });
    expect(html).toContain("Semana 18 (27 abr – 3 may)");
    expect(html).toContain("▲ +23.0% WoW");
    expect(html).toContain("▲ +36.7% YoY");
  });

  it("incluye los 3 bloques de movers cuando hay datos", () => {
    const html = renderSalesPulseHtml(FIXTURE_FULL, { now: NOW });
    expect(html).toContain("Martel");
    expect(html).toContain("Camisa azul");
    expect(html).toContain("ESTRELLA");
    expect(html).toContain("B2C");
  });

  it("renderea las 3 alertas con tono correcto", () => {
    const html = renderSalesPulseHtml(FIXTURE_FULL, { now: NOW });
    expect(html).toContain("Novedades sin distribuir");
    expect(html).toContain("2 SKUs en depósito");
    expect(html).toContain("Sell-through bajo");
    expect(html).toContain("Días de cobranza (DSO)");
    expect(html).toContain("42 días");
  });

  it("muestra fallback 'Sin alertas' cuando todas vienen vacías", () => {
    const empty = parsePulsePayload({
      week_start: "2026-04-27", week_end: "2026-05-03", iso_week: 18,
      alerts: {
        novelty_undistributed: { count: 0, examples: [] },
        low_sell_through_30d:  { count: 0, examples: [] },
        dso: { current_days: null, four_weeks_ago_days: null, cxc_current: 0, cxc_four_weeks_ago: 0 },
      },
    });
    const html = renderSalesPulseHtml(empty, { now: NOW });
    expect(html).toContain("Sin alertas activas esta semana");
  });

  it("muestra 'sin meta cargada' cuando target=0", () => {
    const noTarget = parsePulsePayload({
      week_start: "2026-04-27", week_end: "2026-05-03", iso_week: 18,
      monthly: { month_label: "Mayo 2026", month_actual: 50_000_000, month_target: 0,
                 month_progress_pct: null, days_elapsed: 3, days_in_month: 31,
                 run_rate_projection: 0, gap_to_target: 0 },
    });
    const html = renderSalesPulseHtml(noTarget, { now: NOW });
    expect(html).toContain("sin meta cargada");
    // No barra de progreso cuando no hay meta
    expect(html).not.toMatch(/background:#15803d;width:/);
    expect(html).not.toMatch(/background:#1d4ed8;width:/);
  });

  it("escapa HTML en datos del usuario", () => {
    const malicious = parsePulsePayload({
      week_start: "2026-04-27", week_end: "2026-05-03", iso_week: 18,
      movers: { skus: [{ sku: "X", description: "<script>alert(1)</script>", brand: "Lee", units: 1, neto: 100 }] },
    });
    const html = renderSalesPulseHtml(malicious, { now: NOW });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("usa appUrl pasado por opción en el CTA", () => {
    const html = renderSalesPulseHtml(FIXTURE_FULL, { appUrl: "https://staging.example.com", now: NOW });
    expect(html).toContain("href=\"https://staging.example.com\"");
  });

  it("no incluye sección unidades cuando units=0", () => {
    const noUnits = parsePulsePayload({
      week_start: "2026-04-27", week_end: "2026-05-03", iso_week: 18,
      sales: { neto_week: 100_000, units_week: 0 },
    });
    const html = renderSalesPulseHtml(noUnits, { now: NOW });
    expect(html).not.toContain("unidades movidas");
  });

  it("muestra freshness con stale cuando supera 24h", () => {
    const stale = parsePulsePayload({
      week_start: "2026-04-27", week_end: "2026-05-03", iso_week: 18,
      freshness: {
        sources: [{ source_name: "mv_ventas_diarias", refreshed_at: "2026-05-02T10:00:00Z", status: "ok" }],
        max_data_date: "2026-05-02",
      },
    });
    const html = renderSalesPulseHtml(stale, { now: NOW });
    expect(html).toContain("(stale)");
  });
});

describe("buildSubject", () => {
  it("incluye semana + rango + tag al alza cuando WoW >= 5%", () => {
    expect(buildSubject(FIXTURE_FULL)).toBe("Sales Pulse · Semana 18 (27 abr – 3 may) · ▲");
  });

  it("incluye tag a la baja cuando WoW <= -5%", () => {
    const down = parsePulsePayload({
      iso_week: 5, week_start: "2026-02-02", week_end: "2026-02-08",
      sales: { neto_week: 1, neto_prev_week: 2, wow_pct: -50 },
    });
    expect(buildSubject(down)).toBe("Sales Pulse · Semana 5 (2 feb – 8 feb) · ▼");
  });

  it("omite tag cuando WoW está en rango neutral o es null", () => {
    const flat = parsePulsePayload({
      iso_week: 5, week_start: "2026-02-02", week_end: "2026-02-08",
      sales: { neto_week: 100, neto_prev_week: 100, wow_pct: 0 },
    });
    expect(buildSubject(flat)).toBe("Sales Pulse · Semana 5 (2 feb – 8 feb)");

    const nullPct = parsePulsePayload({
      iso_week: 1, week_start: "2026-01-05", week_end: "2026-01-11",
      sales: { neto_week: 100 },
    });
    expect(buildSubject(nullPct)).toBe("Sales Pulse · Semana 1 (5 ene – 11 ene)");
  });
});
