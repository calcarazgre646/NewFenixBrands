-- =============================================================================
-- 011_data_freshness.sql
--
-- Tabla de metadata de freshness para materialized views.
-- Función refresh_all_and_log() que reemplaza el cron inline anterior.
-- Fix: agrega mv_doi_edad al refresh automático (antes solo se refrescaba manual).
-- =============================================================================
-- Fecha: 2026-04-04
-- =============================================================================


-- ─── 1. Tabla de freshness ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_freshness (
  source_name  TEXT PRIMARY KEY,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count    INTEGER,
  status       TEXT NOT NULL DEFAULT 'ok'
);

ALTER TABLE data_freshness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_freshness" ON data_freshness
  FOR SELECT TO anon USING (true);


-- ─── 2. Función de refresh con logging ──────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_all_and_log() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- PASO 1: Reparar filas sin clasificar (idempotente, de PROTECCION v2)
  UPDATE fjdhstvta1
  SET v_sucursal_final = UPPER(TRIM(v_sucursal)),
      v_canal_venta = CASE
        WHEN UPPER(TRIM(v_sucursal)) IN ('MAYORISTA', 'UTP') THEN 'B2B'
        WHEN UPPER(TRIM(v_sucursal)) IN (
          'ALM-BATAS','FABRICA','LAMBARE','LAVADO','LUQ-DEP-OUT','MP',
          'PRODUCTO','STOCK','UNIFORMES','REPUESTOS','TEJIDOS',
          'M-AGUSTIN','M-EDGAR','M-GAMARRA','M-JUAN','M-SILVIO','M-FELIX','M-SALABERRY',
          'LICITACION','CONSIGNACION','SERVICIOS','CCALIDAD','EXPORT','OTROS',
          'UTILES','MINO','TR','RES','MPEXP','TERCEROS','WEB',
          'SRREV','SRASUNC','SRCESTE','SRCOVIE','SRENCAR','SRNORTE',
          'LAVADERO','RETAILS'
        ) THEN 'Otros'
        ELSE 'B2C'
      END
  WHERE v_canal_venta IS NULL;

  -- PASO 2: Refresh cada MV con aislamiento de errores

  -- mv_ventas_mensual
  BEGIN
    REFRESH MATERIALIZED VIEW mv_ventas_mensual;
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_ventas_mensual', now(), 'ok')
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_ventas_mensual', now(), LEFT(SQLERRM, 200))
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  END;

  -- mv_ventas_diarias
  BEGIN
    REFRESH MATERIALIZED VIEW mv_ventas_diarias;
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_ventas_diarias', now(), 'ok')
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_ventas_diarias', now(), LEFT(SQLERRM, 200))
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  END;

  -- mv_ventas_12m_por_tienda_sku
  BEGIN
    REFRESH MATERIALIZED VIEW mv_ventas_12m_por_tienda_sku;
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_ventas_12m_por_tienda_sku', now(), 'ok')
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_ventas_12m_por_tienda_sku', now(), LEFT(SQLERRM, 200))
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  END;

  -- mv_stock_tienda
  BEGIN
    REFRESH MATERIALIZED VIEW mv_stock_tienda;
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_stock_tienda', now(), 'ok')
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_stock_tienda', now(), LEFT(SQLERRM, 200))
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  END;

  -- mv_doi_edad (BUG FIX: no estaba en el cron anterior)
  BEGIN
    REFRESH MATERIALIZED VIEW mv_doi_edad;
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_doi_edad', now(), 'ok')
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO data_freshness (source_name, refreshed_at, status)
    VALUES ('mv_doi_edad', now(), LEFT(SQLERRM, 200))
    ON CONFLICT (source_name) DO UPDATE
      SET refreshed_at = EXCLUDED.refreshed_at, status = EXCLUDED.status;
  END;

END;
$$;


-- ─── 3. Eliminar los 8 cron jobs individuales previos ───────────────────────

SELECT cron.unschedule('refresh_mv_ventas_mensual');
SELECT cron.unschedule('refresh_mv_stock_tienda');
SELECT cron.unschedule('refresh_mv_ventas_12m');
SELECT cron.unschedule('refresh-best-day-semanal');
SELECT cron.unschedule('refresh-vistas-6am');
SELECT cron.unschedule('fix-canal-venta-6h');
SELECT cron.unschedule('refresh-vistas-diario');
SELECT cron.unschedule('refresh_mv_doi_edad');


-- ─── 4. Crear cron unificado (cada hora :15, Lun-Sáb) ─────────────────────

SELECT cron.schedule(
  'refresh-all-and-log',
  '15 * * * 1-6',
  $$ SELECT refresh_all_and_log(); $$
);


-- ─── 5. Seed inicial ───────────────────────────────────────────────────────
-- Ejecutar una vez para que data_freshness tenga filas desde el primer momento.

SELECT refresh_all_and_log();


-- ─── 6. Verificar ──────────────────────────────────────────────────────────

-- SELECT * FROM data_freshness;
-- Debe mostrar 5 filas con status='ok' y refreshed_at reciente.

-- SELECT jobid, jobname, schedule, active FROM cron.job;
-- Debe mostrar 1 solo job: refresh-all-and-log.
