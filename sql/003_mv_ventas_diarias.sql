-- =============================================================================
-- NewFenixBrands — Vista Materializada: Ventas Diarias Pre-Agregadas
-- =============================================================================
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-03-09
--
-- PROBLEMA:
--   Para YoY del mes en curso (ej: 9 días de Marzo 2026 vs 9 días de Marzo 2025),
--   necesitamos datos diarios del año anterior. Pero fjdhstvta1 tiene 230K+ filas
--   por año — demasiadas para traer vía API.
--
-- SOLUCION:
--   Vista materializada que pre-agrega ventas por (año, mes, día, marca, canal).
--   Resultado: ~2.000 filas por año (vs 230K en la tabla cruda).
--   Se puede consultar con filtro de día para comparaciones precisas.
--
-- USO:
--   - Comparar 9 días de Marzo 2026 vs exactamente 9 días de Marzo 2025
--   - Funciona para cualquier filtro de marca/canal
--   - No incluye dimensión tienda (no se necesita para YoY ejecutivo/ventas)
--   - Si en el futuro se necesita tienda, se puede agregar otra vista
--
-- FILAS ESPERADAS:
--   ~365 días × 3 marcas × 2 canales = ~2.190 filas por año
--   Con 2 años (2025+2026): ~3.000-4.000 filas total
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1: Crear la vista materializada
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ventas_diarias AS
SELECT
  v_año::int                     AS year,
  v_mes::int                     AS month,
  v_dia::int                     AS day,
  TRIM(v_marca)                  AS brand,
  v_canal_venta                  AS channel,
  SUM(v_vtasimpu)                AS neto,
  SUM(v_valor)                   AS costo,
  SUM(v_impbruto)                AS bruto,
  SUM(v_impdscto)                AS dcto,
  SUM(v_cantvend)                AS units
FROM fjdhstvta1
WHERE v_canal_venta IN ('B2C', 'B2B')
GROUP BY
  v_año::int,
  v_mes::int,
  v_dia::int,
  TRIM(v_marca),
  v_canal_venta
;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2: Indices para queries rápidas
-- ─────────────────────────────────────────────────────────────────────────────

-- Indice principal: año + mes + día (para filtrar rango de días)
CREATE INDEX IF NOT EXISTS idx_mv_ventas_diarias_ymd
  ON mv_ventas_diarias (year, month, day);

-- Indice para filtro por año + mes (traer todo el mes)
CREATE INDEX IF NOT EXISTS idx_mv_ventas_diarias_ym
  ON mv_ventas_diarias (year, month);

-- Indice único para refresh concurrente (si se necesita en el futuro)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ventas_diarias_pk
  ON mv_ventas_diarias (year, month, day, brand, channel);


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3: Verificación
-- ─────────────────────────────────────────────────────────────────────────────

-- Total de filas (esperado: ~3.000-4.000)
SELECT COUNT(*) AS total_filas FROM mv_ventas_diarias;

-- Filas por año
SELECT year, COUNT(*) AS filas
FROM mv_ventas_diarias
GROUP BY year
ORDER BY year;

-- Ejemplo: Marzo 2025, primeros 9 días, por marca
SELECT brand, channel, SUM(neto) AS neto_total
FROM mv_ventas_diarias
WHERE year = 2025 AND month = 3 AND day <= 9
GROUP BY brand, channel
ORDER BY brand, channel;

-- Comparar con el total mensual de mv_ventas_mensual (deben coincidir)
SELECT 'diarias' AS fuente, SUM(neto) AS total
FROM mv_ventas_diarias
WHERE year = 2025 AND month = 3
UNION ALL
SELECT 'mensual' AS fuente, SUM(neto) AS total
FROM mv_ventas_mensual
WHERE v_año = 2025 AND v_mes = 3;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4: Agregar al refresh programado
-- ─────────────────────────────────────────────────────────────────────────────
-- Agregar a la línea de refresh del cron existente:
--
-- REFRESH MATERIALIZED VIEW mv_ventas_diarias;
--
-- O si se configuró pg_cron, actualizar el job:
-- SELECT cron.schedule(
--   'refresh-vistas-6am',
--   '0 6 * * 1-6',
--   $$
--     REFRESH MATERIALIZED VIEW mv_ventas_mensual;
--     REFRESH MATERIALIZED VIEW mv_stock_tienda;
--     REFRESH MATERIALIZED VIEW mv_ventas_12m_por_tienda_sku;
--     REFRESH MATERIALIZED VIEW mv_ventas_diarias;
--   $$
-- );
