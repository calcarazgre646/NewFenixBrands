/**
 * 010_mv_doi_edad.sql
 *
 * Vista materializada: DOI-edad (días de inventario por ubicación).
 * Decodifica movimientos_st_jde (EBCDIC) → SKU, talle, store normalizado.
 * Calcula days_since_last_movement = CURRENT_DATE - MAX(fecha_transaccion).
 *
 * Pre-requisito: tabla movimientos_st_jde con RLS habilitada.
 * Ejecutar primero:
 *   ALTER TABLE movimientos_st_jde ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "anon_read_movimientos" ON movimientos_st_jde
 *     FOR SELECT TO anon USING (true);
 *
 * Para refrescar: REFRESH MATERIALIZED VIEW mv_doi_edad;
 */

DROP MATERIALIZED VIEW IF EXISTS mv_doi_edad;

CREATE MATERIALIZED VIEW mv_doi_edad AS
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
  -- Fix: nombres JDE reales (verificados en movimientos_st_jde 2026-04-01)
  ('MARTEL SHOPPING SAN LORENZO', 'MARTELSSL'),
  ('WR SHOPPING SAN LORENZO', 'WRSSL'),
  ('WR SHOP MULTIPLAZA', 'WRMULTIPLAZA'),
  ('Almac. MARTELLUQUE', 'MARTELLUQUE'),
  ('Almac. Tejidos', 'ALMTEJIDOS'),
  ('ALMACEN DE BATAS', 'ALMACENBATAS'),
  ('SERVICIOS', 'SERVICIOS')
),
decoded AS (
  SELECT
    SPLIT_PART(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      REPLACE(REPLACE(
        SUBSTRING(referencia FROM 3 FOR 50),
        '\xf0','0'), '\xf1','1'), '\xf2','2'), '\xf3','3'),
        '\xf4','4'), '\xf5','5'), '\xf6','6'), '\xf7','7'),
        '\xf8','8'), '\xf9','9'), '\x40',''), '''',''),
      '`', 1
    ) AS sku,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
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
    ) AS talle,
    nombre_sucursal_final AS jde_store,
    fecha_transaccion,
    ABS(cantidad) AS qty
  FROM movimientos_st_jde
),
last_arrival AS (
  SELECT
    sku,
    talle,
    jde_store,
    MAX(fecha_transaccion) AS last_movement_date,
    SUM(qty) AS total_units_moved
  FROM decoded
  GROUP BY sku, talle, jde_store
)
SELECT
  la.sku,
  la.talle,
  COALESCE(sm.cosujd, la.jde_store) AS store,
  la.last_movement_date,
  la.total_units_moved,
  CURRENT_DATE - la.last_movement_date AS days_since_last_movement
FROM last_arrival la
LEFT JOIN store_map sm ON sm.jde_name = la.jde_store;

CREATE INDEX idx_mv_doi_sku_store ON mv_doi_edad (sku, store);
CREATE INDEX idx_mv_doi_sku_talle_store ON mv_doi_edad (sku, talle, store);
CREATE INDEX idx_mv_doi_days ON mv_doi_edad (days_since_last_movement);
