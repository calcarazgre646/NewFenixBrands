import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gwzllatcxxrizxtslkeh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3emxsYXRjeHhyaXp4dHNsa2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTkxNjksImV4cCI6MjA4NzE3NTE2OX0.PAp7RH822TpIr9IMyzh7LbtgsZNiU7d37sFKU5GgtYg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const KNOWN_TABLES = [
  "fjdhstvta1", "fjdexisemp", "fintsucu", "fmetasucu",
  "Budget_2026", "Import", "Dim_maestro_comercial", "Dim_marcas",
  "mv_ventas_mensual", "mv_stock_tienda", "mv_ventas_12m_por_tienda_sku",
  "v_inventario", "vw_ticket_promedio_diario",
  "calendar_events", "calendar_categories",
];

function hr(title) {
  console.log("\n" + "=".repeat(80));
  console.log(`  ${title}`);
  console.log("=".repeat(80));
}

function printTable(rows, maxColWidth = 40) {
  if (!rows || rows.length === 0) { console.log("  (no rows)"); return; }
  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) => {
    const vals = rows.map((r) => { const v = r[c]; return v === null ? "NULL" : String(v); });
    return Math.min(maxColWidth, Math.max(c.length, ...vals.map((v) => v.length)));
  });
  console.log("  " + cols.map((c, i) => c.padEnd(widths[i])).join(" | "));
  console.log("  " + widths.map((w) => "-".repeat(w)).join("-+-"));
  for (const row of rows) {
    const line = cols.map((c, i) => {
      const v = row[c]; const s = v === null ? "NULL" : String(v);
      return s.length > widths[i] ? s.slice(0, widths[i] - 1) + "~" : s.padEnd(widths[i]);
    }).join(" | ");
    console.log("  " + line);
  }
}

/** Try to fetch 1 row from table. Returns true if the table actually exists. */
async function tableExists(name) {
  const { data, error } = await supabase.from(name).select("*").limit(1);
  // If table truly doesn't exist, error.code will be "PGRST204" or message contains "schema cache"
  if (error && error.message.includes("schema cache")) return false;
  if (error && error.code === "42P01") return false;
  // If no error, or error is just RLS, the table exists
  return true;
}

async function main() {
  // ─── 1. List ALL real tables ──────────────────────────────────────────
  hr("1. ALL TABLES IN DATABASE");

  const candidates = [
    ...KNOWN_TABLES,
    "CLIM100", "clim100", "profiles", "users", "action_queue",
    "action_queue_items", "ejecutivos", "tiendas", "sucursales",
    "Dim_tiendas", "Dim_ejecutivos", "Dim_categorias",
    "mv_kpi_ejecutivo", "mv_kpi_tienda", "mv_resumen_ejecutivo",
    "mv_ventas_diarias", "mv_ventas_semanal",
    "vw_ventas_ejecutivo", "vw_stock_valorizado",
    "maestro_comercial", "maestro_sku",
    "clientes", "productos", "pedidos", "marcas", "categorias",
    "inventario", "stock", "metas", "presupuesto",
    "log_acciones", "notifications", "settings", "config",
  ];

  const realTables = [];
  const seen = new Set();

  for (const t of candidates) {
    if (seen.has(t)) continue;
    seen.add(t);
    const exists = await tableExists(t);
    if (exists) {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      realTables.push({ table: t, row_count: count ?? 0 });
    }
  }

  realTables.sort((a, b) => b.row_count - a.row_count);
  console.log(`  Found ${realTables.length} real tables:`);
  printTable(realTables);

  // ─── 2. Dim_maestro_comercial: 10 sample rows ────────────────────────
  hr("2. Dim_maestro_comercial - 10 SAMPLE ROWS (all columns)");
  const { data: maestroSample } = await supabase
    .from("Dim_maestro_comercial").select("*").limit(10);

  if (maestroSample && maestroSample.length > 0) {
    const cols = Object.keys(maestroSample[0]);
    console.log(`  Columns (${cols.length}): ${cols.join(", ")}`);
    console.log();
    printTable(maestroSample, 35);
  }

  // ─── 3. Distinct values of key columns ────────────────────────────────
  hr("3. Dim_maestro_comercial - DISTINCT VALUES");

  // tipo_articulo - paginate to get all distinct values
  console.log("\n  --- tipo_articulo ---");
  const allTipos = new Set();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("Dim_maestro_comercial")
      .select("tipo_articulo")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    data.forEach((r) => allTipos.add(r.tipo_articulo));
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 600000) break; // safety
  }
  const tiposSorted = [...allTipos].filter(Boolean).sort();
  console.log(`  ${tiposSorted.length} distinct values:`);
  tiposSorted.forEach((v) => console.log(`    - "${v}"`));

  // Check all columns for brand-like or category-like info
  if (maestroSample && maestroSample.length > 0) {
    const allCols = Object.keys(maestroSample[0]);
    for (const col of allCols) {
      if (col === "tipo_articulo") continue;
      console.log(`\n  --- ${col} (sample distinct) ---`);
      const distinctVals = new Set();
      let offset = 0;
      while (distinctVals.size < 200) {
        const { data } = await supabase
          .from("Dim_maestro_comercial")
          .select(col)
          .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        data.forEach((r) => distinctVals.add(r[col]));
        offset += 1000;
        if (offset > 20000) break; // just sample first 20k rows
      }
      const sorted = [...distinctVals].filter((v) => v !== null).sort();
      console.log(`  ~${sorted.length} distinct values in first ${Math.min(offset, 511086)} rows`);
      if (sorted.length <= 50) {
        sorted.forEach((v) => console.log(`    - "${v}"`));
      } else {
        sorted.slice(0, 20).forEach((v) => console.log(`    - "${v}"`));
        console.log(`    ... and ${sorted.length - 20} more`);
      }
    }
  }

  // ─── 4. Total row count ───────────────────────────────────────────────
  hr("4. Dim_maestro_comercial - TOTAL ROW COUNT");
  const { count: totalRows } = await supabase
    .from("Dim_maestro_comercial").select("*", { count: "exact", head: true });
  console.log(`  Total rows: ${totalRows}`);

  // ─── 5. codigo_unico_final populated vs null ──────────────────────────
  hr("5. Dim_maestro_comercial - codigo_unico_final COVERAGE");
  const { count: withCUF } = await supabase
    .from("Dim_maestro_comercial").select("*", { count: "exact", head: true })
    .not("codigo_unico_final", "is", null).neq("codigo_unico_final", "");
  const { count: nullCUF } = await supabase
    .from("Dim_maestro_comercial").select("*", { count: "exact", head: true })
    .is("codigo_unico_final", null);
  const { count: emptyCUF } = await supabase
    .from("Dim_maestro_comercial").select("*", { count: "exact", head: true })
    .eq("codigo_unico_final", "");

  console.log(`  Populated: ${withCUF}`);
  console.log(`  NULL:      ${nullCUF}`);
  console.log(`  Empty '':  ${emptyCUF}`);

  // ─── 6. SKU mapping sample ────────────────────────────────────────────
  hr("6. SKU MAPPING SAMPLE");

  // Get diverse samples by picking different tipo_articulo
  const { data: diverseSample } = await supabase
    .from("Dim_maestro_comercial")
    .select("*")
    .not("codigo_unico_final", "is", null)
    .neq("codigo_unico_final", "")
    .limit(20);

  if (diverseSample) {
    printTable(diverseSample, 45);
  }

  // Also get some from different offsets for variety
  console.log("\n  --- Samples from middle of table ---");
  const { data: midSample } = await supabase
    .from("Dim_maestro_comercial")
    .select("*")
    .range(200000, 200009);
  if (midSample) printTable(midSample, 45);

  console.log("\n  --- Samples from end of table ---");
  const { data: endSample } = await supabase
    .from("Dim_maestro_comercial")
    .select("*")
    .range(500000, 500009);
  if (endSample) printTable(endSample, 45);

  // ─── 7. Unknown tables ────────────────────────────────────────────────
  hr("7. TABLES NOT IN KNOWN LIST");
  const knownLower = new Set(KNOWN_TABLES.map((t) => t.toLowerCase()));
  const unknownTables = realTables.filter((t) => !knownLower.has(t.table.toLowerCase()));

  if (unknownTables.length === 0) {
    console.log("  All accessible tables are in the known list.");
  } else {
    console.log(`  ${unknownTables.length} table(s) NOT in the known list:`);
    printTable(unknownTables);
  }

  // ─── 8. Unknown tables sample rows ────────────────────────────────────
  if (unknownTables.length > 0) {
    hr("8. UNKNOWN TABLES - SAMPLE DATA");
    for (const t of unknownTables) {
      console.log(`\n  --- ${t.table} (${t.row_count} rows) ---`);
      const { data: sample, error } = await supabase.from(t.table).select("*").limit(3);
      if (error) {
        console.log(`  Error: ${error.message}`);
      } else if (sample && sample.length > 0) {
        console.log(`  Columns (${Object.keys(sample[0]).length}): ${Object.keys(sample[0]).join(", ")}`);
        printTable(sample, 50);
      } else {
        console.log("  (empty table)");
      }
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────
  hr("SUMMARY");
  console.log(`  Total real tables found: ${realTables.length}`);
  console.log(`  Known tables present:    ${realTables.length - unknownTables.length}`);
  console.log(`  Unknown/new tables:      ${unknownTables.length}`);
  console.log(`  Dim_maestro_comercial:   ${totalRows} rows, ${maestroSample ? Object.keys(maestroSample[0]).length : "?"} columns`);
  console.log(`  codigo_unico_final:      ${withCUF} populated / ${nullCUF} null / ${emptyCUF} empty`);

  console.log("\n" + "=".repeat(80));
  console.log("  AUDIT COMPLETE");
  console.log("=".repeat(80));
}

main().catch(console.error);
