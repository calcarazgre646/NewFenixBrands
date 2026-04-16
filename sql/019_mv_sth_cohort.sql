/**
 * 019_mv_sth_cohort.sql
 *
 * Vista materializada: STH (Sell-Through Rate) por cohorte.
 *
 * Para cada (sku, talle, store) calcula:
 *   - first_entry_network: primera fecha de ingreso a CUALQUIER tienda (cohorte original)
 *   - first_entry_store:   primera fecha de ingreso a ESTA tienda
 *   - units_received:      unidades recibidas (movimientos positivos)
 *   - units_sold:          unidades vendidas (de fjdhstvta1)
 *   - sth:                 sell-through rate = sold / received (0-1 escala)
 *   - cohort_age_days:     días desde first_entry_network hasta hoy
 *
 * REGLA DE NEGOCIO (Rodrigo 09/04/2026):
 *   La edad del SKU se mide desde la fecha de ingreso a la RED, no por tienda.
 *   Transferencias A→B no resetean la edad — se usa first_entry_network.
 *
 * Reutiliza decodificación EBCDIC de 010_mv_doi_edad.sql.
 *
 * Pre-requisito: RLS en movimientos_st_jde y fjdhstvta1 habilitado.
 */

DROP MATERIALIZED VIEW IF EXISTS mv_sth_cohort;

CREATE MATERIALIZED VIEW mv_sth_cohort AS
WITH store_map (jde_name, cosujd) AS (VALUES
  ('Martel Shopping Pinedo', 'SHOPPINEDO'),
  ('Paseo Galería WR-LEE', 'GALERIAWRLEE'),
  ('STOCK', 'STOCK'),
  ('Shopping Sanlo', 'SHOPSANLO'),
  ('Martel Shopging Mariscal López', 'SHOPMCAL'),
  ('Martel Shop. Mariano', 'SHOPMARIANO'),
  ('TOLUQ', 'TOLUQ'),
  ('T.O Sur', 'TOSUR'),
  ('Martel Paseo Lambaré', 'PASEOLAMB'),
  ('Almac. Fabrica', 'FABRICA'),
  ('Martel ESTRELLA', 'ESTRELLA'),
  ('C.Compras La Rural', 'LARURAL'),
  ('DEPOSITO OUTLET LUQUE', 'LUQ-DEP-OUT'),
  ('PRODUCTO', 'PRODUCTO'),
  ('Martel UTP- Uniformes Tecnic.Profesional', 'UTP'),
  ('LAMBARE', 'LAMBARE'),
  ('UNIFORMES', 'UNIFORMES'),
  ('Almac. FERIA', 'FERIA'),
  ('LAVADO', 'LAVADO'),
  ('Martel SHOPFUENTE', 'SHOPFUENTE'),
  ('RETAIL -Deposito', 'RETAILS'),
  ('PTO. VTA LUQUE OUTLET', 'LUQ-OUTLET'),
  ('Paseo CERROALTO', 'CERROALTO'),
  ('MVMORRA - Martel Vmorra', 'MVMORRA'),
  ('MARTEL SHOPPING SAN LORENZO', 'MARTELSSL'),
  ('WR SHOPPING SAN LORENZO', 'WRSSL'),
  ('WR SHOP MULTIPLAZA', 'WRMULTIPLAZA'),
  ('Almac. MARTELLUQUE', 'MARTELLUQUE'),
  ('Almac. Tejidos', 'ALMTEJIDOS'),
  ('ALMACEN DE BATAS', 'ALMACENBATAS'),
  ('SERVICIOS', 'SERVICIOS')
),
-- Decode EBCDIC movements → (sku, talle, store, date, qty with sign)
decoded_movements AS (
  SELECT
    TRIM(SPLIT_PART(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      REPLACE(REPLACE(
        SUBSTRING(referencia FROM 3 FOR 50),
        '\xf0','0'), '\xf1','1'), '\xf2','2'), '\xf3','3'),
        '\xf4','4'), '\xf5','5'), '\xf6','6'), '\xf7','7'),
        '\xf8','8'), '\xf9','9'), '\x40',''), '''',''),
      '`', 1
    )) AS sku,
    TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      REGEXP_REPLACE(
        SPLIT_PART(
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          REPLACE(REPLACE(
            SUBSTRING(referencia FROM 3 FOR 50),
            '\xf0','0'), '\xf1','1'), '\xf2','2'), '\xf3','3'),
            '\xf4','4'), '\xf5','5'), '\xf6','6'), '\xf7','7'),
            '\xf8','8'), '\xf9','9'), '\x40',''), '''',''),
          '`', 2
        ),
        '@', '', 'g'
      ),
      '\xe7', 'X'), '\xd3', 'L'), '\xd4', 'M'), '\xe2', 'S'), '\xc7', 'G'
    )) AS talle,
    COALESCE(sm.cosujd, m.nombre_sucursal_final) AS store,
    m.fecha_transaccion,
    m.cantidad  -- positive = inbound, negative = outbound
  FROM movimientos_st_jde m
  LEFT JOIN store_map sm ON sm.jde_name = m.nombre_sucursal_final
),
-- Aggregate by (sku, talle, store): first entry, total received
store_cohorts AS (
  SELECT
    sku,
    talle,
    store,
    MIN(fecha_transaccion) FILTER (WHERE cantidad > 0) AS first_entry_store,
    SUM(cantidad) FILTER (WHERE cantidad > 0) AS units_received
  FROM decoded_movements
  WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku, talle, store
),
-- Network-level first entry: MIN across all stores (age doesn't reset on transfer)
network_entry AS (
  SELECT
    sku,
    talle,
    MIN(first_entry_store) AS first_entry_network
  FROM store_cohorts
  WHERE first_entry_store IS NOT NULL
  GROUP BY sku, talle
),
-- Sales from transaction table (units sold per sku+talle+store)
sales_agg AS (
  SELECT
    TRIM(v_sku) AS sku,
    TRIM(v_talle) AS talle,
    UPPER(TRIM(v_sucursal_final)) AS store,
    SUM(ABS(v_cantvend)) AS units_sold
  FROM fjdhstvta1
  WHERE v_cantvend <> 0
  GROUP BY TRIM(v_sku), TRIM(v_talle), UPPER(TRIM(v_sucursal_final))
)
SELECT
  sc.sku,
  sc.talle,
  sc.store,
  ne.first_entry_network,
  sc.first_entry_store,
  COALESCE(sc.units_received, 0) AS units_received,
  COALESCE(sa.units_sold, 0) AS units_sold,
  CASE
    WHEN COALESCE(sc.units_received, 0) > 0
    THEN LEAST(COALESCE(sa.units_sold, 0)::numeric / sc.units_received, 1.0)
    ELSE 0
  END AS sth,
  CASE
    WHEN ne.first_entry_network IS NOT NULL
    THEN CURRENT_DATE - ne.first_entry_network
    ELSE NULL
  END AS cohort_age_days
FROM store_cohorts sc
LEFT JOIN network_entry ne ON ne.sku = sc.sku AND ne.talle = sc.talle
LEFT JOIN sales_agg sa ON sa.sku = sc.sku AND sa.talle = sc.talle AND sa.store = sc.store
WHERE sc.units_received > 0;  -- only include SKUs that actually entered the store

-- Indices for fast lookup
CREATE UNIQUE INDEX idx_mv_sth_pk ON mv_sth_cohort (store, sku, talle);
CREATE INDEX idx_mv_sth_sku_store ON mv_sth_cohort (sku, store);
CREATE INDEX idx_mv_sth_age ON mv_sth_cohort (cohort_age_days);
CREATE INDEX idx_mv_sth_low ON mv_sth_cohort (sth) WHERE sth < 0.5;

-- Add to refresh cycle (run after creating, or update 011_data_freshness.sql)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sth_cohort;
