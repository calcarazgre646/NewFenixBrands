/**
 * Diagnóstico de Margen Bruto
 * Ejecutar: node scripts/diagnose-margin.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://gwzllatcxxrizxtslkeh.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3emxsYXRjeHhyaXp4dHNsa2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTkxNjksImV4cCI6MjA4NzE3NTE2OX0.PAp7RH822TpIr9IMyzh7LbtgsZNiU7d37sFKU5GgtYg";

const sb = createClient(URL, KEY);

async function run() {
  console.log("=== DIAGNÓSTICO MARGEN BRUTO ===\n");

  // 1. Verificar columnas de mv_ventas_mensual — primera fila
  console.log("1. MUESTRA DE mv_ventas_mensual (primera fila 2026):");
  const { data: sample, error: sampleErr } = await sb
    .from("mv_ventas_mensual")
    .select("*")
    .eq("v_año", 2026)
    .in("v_canal_venta", ["B2C", "B2B"])
    .limit(3);
  if (sampleErr) console.error("  ERROR:", sampleErr.message);
  else console.log(" ", JSON.stringify(sample, null, 2));

  // 2. Totales por año de mv_ventas_mensual
  console.log("\n2. TOTALES mv_ventas_mensual 2026 (B2C+B2B):");
  const { data: monthly2026, error: m26err } = await sb
    .from("mv_ventas_mensual")
    .select("v_mes, neto, costo, bruto, dcto")
    .eq("v_año", 2026)
    .in("v_canal_venta", ["B2C", "B2B"])
    .order("v_mes");
  if (m26err) console.error("  ERROR:", m26err.message);
  else {
    // Agrupar por mes
    const byMonth = {};
    for (const r of monthly2026) {
      const m = r.v_mes;
      if (!byMonth[m]) byMonth[m] = { neto: 0, costo: 0, bruto: 0, dcto: 0 };
      byMonth[m].neto += r.neto ?? 0;
      byMonth[m].costo += r.costo ?? 0;
      byMonth[m].bruto += r.bruto ?? 0;
      byMonth[m].dcto += r.dcto ?? 0;
    }
    let totalNeto = 0, totalCosto = 0;
    for (const [mes, v] of Object.entries(byMonth)) {
      const margin = v.neto > 0 ? ((v.neto - v.costo) / v.neto * 100).toFixed(2) : "N/A";
      console.log(`  Mes ${mes}: neto=${v.neto.toLocaleString()}, costo=${v.costo.toLocaleString()}, bruto=${v.bruto.toLocaleString()}, dcto=${v.dcto.toLocaleString()}, MARGEN=${margin}%`);
      totalNeto += v.neto;
      totalCosto += v.costo;
    }
    const totalMargin = totalNeto > 0 ? ((totalNeto - totalCosto) / totalNeto * 100).toFixed(2) : "N/A";
    console.log(`  TOTAL YTD: neto=${totalNeto.toLocaleString()}, costo=${totalCosto.toLocaleString()}, MARGEN=${totalMargin}%`);
  }

  // 3. Comparar con fjdhstvta1 directamente (muestra pequeña)
  console.log("\n3. MUESTRA fjdhstvta1 — 10 filas de 2026 mes 1 (para verificar v_valor):");
  const { data: raw, error: rawErr } = await sb
    .from("fjdhstvta1")
    .select("v_vtasimpu, v_valor, v_impbruto, v_impdscto, v_sku, v_sucursal_final, v_canal_venta")
    .eq("v_año", 2026)
    .eq("v_mes", 1)
    .in("v_canal_venta", ["B2C", "B2B"])
    .limit(10);
  if (rawErr) console.error("  ERROR:", rawErr.message);
  else {
    for (const r of raw) {
      const neto = r.v_vtasimpu ?? 0;
      const cogs = r.v_valor ?? 0;
      const marginRow = neto > 0 ? ((neto - cogs) / neto * 100).toFixed(1) : "N/A";
      console.log(`  SKU=${r.v_sku?.trim()}, store=${r.v_sucursal_final?.trim()}, neto=${neto}, v_valor=${cogs}, bruto=${r.v_impbruto}, dcto=${r.v_impdscto}, margin=${marginRow}%`);
    }
  }

  // 4. Verificar relación neto vs costo — ¿costo > neto? ¿costo ≈ neto?
  console.log("\n4. RELACIÓN neto/costo en mv_ventas_mensual 2026 mes 1:");
  const { data: check, error: checkErr } = await sb
    .from("mv_ventas_mensual")
    .select("v_marca, neto, costo")
    .eq("v_año", 2026)
    .eq("v_mes", 1)
    .in("v_canal_venta", ["B2C", "B2B"])
    .limit(20);
  if (checkErr) console.error("  ERROR:", checkErr.message);
  else {
    for (const r of check) {
      const ratio = r.neto > 0 ? (r.costo / r.neto * 100).toFixed(1) : "N/A";
      console.log(`  marca=${r.v_marca?.trim()}, neto=${r.neto?.toLocaleString()}, costo=${r.costo?.toLocaleString()}, costo/neto=${ratio}%`);
    }
  }

  // 5. Verificar definición de la vista materializada
  console.log("\n5. DEFINICIÓN de mv_ventas_mensual (pg_matviews):");
  const { data: def, error: defErr } = await sb.rpc("get_mv_definition", {});
  if (defErr) {
    console.log("  (No se puede obtener definición vía RPC — ejecutar en SQL Editor):");
    console.log("  SELECT definition FROM pg_matviews WHERE matviewname = 'mv_ventas_mensual';");
  } else {
    console.log(" ", def);
  }

  // 6. Verificar mv_ventas_diarias vs mv_ventas_mensual (mismo mes)
  console.log("\n6. CROSS-CHECK mv_ventas_diarias vs mv_ventas_mensual (mes 1, 2026):");
  const { data: daily, error: dailyErr } = await sb
    .from("mv_ventas_diarias")
    .select("neto, costo")
    .eq("year", 2026)
    .eq("month", 1);
  if (dailyErr) console.error("  ERROR mv_ventas_diarias:", dailyErr.message);
  else {
    let dNeto = 0, dCosto = 0;
    for (const r of daily) { dNeto += r.neto ?? 0; dCosto += r.costo ?? 0; }
    const dMargin = dNeto > 0 ? ((dNeto - dCosto) / dNeto * 100).toFixed(2) : "N/A";
    console.log(`  mv_ventas_diarias  mes 1: neto=${dNeto.toLocaleString()}, costo=${dCosto.toLocaleString()}, margin=${dMargin}%`);
  }

  const totalM1 = monthly2026?.filter(r => r.v_mes === 1) ?? [];
  let mNeto = 0, mCosto = 0;
  for (const r of totalM1) { mNeto += r.neto ?? 0; mCosto += r.costo ?? 0; }
  const mMargin = mNeto > 0 ? ((mNeto - mCosto) / mNeto * 100).toFixed(2) : "N/A";
  console.log(`  mv_ventas_mensual  mes 1: neto=${mNeto.toLocaleString()}, costo=${mCosto.toLocaleString()}, margin=${mMargin}%`);

  console.log("\n=== FIN DIAGNÓSTICO ===");
}

run().catch(console.error);
