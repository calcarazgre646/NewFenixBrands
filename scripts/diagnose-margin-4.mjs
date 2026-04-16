/**
 * Diagnóstico de Margen Bruto — Parte 4
 * Búsqueda exhaustiva de datos de costo en TODA la BD
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://gwzllatcxxrizxtslkeh.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3emxsYXRjeHhyaXp4dHNsa2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTkxNjksImV4cCI6MjA4NzE3NTE2OX0.PAp7RH822TpIr9IMyzh7LbtgsZNiU7d37sFKU5GgtYg";

const sb = createClient(URL, KEY);

async function run() {
  console.log("=== BÚSQUEDA EXHAUSTIVA DE COSTOS ===\n");

  // 1. Listar TODAS las tablas y vistas en la BD
  console.log("1. TODAS las tablas/vistas en el schema public:");
  const { data: tables, error: tablesErr } = await sb.rpc("get_tables_list", {}).catch(() => ({ data: null, error: { message: "RPC no existe" } }));
  if (tablesErr || !tables) {
    // Fallback: intentar leer information_schema o pg_tables
    // Probar tablas que podrían tener costos
    const candidates = [
      "fjdhstvta1", "fjdexisemp", "mv_ventas_mensual", "mv_ventas_diarias",
      "mv_stock_tienda", "mv_ventas_12m_por_tienda_sku",
      "Budget_2026", "Budget_2025", "budget_mensual", "budget",
      "fmetasucu", "v_inventario", "v_transacciones_dwh",
      "maestro_clientes_mayoristas", "Dim_maestro_comercial", "Dim_marcas",
      "c_cobrar", "comisiones_metas_vendedor",
      "fjdhstvta2", "fjdhstvta", "fjdhstcst", "fjdcostos", "costos",
      "costo_producto", "precio_costo", "margen", "margin",
      "productos_importacion", "Import",
      "movimientos_st_jde",
    ];

    console.log("  Probando tablas candidatas...");
    for (const table of candidates) {
      const { data, error } = await sb.from(table).select("*").limit(1);
      if (!error && data && data.length > 0) {
        const cols = Object.keys(data[0]);
        const costCols = cols.filter(c =>
          /cost|costo|valor|precio|margin|margen|cogs/i.test(c)
        );
        console.log(`  ✓ ${table}: ${cols.length} columnas${costCols.length ? ` — COST-RELATED: [${costCols.join(", ")}]` : ""}`);
      } else if (error && !error.message.includes("does not exist") && !error.message.includes("relation")) {
        console.log(`  ? ${table}: ${error.message.substring(0, 80)}`);
      }
    }
  }

  // 2. Buscar en v_transacciones_dwh — tiene alguna columna de costo?
  console.log("\n2. v_transacciones_dwh — estructura y columnas:");
  const { data: dwh, error: dwhErr } = await sb.from("v_transacciones_dwh").select("*").limit(2);
  if (dwhErr) console.log("  ERROR:", dwhErr.message);
  else if (dwh && dwh.length > 0) {
    console.log("  Columnas:", Object.keys(dwh[0]).join(", "));
    console.log("  Muestra:", JSON.stringify(dwh[0], null, 2));
  }

  // 3. Budget_2026 — tiene costos?
  console.log("\n3. Budget_2026 — estructura:");
  const { data: budget, error: budgetErr } = await sb.from("Budget_2026").select("*").limit(2);
  if (budgetErr) console.log("  ERROR:", budgetErr.message);
  else if (budget && budget.length > 0) {
    console.log("  Columnas:", Object.keys(budget[0]).join(", "));
    const costCols = Object.keys(budget[0]).filter(c => /cost|costo|valor|margen|margin|cogs/i.test(c));
    if (costCols.length) console.log("  COST COLUMNS:", costCols);
    console.log("  Muestra:", JSON.stringify(budget[0], null, 2));
  }

  // 4. Verificar si fjdhstvta1 tiene MÁS columnas de las que usamos
  console.log("\n4. fjdhstvta1 — TODAS las columnas:");
  const { data: vtaFull, error: vtaErr } = await sb.from("fjdhstvta1").select("*").limit(1);
  if (vtaErr) console.log("  ERROR:", vtaErr.message);
  else if (vtaFull && vtaFull.length > 0) {
    const cols = Object.keys(vtaFull[0]);
    console.log(`  Total columnas: ${cols.length}`);
    console.log("  Columnas:", cols.join(", "));
    const costCols = cols.filter(c => /cost|costo|valor|precio|margen|margin|cogs|imp|monto/i.test(c));
    console.log("  POSIBLES COST/VALUE COLS:", costCols);
    for (const c of costCols) {
      console.log(`    ${c} = ${vtaFull[0][c]}`);
    }
  }

  // 5. Verificar Import/productos_importacion — tiene costos FOB?
  console.log("\n5. productos_importacion / Import — costos FOB:");
  for (const table of ["productos_importacion", "Import"]) {
    const { data, error } = await sb.from(table).select("*").limit(1);
    if (!error && data && data.length > 0) {
      const cols = Object.keys(data[0]);
      const costCols = cols.filter(c => /cost|costo|valor|precio|fob|cif/i.test(c));
      console.log(`  ${table}: ${cols.length} cols, cost-related: [${costCols.join(", ")}]`);
    }
  }

  // 6. movimientos_st_jde — podría tener costos de movimientos
  console.log("\n6. movimientos_st_jde — estructura:");
  const { data: mov, error: movErr } = await sb.from("movimientos_st_jde").select("*").limit(1);
  if (movErr) console.log("  ERROR:", movErr.message);
  else if (mov && mov.length > 0) {
    const cols = Object.keys(mov[0]);
    const costCols = cols.filter(c => /cost|costo|valor|precio|monto/i.test(c));
    console.log(`  Columnas: ${cols.length}, cost-related: [${costCols.join(", ")}]`);
    if (costCols.length) {
      for (const c of costCols) console.log(`    ${c} = ${mov[0][c]}`);
    }
  }

  // 7. Verificar si v_valor CAMBIÓ recientemente — comparar distribución 2025 vs 2026
  console.log("\n7. Distribución v_valor por año (¿cambió recientemente?):");
  for (const year of [2025, 2026]) {
    const { data: withV } = await sb
      .from("fjdhstvta1")
      .select("v_mes, v_valor")
      .eq("v_año", year)
      .gt("v_valor", 0)
      .in("v_canal_venta", ["B2C", "B2B"])
      .limit(1000);

    if (withV && withV.length > 0) {
      const byMonth = {};
      for (const r of withV) {
        const m = r.v_mes;
        if (!byMonth[m]) byMonth[m] = 0;
        byMonth[m]++;
      }
      console.log(`  ${year}: ${withV.length} filas con v_valor>0 (puede ser truncado a 1000)`);
      for (const [m, cnt] of Object.entries(byMonth).sort((a,b) => a[0]-b[0])) {
        console.log(`    Mes ${m}: ${cnt} filas`);
      }
    } else {
      console.log(`  ${year}: 0 filas con v_valor > 0`);
    }
  }

  // 8. Verificar si la definición de mv_ventas_mensual es consultable
  console.log("\n8. Intentar obtener la definición de mv_ventas_mensual:");
  // Intentar via pg_matviews (probablemente no accesible via API)
  const { data: matview } = await sb
    .from("pg_matviews")
    .select("matviewname, definition")
    .eq("matviewname", "mv_ventas_mensual")
    .limit(1);
  if (matview && matview.length > 0) {
    console.log("  DEFINICIÓN:", matview[0].definition);
  } else {
    console.log("  No accesible vía API. Ejecutar en SQL Editor:");
    console.log("  SELECT definition FROM pg_matviews WHERE matviewname = 'mv_ventas_mensual';");
  }

  // 9. Verificar si existe alguna tabla de costos que no conocemos
  console.log("\n9. Buscando tablas con 'cost' o 'costo' en el nombre:");
  for (const pattern of ["cost", "costo", "precio", "margen", "margin", "tarifa"]) {
    const { data } = await sb.from(`${pattern}`).select("*").limit(1).catch(() => ({ data: null }));
    // This won't work for finding tables, but let's try common patterns
  }

  // 10. Verificar EXACTAMENTE qué lee el frontend vs qué hay en la BD
  console.log("\n10. VERIFICACIÓN FINAL — ¿El frontend lee lo correcto?");
  console.log("  Query del frontend: mv_ventas_mensual.select('neto, costo, bruto, dcto')");
  const { data: frontendView } = await sb
    .from("mv_ventas_mensual")
    .select("neto, costo, bruto, dcto, unidades")
    .eq("v_año", 2026)
    .eq("v_mes", 3)
    .in("v_canal_venta", ["B2C", "B2B"])
    .limit(5);

  if (frontendView) {
    let sumNeto = 0, sumCosto = 0;
    for (const r of frontendView) {
      sumNeto += r.neto || 0;
      sumCosto += r.costo || 0;
    }
    console.log(`  Primeras 5 filas mes 3: sumNeto=${sumNeto.toLocaleString()}, sumCosto=${sumCosto.toLocaleString()}`);
    console.log(`  Ratio costo/neto: ${sumNeto > 0 ? (sumCosto/sumNeto*100).toFixed(1) : "N/A"}%`);
    console.log("  Detalle:");
    for (const r of frontendView) {
      console.log(`    neto=${r.neto?.toLocaleString()}, costo=${r.costo?.toLocaleString()}, bruto=${r.bruto?.toLocaleString()}, dcto=${r.dcto?.toLocaleString()}, units=${r.unidades}`);
    }
  }

  console.log("\n=== FIN BÚSQUEDA EXHAUSTIVA ===");
}

run().catch(console.error);
