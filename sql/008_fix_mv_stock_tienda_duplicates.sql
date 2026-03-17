-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: mv_stock_tienda — eliminar duplicados por atributos descriptivos
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEMA (17/03/2026):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_tienda falla con:
--   "new data contains duplicate rows without any null columns"
--
--   Causa: el GROUP BY incluye 13 columnas (descripcion, marca, estado comercial, etc.)
--   pero el índice UNIQUE es solo (store, sku, talle). Si un mismo SKU+talle+tienda tiene
--   dos filas en fjdexisemp con e_descrip o e_estcomer diferentes (comun en ERPs),
--   se generan filas duplicadas que chocan con el índice UNIQUE.
--
--   Ejemplo real: (SHOPPINEDO, 1038825, 43) tiene variantes de descripción.
--
-- FIX: Agrupar SOLO por (store, sku, talle) y usar MAX() para atributos descriptivos.
--   MAX() es determinístico y elige el valor "mayor" alfabéticamente, lo cual es
--   consistente entre refreshes.
--
-- EJECUCION:
--   1. Correr este script en Supabase SQL Editor
--   2. Verificar: SELECT COUNT(*) FROM mv_stock_tienda;
--   3. Verificar tiendas nuevas: SELECT DISTINCT store FROM mv_stock_tienda WHERE store IN ('WRSSL', 'WRMULTIPLAZA');

-- Paso 1: Eliminar la vista materializada vieja y sus índices
DROP MATERIALIZED VIEW IF EXISTS mv_stock_tienda CASCADE;

-- Paso 2: Recrear con GROUP BY correcto (solo store, sku, talle)
CREATE MATERIALIZED VIEW mv_stock_tienda AS
SELECT
  UPPER(TRIM(f.e_sucursal))   AS store,
  TRIM(f.e_sku)               AS sku,
  TRIM(f.e_talle)             AS talle,
  MAX(TRIM(f.e_descrip))      AS description,
  MAX(TRIM(f.e_rubro))        AS rubro,
  MAX(TRIM(f.e_marca))        AS brand,
  -- Priorizar tipo_articulo de la dimension (mas preciso que e_lineapr)
  MAX(COALESCE(
    NULLIF(TRIM(d.tipo_articulo), ''),
    NULLIF(TRIM(f.e_lineapr), ''),
    'Sin categoria'
  ))                            AS lineapr,
  MAX(TRIM(f.e_tipoart))      AS tipo_articulo,
  -- SKU Comercial de Dim_maestro_comercial (ej: "MACA004428")
  MAX(TRIM(d."codigo_unico_final")) AS sku_comercial,
  SUM(f.e_cantid)             AS units,
  MAX(f.e_precio)             AS price,
  MAX(f.e_precmay)            AS price_may,
  MAX(f.e_costo)              AS cost,
  SUM(f.e_valor)              AS value,
  MAX(TRIM(f.e_estcomer))     AS est_comercial,
  MAX(TRIM(f.e_carryov))      AS carry_over
FROM fjdexisemp f
LEFT JOIN (
  SELECT DISTINCT ON ("SKU-I", talla)
    "SKU-I", talla, tipo_articulo, "codigo_unico_final"
  FROM "Dim_maestro_comercial"
  ORDER BY "SKU-I", talla
) d
  ON TRIM(f.e_sku) ~ '^\d+$'
  AND d."SKU-I" = CAST(TRIM(f.e_sku) AS bigint)
  AND TRIM(d.talla) = TRIM(f.e_talle)
WHERE f.e_cantid > 0
  AND f.e_tpitem = '1'
GROUP BY
  UPPER(TRIM(f.e_sucursal)),
  TRIM(f.e_sku),
  TRIM(f.e_talle);

-- Paso 3: Recrear índices
CREATE UNIQUE INDEX idx_mv_stock_tienda_pk
  ON mv_stock_tienda (store, sku, talle);

CREATE INDEX idx_mv_stock_tienda_sku
  ON mv_stock_tienda (sku);

CREATE INDEX idx_mv_stock_tienda_sku_comercial
  ON mv_stock_tienda (sku_comercial);

-- Paso 4: Verificación
-- SELECT COUNT(*) FROM mv_stock_tienda;
-- SELECT DISTINCT store FROM mv_stock_tienda WHERE store IN ('WRSSL', 'WRMULTIPLAZA');
-- SELECT COUNT(DISTINCT store) FROM mv_stock_tienda;
