-- =============================================================================
-- PROTECCIÓN v2: Cron cada hora + refresh encadenado
-- =============================================================================
-- Fecha: 2026-03-09
-- Reemplaza los 2 crons anteriores por 1 solo que hace TODO cada hora.
-- Así la ventana máxima de "dashboard en cero" es 60 minutos.
-- =============================================================================


-- ─── Eliminar los crons anteriores ──────────────────────────────────────────

SELECT cron.unschedule('fix-canal-venta-6h');
SELECT cron.unschedule('refresh-vistas-diario');


-- ─── Nuevo cron: TODO junto, cada hora, Lun-Sáb ────────────────────────────

SELECT cron.schedule(
  'proteccion-canal-y-refresh',
  '15 * * * 1-6',
  $$
    -- PASO 1: Reparar filas sin clasificar (solo si hay — idempotente)
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

    -- PASO 2: Refrescar vistas materializadas
    REFRESH MATERIALIZED VIEW mv_ventas_mensual;
    REFRESH MATERIALIZED VIEW mv_ventas_diarias;
    REFRESH MATERIALIZED VIEW mv_ventas_12m_por_tienda_sku;
    REFRESH MATERIALIZED VIEW mv_stock_tienda;
  $$
);


-- ─── Verificar ──────────────────────────────────────────────────────────────

-- Debe mostrar 1 solo job activo
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN ('fix-canal-venta-6h', 'refresh-vistas-diario', 'proteccion-canal-y-refresh');
