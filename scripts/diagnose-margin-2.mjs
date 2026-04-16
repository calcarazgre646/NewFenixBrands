/**
 * Diagnóstico de Margen Bruto — Parte 2
 * Buscar costos reales en fjdexisemp (inventario)
 * Ejecutar: node scripts/diagnose-margin-2.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://gwzllatcxxrizxtslkeh.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3emxsYXRjeHhyaXp4dHNsa2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTkxNjksImV4cCI6MjA4NzE3NTE2OX0.PAp7RH822TpIr9IMyzh7LbtgsZNiU7d37sFKU5GgtYg";

const sb = createClient(URL, KEY);

async function run() {
  console.log("=== DIAGNÓSTICO MARGEN BRUTO — Parte 2 ===\n");

  // 1. Verificar costos en fjdexisemp (inventario tiene e_costo)
  console.log("1. MUESTRA de costos en fjdexisemp (inventario):");
  const { data: inv, error: invErr } = await sb
    .from("fjdexisemp")
    .select("e_sku, e_marca, e_costo, e_precio, e_valor, e_cantid")
    .gt("e_cantid", 0)
    .eq("e_tpitem", "1")
    .limit(10);
  if (invErr) console.error("  ERROR:", invErr.message);
  else {
    for (const r of inv) {
      const markup = r.e_costo > 0 ? ((r.e_precio - r.e_costo) / r.e_costo * 100).toFixed(1) : "N/A";
      const margin = r.e_precio > 0 ? ((r.e_precio - r.e_costo) / r.e_precio * 100).toFixed(1) : "N/A";
      console.log(`  SKU=${r.e_sku?.trim()}, marca=${r.e_marca?.trim()}, costo=${r.e_costo}, precio=${r.e_precio}, stock=${r.e_cantid}, markup=${markup}%, margin=${margin}%`);
    }
  }

  // 2. Resumen de margen por marca desde inventario
  console.log("\n2. MARGEN PROMEDIO por marca (desde inventario fjdexisemp):");
  const { data: invAll, error: invAllErr } = await sb
    .from("mv_stock_tienda")
    .select("brand, sku, cost, price, units")
    .gt("units", 0)
    .limit(5000);
  if (invAllErr) console.error("  ERROR:", invAllErr.message);
  else {
    const byBrand = {};
    for (const r of invAll) {
      const b = r.brand?.trim() || "?";
      if (!byBrand[b]) byBrand[b] = { totalCost: 0, totalPrice: 0, count: 0, skus: 0 };
      if (r.cost > 0 && r.price > 0) {
        byBrand[b].totalCost += r.cost * r.units;
        byBrand[b].totalPrice += r.price * r.units;
        byBrand[b].count += r.units;
        byBrand[b].skus++;
      }
    }
    for (const [brand, v] of Object.entries(byBrand)) {
      if (v.count === 0) continue;
      const avgCost = v.totalCost / v.count;
      const avgPrice = v.totalPrice / v.count;
      const margin = ((avgPrice - avgCost) / avgPrice * 100).toFixed(1);
      console.log(`  ${brand}: avgCosto=${avgCost.toFixed(0)}, avgPrecio=${avgPrice.toFixed(0)}, margen=${margin}%, SKUs=${v.skus}`);
    }
  }

  // 3. Verificar si v_valor tiene datos en ALGÚN año
  console.log("\n3. v_valor en fjdhstvta1 — ¿tiene datos en algún período?:");
  for (const year of [2024, 2025, 2026]) {
    const { data, error } = await sb
      .from("fjdhstvta1")
      .select("v_valor")
      .eq("v_año", year)
      .gt("v_valor", 0)
      .limit(1);
    if (error) console.error(`  ${year}: ERROR`, error.message);
    else {
      console.log(`  ${year}: ${data.length > 0 ? `SÍ tiene v_valor > 0 (ej: ${data[0].v_valor})` : "NO — v_valor = 0 en todas las filas"}`);
    }
  }

  // 4. Contar filas con v_valor > 0 vs total en 2026
  console.log("\n4. Proporción de filas con v_valor > 0 en 2026:");
  const { count: withCost } = await sb
    .from("fjdhstvta1")
    .select("*", { count: "exact", head: true })
    .eq("v_año", 2026)
    .gt("v_valor", 0);
  const { count: total } = await sb
    .from("fjdhstvta1")
    .select("*", { count: "exact", head: true })
    .eq("v_año", 2026);
  console.log(`  Con v_valor > 0: ${withCost} de ${total} (${total > 0 ? (withCost/total*100).toFixed(1) : 0}%)`);

  // 5. Verificar relación: neto = bruto - dcto?
  console.log("\n5. VERIFICACIÓN relación: neto ≈ bruto - dcto (primeras 5 filas):");
  const { data: verify } = await sb
    .from("fjdhstvta1")
    .select("v_vtasimpu, v_impbruto, v_impdscto")
    .eq("v_año", 2026)
    .eq("v_mes", 3)
    .in("v_canal_venta", ["B2C"])
    .gt("v_impdscto", 0)
    .limit(5);
  for (const r of verify || []) {
    const expected = r.v_impbruto - r.v_impdscto;
    const match = Math.abs(r.v_vtasimpu - expected) < 1 ? "✓" : `✗ (diff=${(r.v_vtasimpu - expected).toFixed(2)})`;
    console.log(`  bruto=${r.v_impbruto}, dcto=${r.v_impdscto}, neto=${r.v_vtasimpu}, bruto-dcto=${expected.toFixed(2)} ${match}`);
  }

  // 6. Buscar si existe alguna tabla de costos por SKU
  console.log("\n6. TABLAS que podrían tener costos por SKU:");
  // Intentar consultar Dim_maestro_comercial por columna de costo
  const { data: dim, error: dimErr } = await sb
    .from("Dim_maestro_comercial")
    .select("*")
    .limit(1);
  if (dimErr) console.error("  Dim_maestro_comercial: ERROR", dimErr.message);
  else console.log("  Dim_maestro_comercial columnas:", Object.keys(dim[0] || {}));

  console.log("\n=== FIN DIAGNÓSTICO PARTE 2 ===");
}

run().catch(console.error);
