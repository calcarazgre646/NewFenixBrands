-- =============================================================================
-- FIX URGENTE: v_canal_venta y v_sucursal_final están NULL en toda fjdhstvta1
-- =============================================================================
-- Fecha: 2026-03-09
-- Diagnóstico: Ambas columnas derivadas (v_canal_venta, v_sucursal_final) están
-- NULL en las 252K+ filas de fjdhstvta1. Esto causa que TODAS las queries de
-- ventas retornen 0 filas (filtran .in("v_canal_venta", ["B2B", "B2C"])).
-- Afecta AMBOS proyectos (producción y desarrollo) porque comparten BD.
--
-- EJECUTAR EN ORDEN: cada sección por separado en Supabase SQL Editor.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 0: DIAGNÓSTICO — ejecutar primero para confirmar el problema
-- ─────────────────────────────────────────────────────────────────────────────

-- Debe dar 0 (cero filas con canal)
SELECT COUNT(*) AS filas_con_canal
FROM fjdhstvta1
WHERE v_canal_venta IS NOT NULL;

-- Debe dar 0 (cero filas con sucursal_final)
SELECT COUNT(*) AS filas_con_sucursal_final
FROM fjdhstvta1
WHERE v_sucursal_final IS NOT NULL;

-- Debe dar >250K (hay datos, pero sin clasificar)
SELECT COUNT(*) AS total_filas FROM fjdhstvta1;

-- Debe mostrar las sucursales originales (v_sucursal SÍ tiene datos)
SELECT UPPER(TRIM(v_sucursal)) AS sucursal, COUNT(*) AS filas
FROM fjdhstvta1
GROUP BY UPPER(TRIM(v_sucursal))
ORDER BY filas DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1: Poblar v_sucursal_final (versión limpia de v_sucursal)
-- ─────────────────────────────────────────────────────────────────────────────
-- v_sucursal tiene padding de espacios: "CERROALTO   " → "CERROALTO"
-- v_sucursal_final = UPPER(TRIM(v_sucursal))

UPDATE fjdhstvta1
SET v_sucursal_final = UPPER(TRIM(v_sucursal))
WHERE v_sucursal_final IS NULL;

-- Verificar (debe dar 0 nulls)
SELECT COUNT(*) AS nulls_restantes
FROM fjdhstvta1
WHERE v_sucursal_final IS NULL AND v_sucursal IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2: Poblar v_canal_venta (clasificación B2B / B2C / Otros)
-- ─────────────────────────────────────────────────────────────────────────────
-- Clasificación confirmada con ambos proyectos (viejo y nuevo):
--   B2B:      MAYORISTA, UTP
--   B2C:      Todas las tiendas retail (CERROALTO, ESTRELLA, etc.)
--   Excluidas: Depósitos, fábrica, lavado, showrooms → 'Otros'
--
-- REGLA: B2B es una lista cerrada (solo 2 tiendas).
--        Excluidas es una lista conocida.
--        Todo lo demás → B2C (tiendas retail).

UPDATE fjdhstvta1
SET v_canal_venta = CASE
  -- B2B: mayoristas
  WHEN UPPER(TRIM(v_sucursal)) IN ('MAYORISTA', 'UTP')
    THEN 'B2B'

  -- Excluidas: depósitos, fábrica, internos, showrooms
  -- Estos NO son canales comerciales → 'Otros' (la app los excluye automáticamente)
  WHEN UPPER(TRIM(v_sucursal)) IN (
    'ALM-BATAS', 'FABRICA', 'LAMBARE', 'LAVADO', 'LUQ-DEP-OUT', 'MP',
    'PRODUCTO', 'STOCK', 'UNIFORMES', 'REPUESTOS', 'TEJIDOS',
    'M-AGUSTIN', 'M-EDGAR', 'M-GAMARRA', 'M-JUAN', 'M-SILVIO', 'M-FELIX', 'M-SALABERRY',
    'LICITACION', 'CONSIGNACION', 'SERVICIOS', 'CCALIDAD', 'EXPORT', 'OTROS',
    'UTILES', 'MINO', 'TR', 'RES', 'MPEXP', 'TERCEROS', 'WEB',
    'SRREV', 'SRASUNC', 'SRCESTE', 'SRCOVIE', 'SRENCAR', 'SRNORTE',
    'LAVADERO', 'RETAILS'
  )
    THEN 'Otros'

  -- B2C: todas las tiendas retail (default seguro)
  ELSE 'B2C'
END
WHERE v_canal_venta IS NULL;

-- Verificar la distribución (debe tener B2B, B2C, y Otros)
SELECT v_canal_venta, COUNT(*) AS filas
FROM fjdhstvta1
GROUP BY v_canal_venta
ORDER BY filas DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3: Verificar que los datos de ventas están correctos
-- ─────────────────────────────────────────────────────────────────────────────

-- Ventas 2026 por canal (B2B + B2C deben sumar la mayoría)
SELECT v_canal_venta, v_año,
       COUNT(*) AS filas,
       SUM(v_vtasimpu) AS neto_total
FROM fjdhstvta1
WHERE v_año = 2026
GROUP BY v_canal_venta, v_año
ORDER BY neto_total DESC;

-- Ventas 2025 por canal
SELECT v_canal_venta, v_año,
       COUNT(*) AS filas,
       SUM(v_vtasimpu) AS neto_total
FROM fjdhstvta1
WHERE v_año = 2025
GROUP BY v_canal_venta, v_año
ORDER BY neto_total DESC;

-- Top 10 sucursales 2026 (verificar que los nombres son correctos)
SELECT v_sucursal_final, v_canal_venta, COUNT(*) AS filas, SUM(v_vtasimpu) AS neto
FROM fjdhstvta1
WHERE v_año = 2026
GROUP BY v_sucursal_final, v_canal_venta
ORDER BY neto DESC
LIMIT 10;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4: Refrescar TODAS las vistas materializadas
-- ─────────────────────────────────────────────────────────────────────────────
-- Las vistas están cacheadas con datos viejos (canal NULL).
-- REFRESH las recalcula desde fjdhstvta1 ya corregida.

REFRESH MATERIALIZED VIEW mv_ventas_mensual;
REFRESH MATERIALIZED VIEW mv_ventas_diarias;
REFRESH MATERIALIZED VIEW mv_ventas_12m_por_tienda_sku;
REFRESH MATERIALIZED VIEW mv_stock_tienda;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 5: Verificar que mv_ventas_mensual ahora tiene canal
-- ─────────────────────────────────────────────────────────────────────────────

-- Debe mostrar B2B, B2C (y opcionalmente Otros) con neto > 0
SELECT v_canal_venta, COUNT(*) AS filas, SUM(neto) AS neto_total
FROM mv_ventas_mensual
WHERE v_año = 2026
GROUP BY v_canal_venta
ORDER BY neto_total DESC;

-- Verificar meses disponibles 2026
SELECT DISTINCT v_mes FROM mv_ventas_mensual
WHERE v_año = 2026 AND v_canal_venta IN ('B2B', 'B2C')
ORDER BY v_mes;

-- Verificar que 2025 también está correcto (para YoY)
SELECT v_canal_venta, COUNT(*) AS filas, SUM(neto) AS neto_total
FROM mv_ventas_mensual
WHERE v_año = 2025
GROUP BY v_canal_venta
ORDER BY neto_total DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- LISTO. Después de ejecutar todo:
--   1. Recargar la app (Ctrl+Shift+R en el navegador)
--   2. El dashboard debería mostrar datos inmediatamente
--   3. Verificar tanto la versión de desarrollo como la de producción
-- ─────────────────────────────────────────────────────────────────────────────
