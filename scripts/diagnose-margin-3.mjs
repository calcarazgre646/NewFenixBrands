/**
 * Diagnóstico de Margen Bruto — Parte 3
 * ¿Cuáles filas tienen v_valor > 0 y cuáles no?
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://gwzllatcxxrizxtslkeh.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3emxsYXRjeHhyaXp4dHNsa2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTkxNjksImV4cCI6MjA4NzE3NTE2OX0.PAp7RH822TpIr9IMyzh7LbtgsZNiU7d37sFKU5GgtYg";

const sb = createClient(URL, KEY);

async function fetchAll(buildQuery) {
  const rows = [];
  let page = 0;
  while (true) {
    const from = page * 1000;
    const { data, error } = await buildQuery().range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return rows;
}

async function run() {
  console.log("=== DIAGNÓSTICO MARGEN — Parte 3: ¿Dónde hay costo? ===\n");

  // 1. Distribución v_valor por marca en 2026
  console.log("1. ¿Qué marcas tienen v_valor > 0 en fjdhstvta1 2026?");
  for (const marca of ["Martel", "Wrangler", "Lee", "Martel Premium"]) {
    const { data: withVal } = await sb
      .from("fjdhstvta1")
      .select("v_valor, v_vtasimpu", { count: "exact", head: false })
      .eq("v_año", 2026)
      .ilike("v_marca", `%${marca}%`)
      .gt("v_valor", 0)
      .in("v_canal_venta", ["B2C", "B2B"])
      .limit(5);

    const { count: totalMarca } = await sb
      .from("fjdhstvta1")
      .select("*", { count: "exact", head: true })
      .eq("v_año", 2026)
      .ilike("v_marca", `%${marca}%`)
      .in("v_canal_venta", ["B2C", "B2B"]);

    console.log(`  ${marca}: ${withVal?.length || 0} filas con costo (muestra) de ~${totalMarca} total`);
    if (withVal?.length) {
      for (const r of withVal.slice(0, 3)) {
        const m = r.v_vtasimpu > 0 ? ((r.v_vtasimpu - r.v_valor) / r.v_vtasimpu * 100).toFixed(1) : "N/A";
        console.log(`    v_valor=${r.v_valor}, neto=${r.v_vtasimpu}, margin=${m}%`);
      }
    }
  }

  // 2. Distribución v_valor por tienda en 2026
  console.log("\n2. ¿Qué tiendas tienen v_valor > 0?");
  const { data: storesWithCost } = await sb
    .from("fjdhstvta1")
    .select("v_sucursal_final")
    .eq("v_año", 2026)
    .gt("v_valor", 0)
    .in("v_canal_venta", ["B2C", "B2B"])
    .limit(1000);

  const storeCounts = {};
  for (const r of storesWithCost || []) {
    const s = r.v_sucursal_final?.trim() || "?";
    storeCounts[s] = (storeCounts[s] || 0) + 1;
  }
  const sorted = Object.entries(storeCounts).sort((a, b) => b[1] - a[1]);
  for (const [store, count] of sorted.slice(0, 15)) {
    console.log(`  ${store}: ${count} filas con v_valor > 0`);
  }

  // 3. Enfoque alternativo: calcular COGS desde inventario
  console.log("\n3. COGS CALCULADO desde inventario (e_costo × v_cantvend):");
  console.log("  Verificando: lookup cost por SKU desde mv_stock_tienda...");

  // Obtener costo promedio por SKU
  const invData = await fetchAll(() => sb
    .from("mv_stock_tienda")
    .select("sku, cost, units")
    .gt("units", 0)
    .gt("cost", 0)
  );

  const costBySku = new Map();
  const unitsBySku = new Map();
  for (const r of invData) {
    const sku = r.sku?.trim();
    if (!sku) continue;
    costBySku.set(sku, (costBySku.get(sku) || 0) + r.cost * r.units);
    unitsBySku.set(sku, (unitsBySku.get(sku) || 0) + r.units);
  }

  // Costo promedio ponderado por SKU
  const avgCostBySku = new Map();
  for (const [sku, totalCost] of costBySku) {
    const totalUnits = unitsBySku.get(sku);
    if (totalUnits > 0) avgCostBySku.set(sku, totalCost / totalUnits);
  }
  console.log(`  SKUs con costo conocido: ${avgCostBySku.size}`);

  // Tomar una muestra de ventas y calcular COGS real
  const { data: salesSample } = await sb
    .from("fjdhstvta1")
    .select("v_sku, v_cantvend, v_vtasimpu, v_valor, v_marca")
    .eq("v_año", 2026)
    .eq("v_mes", 3)
    .in("v_canal_venta", ["B2C"])
    .gt("v_vtasimpu", 0)
    .limit(20);

  let matchCount = 0, missCount = 0;
  let sampleNeto = 0, sampleCOGS_inv = 0, sampleCOGS_vvalor = 0;
  for (const r of salesSample || []) {
    const sku = r.v_sku?.trim();
    const cost = avgCostBySku.get(sku);
    const units = Math.abs(r.v_cantvend || 0);
    sampleNeto += r.v_vtasimpu;
    sampleCOGS_vvalor += r.v_valor || 0;
    if (cost) {
      sampleCOGS_inv += cost * units;
      matchCount++;
    } else {
      missCount++;
    }
  }
  console.log(`  Muestra 20 filas mes 3 B2C:`);
  console.log(`    SKUs con costo encontrado: ${matchCount}/${matchCount + missCount}`);
  console.log(`    Neto total: ${sampleNeto.toLocaleString()}`);
  console.log(`    COGS vía v_valor: ${sampleCOGS_vvalor.toLocaleString()} → margen: ${sampleNeto > 0 ? ((sampleNeto - sampleCOGS_vvalor) / sampleNeto * 100).toFixed(1) : "N/A"}%`);
  console.log(`    COGS vía inventario: ${Math.round(sampleCOGS_inv).toLocaleString()} → margen: ${sampleNeto > 0 ? ((sampleNeto - sampleCOGS_inv) / sampleNeto * 100).toFixed(1) : "N/A"}%`);

  // 4. Cálculo global mes 3 2026 con costo de inventario
  console.log("\n4. CÁLCULO GLOBAL mes 3 2026 con costo de inventario:");
  const allSales = await fetchAll(() => sb
    .from("fjdhstvta1")
    .select("v_sku, v_cantvend, v_vtasimpu, v_valor")
    .eq("v_año", 2026)
    .eq("v_mes", 3)
    .in("v_canal_venta", ["B2C", "B2B"])
    .gt("v_vtasimpu", 0)
  );

  let gNeto = 0, gCOGS_inv = 0, gCOGS_vvalor = 0, gMatched = 0, gMissed = 0;
  for (const r of allSales) {
    const sku = r.v_sku?.trim();
    const cost = avgCostBySku.get(sku);
    const units = Math.abs(r.v_cantvend || 0);
    gNeto += r.v_vtasimpu;
    gCOGS_vvalor += r.v_valor || 0;
    if (cost) {
      gCOGS_inv += cost * units;
      gMatched++;
    } else {
      gMissed++;
    }
  }
  console.log(`  Filas procesadas: ${allSales.length} (${gMatched} con costo, ${gMissed} sin)`);
  console.log(`  Neto: ${gNeto.toLocaleString()}`);
  console.log(`  COGS vía v_valor:     ${gCOGS_vvalor.toLocaleString()} → margen ${gNeto > 0 ? ((gNeto - gCOGS_vvalor) / gNeto * 100).toFixed(1) : "N/A"}%`);
  console.log(`  COGS vía inventario:  ${Math.round(gCOGS_inv).toLocaleString()} → margen ${gNeto > 0 ? ((gNeto - gCOGS_inv) / gNeto * 100).toFixed(1) : "N/A"}%`);
  console.log(`  Cobertura SKU: ${gMatched}/${gMatched + gMissed} (${((gMatched/(gMatched+gMissed))*100).toFixed(1)}%)`);

  console.log("\n=== FIN DIAGNÓSTICO PARTE 3 ===");
}

run().catch(console.error);
