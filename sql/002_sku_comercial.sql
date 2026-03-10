-- =============================================================================
-- NewFenixBrands — Agregar SKU Comercial a mv_stock_tienda
-- =============================================================================
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-03-08
--
-- MOTIVO:
--   Instruccion de Rodrigo (25/02): "Todo analisis de SKU debe hacerse sobre
--   la base del SKU Comercial y no la Referencia del ERP."
--
--   Dim_maestro_comercial tiene el campo codigo_unico_final (ej: "MACA004428")
--   que es el SKU Comercial. La vista ya hace JOIN con esta tabla pero no
--   exponia este campo. Este script lo agrega.
--
-- IMPACTO: La vista materializada se recrea. El indice unico tambien.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1: Eliminar la vista materializada existente
-- ─────────────────────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_stock_tienda CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2: Recrear con sku_comercial
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW mv_stock_tienda AS
SELECT
  UPPER(TRIM(f.e_sucursal))  AS store,
  TRIM(f.e_sku)              AS sku,
  TRIM(f.e_talle)            AS talle,
  TRIM(f.e_descrip)          AS description,
  TRIM(f.e_rubro)            AS rubro,
  TRIM(f.e_marca)            AS brand,
  COALESCE(
    NULLIF(TRIM(d.tipo_articulo), ''),
    NULLIF(TRIM(f.e_lineapr), ''),
    'Sin categoria'
  )                           AS lineapr,
  TRIM(f.e_tipoart)          AS tipo_articulo,
  -- SKU Comercial de Dim_maestro_comercial (ej: "MACA004428")
  TRIM(d."codigo_unico_final") AS sku_comercial,
  SUM(f.e_cantid)            AS units,
  MAX(f.e_precio)            AS price,
  MAX(f.e_precmay)           AS price_may,
  MAX(f.e_costo)             AS cost,
  SUM(f.e_valor)             AS value,
  TRIM(f.e_estcomer)         AS est_comercial,
  TRIM(f.e_carryov)          AS carry_over,
  f.e_tpitem                 AS tpitem
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
  TRIM(f.e_talle),
  TRIM(f.e_descrip),
  TRIM(f.e_rubro),
  TRIM(f.e_marca),
  TRIM(d.tipo_articulo),
  TRIM(f.e_lineapr),
  TRIM(f.e_tipoart),
  TRIM(d."codigo_unico_final"),
  TRIM(f.e_estcomer),
  TRIM(f.e_carryov),
  f.e_tpitem
;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3: Recrear indices
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_mv_stock_tienda_pk
  ON mv_stock_tienda (store, sku, talle);

CREATE INDEX idx_mv_stock_tienda_sku
  ON mv_stock_tienda (sku);

CREATE INDEX idx_mv_stock_tienda_sku_comercial
  ON mv_stock_tienda (sku_comercial)
  WHERE sku_comercial IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4: Verificacion
-- ─────────────────────────────────────────────────────────────────────────────

-- Conteo total (debe ser ~5K-10K)
SELECT COUNT(*) AS filas_total FROM mv_stock_tienda;

-- Cobertura de SKU comercial
SELECT
  COUNT(*) AS total,
  COUNT(sku_comercial) AS con_sku_comercial,
  ROUND(COUNT(sku_comercial)::numeric / COUNT(*)::numeric * 100, 1) AS pct_cobertura
FROM mv_stock_tienda;

-- Ejemplos
SELECT store, sku, sku_comercial, brand, description
FROM mv_stock_tienda
WHERE sku_comercial IS NOT NULL
LIMIT 10;
