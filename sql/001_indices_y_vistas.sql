-- =============================================================================
-- NewFenixBrands — Optimizacion de Base de Datos
-- =============================================================================
-- Ejecutar en Supabase SQL Editor (en orden, seccion por seccion)
-- Fecha: 2026-03-07
--
-- RESUMEN:
--   1. Indices para fjdhstvta1 (252K filas — tabla de hechos principal)
--   2. Indices para fjdexisemp (54K filas — inventario)
--   3. Fix de v_inventario (JOIN cartesiano → 429K filas infladas)
--   4. Vista materializada mv_stock_tienda (inventario pre-agregado)
--   5. Vista materializada mv_historial_ventas_12m (historial pre-agregado)
--   6. Refresh automatico (cron job)
--   7. Indice para mv_ventas_mensual
--   8. Indice para vw_ticket_promedio_diario base tables
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCION 1: Indices para fjdhstvta1 (ventas detalle — 252K filas)
-- ─────────────────────────────────────────────────────────────────────────────
-- Esta tabla se consulta en CADA pagina de la app.
-- Sin indices, cualquier query con .order() causa statement timeout.

-- Indice principal: ano + mes (90% de las queries filtran por esto)
CREATE INDEX IF NOT EXISTS idx_fjdhstvta1_year_month
  ON fjdhstvta1 (v_año, v_mes);

-- Indice para SKU lookups (fetchActiveSkus, fetchSalesHistory, fetchTopSkus)
CREATE INDEX IF NOT EXISTS idx_fjdhstvta1_year_month_sku
  ON fjdhstvta1 (v_año, v_mes, v_sku);

-- Indice para canal (todas las queries filtran B2C/B2B)
CREATE INDEX IF NOT EXISTS idx_fjdhstvta1_year_canal
  ON fjdhstvta1 (v_año, v_canal_venta);

-- Indice compuesto para fetchDailyDetail y fetchPriorYearMTD
-- (filtran por ano + mes + canal + dia)
CREATE INDEX IF NOT EXISTS idx_fjdhstvta1_year_month_canal
  ON fjdhstvta1 (v_año, v_mes, v_canal_venta);

-- Indice para sucursal final (usado en historial por tienda)
CREATE INDEX IF NOT EXISTS idx_fjdhstvta1_sucursal_final
  ON fjdhstvta1 (v_sucursal_final);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCION 2: Indices para fjdexisemp (inventario — 54K filas)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sin indices, no se puede hacer .order() sin timeout.

-- Indice para el filtro principal de la Cola de Acciones
-- (fetchInventory filtra: e_sku IN (...) AND e_cantid > 0 AND e_tpitem = '1')
CREATE INDEX IF NOT EXISTS idx_fjdexisemp_sku_active
  ON fjdexisemp (e_sku)
  WHERE e_cantid > 0 AND e_tpitem = '1';

-- Indice para sucursal (agrupaciones por tienda)
CREATE INDEX IF NOT EXISTS idx_fjdexisemp_sucursal
  ON fjdexisemp (e_sucursal)
  WHERE e_cantid > 0 AND e_tpitem = '1';

-- Indice para fetchInventoryValue (recorre toda la tabla, agrupa por marca)
CREATE INDEX IF NOT EXISTS idx_fjdexisemp_marca_active
  ON fjdexisemp (e_marca)
  WHERE e_cantid > 0 AND e_tpitem = '1';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCION 3: Fix v_inventario (BUG del JOIN cartesiano)
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEMA: La vista actual hace JOIN entre fjdexisemp y Dim_maestro_comercial
-- sin condicion de talla, produciendo 429K filas vs 54K reales (7.8x inflacion).
--
-- Si la vista actual no se usa en produccion, se puede reemplazar.
-- Si otros sistemas la usan, crear una v2 en paralelo.

-- Primero veamos la definicion actual:
-- SELECT definition FROM pg_views WHERE viewname = 'v_inventario';

-- Fix: recrear con JOIN correcto (SKU + talla)
DROP VIEW IF EXISTS v_inventario;
CREATE VIEW v_inventario AS
SELECT
  f.*,
  d.tipo_articulo
FROM fjdexisemp f
LEFT JOIN "Dim_maestro_comercial" d
  ON TRIM(f.e_sku) ~ '^\d+$'
  AND d."SKU-I" = CAST(TRIM(f.e_sku) AS bigint)
  AND TRIM(d.talla) = TRIM(f.e_talle)
;

-- Verificar que el fix funciono (debe dar ~54K, NO 429K):
-- SELECT COUNT(*) FROM v_inventario;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCION 4: Vista materializada — Stock por tienda (para Cola de Acciones)
-- ─────────────────────────────────────────────────────────────────────────────
-- ANTES: El frontend trae 54K filas de fjdexisemp en 37+ requests paginados.
-- DESPUES: El frontend trae ~5K-8K filas en 5-8 requests.
--
-- Esta vista pre-agrega por (tienda, sku, talle) y normaliza nombres.
-- Incluye tipo_articulo de Dim_maestro_comercial para categorias correctas.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stock_tienda AS
SELECT
  UPPER(TRIM(f.e_sucursal))  AS store,
  TRIM(f.e_sku)              AS sku,
  TRIM(f.e_talle)            AS talle,
  TRIM(f.e_descrip)          AS description,
  TRIM(f.e_rubro)            AS rubro,
  TRIM(f.e_marca)            AS brand,
  -- Priorizar tipo_articulo de la dimension (mas preciso que e_lineapr)
  COALESCE(
    NULLIF(TRIM(d.tipo_articulo), ''),
    NULLIF(TRIM(f.e_lineapr), ''),
    'Sin categoria'
  )                           AS lineapr,
  TRIM(f.e_tipoart)          AS tipo_articulo,
  SUM(f.e_cantid)            AS units,
  MAX(f.e_precio)            AS price,
  MAX(f.e_precmay)           AS price_may,
  MAX(f.e_costo)             AS cost,
  SUM(f.e_valor)             AS value,
  TRIM(f.e_estcomer)         AS est_comercial,
  TRIM(f.e_carryov)          AS carry_over,
  f.e_tpitem                 AS tpitem
FROM fjdexisemp f
LEFT JOIN "Dim_maestro_comercial" d
  ON TRIM(f.e_sku) ~ '^\d+$'
  AND d."SKU-I" = CAST(TRIM(f.e_sku) AS bigint)
  AND TRIM(d.talla) = TRIM(f.e_talle)
WHERE f.e_cantid > 0
  AND f.e_tpitem = '1'
GROUP BY
  UPPER(TRIM(f.e_sucursal)),
  TRIM(f.e_sku),
  TRIM(f.e_talle),
  TRIM(f.e_descrip),
  TRIM(f.e_rubro),
  TRIM(f.e_marca),
  COALESCE(NULLIF(TRIM(d.tipo_articulo), ''), NULLIF(TRIM(f.e_lineapr), ''), 'Sin categoria'),
  TRIM(f.e_tipoart),
  TRIM(f.e_estcomer),
  TRIM(f.e_carryov),
  f.e_tpitem
;

-- Indice para la vista materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stock_tienda_pk
  ON mv_stock_tienda (store, sku, talle);

CREATE INDEX IF NOT EXISTS idx_mv_stock_tienda_sku
  ON mv_stock_tienda (sku);

-- Verificar:
-- SELECT COUNT(*) FROM mv_stock_tienda;
-- Esperado: ~5K-10K filas (vs 54K en fjdexisemp)


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCION 5: Vista materializada — Historial ventas 12 meses
-- ─────────────────────────────────────────────────────────────────────────────
-- ANTES: El frontend hace 100s de requests paginados a fjdhstvta1 (252K filas)
--        para calcular promedio por (tienda, sku) de los ultimos 12 meses.
-- DESPUES: Un solo request de ~8K-15K filas pre-calculadas.
--
-- Se recalcula con REFRESH. Los meses se filtran dinamicamente.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ventas_12m_por_tienda_sku AS
SELECT
  UPPER(TRIM(v_sucursal_final))  AS store,
  TRIM(v_sku)                    AS sku,
  v_año::int                     AS year,
  v_mes::int                     AS month,
  SUM(v_cantvend)                AS total_units,
  SUM(v_vtasimpu)                AS total_sales,
  COUNT(*)                       AS tx_count
FROM fjdhstvta1
WHERE v_vtasimpu > 0
  AND v_año >= (EXTRACT(YEAR FROM CURRENT_DATE) - 1)
GROUP BY
  UPPER(TRIM(v_sucursal_final)),
  TRIM(v_sku),
  v_año::int,
  v_mes::int
;

-- Indices para la vista
CREATE INDEX IF NOT EXISTS idx_mv_ventas_12m_store_sku
  ON mv_ventas_12m_por_tienda_sku (store, sku);

CREATE INDEX IF NOT EXISTS idx_mv_ventas_12m_year_month
  ON mv_ventas_12m_por_tienda_sku (year, month);

-- Verificar:
-- SELECT COUNT(*) FROM mv_ventas_12m_por_tienda_sku;
-- SELECT * FROM mv_ventas_12m_por_tienda_sku LIMIT 10;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCION 6: Indice para mv_ventas_mensual (vista materializada existente)
-- ─────────────────────────────────────────────────────────────────────────────
-- La app filtra por (v_año, v_canal_venta) en casi todas las queries.

CREATE INDEX IF NOT EXISTS idx_mv_ventas_mensual_year_canal
  ON mv_ventas_mensual (v_año, v_canal_venta);

CREATE INDEX IF NOT EXISTS idx_mv_ventas_mensual_year
  ON mv_ventas_mensual (v_año);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCION 7: Refresh de las vistas materializadas
-- ─────────────────────────────────────────────────────────────────────────────
-- Ejecutar manualmente o configurar cron en Supabase Dashboard.
-- Recomendado: cada 6 horas o al inicio de cada dia laboral.

-- Refresh manual (ejecutar cuando quieras datos frescos):
REFRESH MATERIALIZED VIEW mv_ventas_mensual;
REFRESH MATERIALIZED VIEW mv_stock_tienda;
REFRESH MATERIALIZED VIEW mv_ventas_12m_por_tienda_sku;

-- Para cron automatico, ir a:
-- Supabase Dashboard → Database → Extensions → habilitar pg_cron
-- Luego ejecutar:
--
-- SELECT cron.schedule(
--   'refresh-vistas-6am',
--   '0 6 * * 1-6',  -- Lun-Sab a las 6:00 AM
--   $$
--     REFRESH MATERIALIZED VIEW mv_ventas_mensual;
--     REFRESH MATERIALIZED VIEW mv_stock_tienda;
--     REFRESH MATERIALIZED VIEW mv_ventas_12m_por_tienda_sku;
--   $$
-- );


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCION 8: Verificacion final
-- ─────────────────────────────────────────────────────────────────────────────
-- Ejecutar estas queries para confirmar que todo funciona:

-- 1. Indices creados
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('fjdhstvta1', 'fjdexisemp', 'mv_ventas_mensual',
                     'mv_stock_tienda', 'mv_ventas_12m_por_tienda_sku')
ORDER BY tablename, indexname;

-- 2. Tamano de vistas materializadas
SELECT relname AS vista, n_live_tup AS filas_aprox
FROM pg_stat_user_tables
WHERE relname IN ('mv_ventas_mensual', 'mv_stock_tienda', 'mv_ventas_12m_por_tienda_sku')
ORDER BY relname;

-- 3. v_inventario corregida (debe ser ~54K, NO 429K)
SELECT COUNT(*) AS filas_v_inventario FROM v_inventario;

-- 4. Stock por tienda (debe ser ~5K-10K)
SELECT COUNT(*) AS filas_stock FROM mv_stock_tienda;

-- 5. Historial 12m (debe ser ~8K-20K)
SELECT COUNT(*) AS filas_historial FROM mv_ventas_12m_por_tienda_sku;

-- 6. Categorias disponibles en mv_stock_tienda (para verificar tipo_articulo)
SELECT lineapr, COUNT(*) AS items
FROM mv_stock_tienda
GROUP BY lineapr
ORDER BY items DESC
LIMIT 20;
