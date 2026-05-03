-- =============================================================================
-- 029_sales_pulse.sql
--
-- Sales Pulse Semanal — RPC en BD operacional (data/ERP).
--
-- Ticket Rod: "Correo automático enviado por Dash IA con el pulso de ventas
--              semanal (todos los lunes)".
--
-- Esta migration vive en el proyecto DATA (gwzllatcxxrizxtslkeh), donde están
-- las MVs de ventas, fjdhstvta1, c_cobrar, Budget_2026 y data_freshness.
--
-- La pieza correlativa en el proyecto AUTH (subscribers, runs, cron) está en
-- sql/030_sales_pulse_auth.sql.
--
-- Output: jsonb con 5 bloques (sales/monthly/movers/alerts/freshness) que la
-- Edge Function send-sales-pulse rendea como HTML y envía vía Resend.
--
-- Fecha: 2026-05-04
-- =============================================================================


-- ─── 1. Helper: rango de la semana (lunes 00:00 → domingo 23:59:59) ─────────
-- p_week_start debe ser un lunes. Se calcula afuera (en la EF) para evitar
-- ambigüedad de timezone.

-- ─── 2. Función pública compute_sales_pulse ─────────────────────────────────

CREATE OR REPLACE FUNCTION compute_sales_pulse(
  p_week_start date,
  p_year       integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_week_end          date;
  v_prev_week_start   date;
  v_prev_week_end     date;
  v_year_ago_start    date;
  v_year_ago_end      date;
  v_year              integer;
  v_month             integer;
  v_month_label       text;
  v_month_actual      numeric;
  v_month_target      numeric;
  v_units_week        numeric;
  v_neto_week         numeric;
  v_neto_prev_week    numeric;
  v_neto_year_ago     numeric;
  v_days_elapsed      integer;
  v_days_in_month     integer;
  v_run_rate          numeric;
  v_movers_brands     jsonb;
  v_movers_skus       jsonb;
  v_movers_stores     jsonb;
  v_novelty_alert     jsonb;
  v_low_sth_alert     jsonb;
  v_dso_alert         jsonb;
  v_freshness         jsonb;
  v_max_data_date     date;
  v_target_table      text;
  v_target_query      text;
BEGIN
  v_week_end        := p_week_start + interval '6 days';
  v_prev_week_start := p_week_start - interval '7 days';
  v_prev_week_end   := p_week_start - interval '1 day';
  v_year_ago_start  := p_week_start - interval '1 year';
  v_year_ago_end    := v_week_end - interval '1 year';
  v_year            := COALESCE(p_year, EXTRACT(year FROM p_week_start)::integer);
  v_month           := EXTRACT(month FROM p_week_start)::integer;

  -- Locale-friendly mes en español (sin depender de lc_time del server).
  v_month_label := (
    ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio',
          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  )[v_month] || ' ' || v_year::text;

  -- ── Bloque 1: ventas de la semana cerrada ──────────────────────────────
  SELECT
    COALESCE(SUM(neto), 0),
    COALESCE(SUM(units), 0)
  INTO v_neto_week, v_units_week
  FROM mv_ventas_diarias
  WHERE make_date(year, month, day) BETWEEN p_week_start AND v_week_end;

  SELECT COALESCE(SUM(neto), 0)
  INTO v_neto_prev_week
  FROM mv_ventas_diarias
  WHERE make_date(year, month, day) BETWEEN v_prev_week_start AND v_prev_week_end;

  SELECT COALESCE(SUM(neto), 0)
  INTO v_neto_year_ago
  FROM mv_ventas_diarias
  WHERE make_date(year, month, day) BETWEEN v_year_ago_start AND v_year_ago_end;

  -- ── Bloque 2: cumplimiento mensual ─────────────────────────────────────
  -- Acumulado month-to-date desde el día 1 hasta v_week_end.
  SELECT COALESCE(SUM(neto), 0)
  INTO v_month_actual
  FROM mv_ventas_diarias
  WHERE year = v_year AND month = v_month
    AND make_date(year, month, day) <= v_week_end;

  -- Budget_${v_year} es tabla con nombre dinámico → EXECUTE format().
  -- Suma Revenue del mes. Si la tabla del año no existe, target queda en 0
  -- y la EF muestra "sin meta" en el bloque.
  v_target_table := format('"Budget_%s"', v_year);
  BEGIN
    v_target_query := format(
      'SELECT COALESCE(SUM(replace(replace(replace(coalesce(%I, ''0''), ''.'', ''''), '','', ''.''), '' '', ''''))::numeric, 0)
       FROM %s WHERE %I = $1 AND lower(%I) = lower($2)',
      'Revenue', v_target_table, 'Year', 'Month'
    );
    EXECUTE v_target_query
      INTO v_month_target
      USING v_year,
            (ARRAY['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'])[v_month];
  EXCEPTION WHEN OTHERS THEN
    v_month_target := 0;
  END;

  -- Días transcurridos del mes hasta v_week_end + días totales del mes.
  v_days_elapsed  := LEAST(EXTRACT(day FROM v_week_end)::integer,
                           EXTRACT(day FROM (date_trunc('month', make_date(v_year, v_month, 1))
                                             + interval '1 month - 1 day'))::integer);
  v_days_in_month := EXTRACT(day FROM (date_trunc('month', make_date(v_year, v_month, 1))
                                        + interval '1 month - 1 day'))::integer;
  v_run_rate := CASE
    WHEN v_days_elapsed > 0 THEN (v_month_actual / v_days_elapsed) * v_days_in_month
    ELSE 0
  END;

  -- ── Bloque 3.a: top 3 marcas WoW ───────────────────────────────────────
  WITH w AS (
    SELECT brand, SUM(neto) AS neto_week
    FROM mv_ventas_diarias
    WHERE make_date(year, month, day) BETWEEN p_week_start AND v_week_end
    GROUP BY brand
  ),
  pw AS (
    SELECT brand, SUM(neto) AS neto_prev
    FROM mv_ventas_diarias
    WHERE make_date(year, month, day) BETWEEN v_prev_week_start AND v_prev_week_end
    GROUP BY brand
  )
  SELECT COALESCE(jsonb_agg(pg_catalog.to_jsonb(t) ORDER BY t.wow_pct DESC NULLS LAST) FILTER (WHERE rn <= 3), '[]'::jsonb)
  INTO v_movers_brands
  FROM (
    SELECT
      w.brand AS name,
      w.neto_week::numeric AS neto,
      COALESCE(pw.neto_prev, 0)::numeric AS neto_prev,
      CASE
        WHEN COALESCE(pw.neto_prev, 0) > 0
        THEN ROUND(((w.neto_week - pw.neto_prev) / pw.neto_prev * 100)::numeric, 1)
        ELSE NULL
      END AS wow_pct,
      ROW_NUMBER() OVER (ORDER BY (
        CASE WHEN COALESCE(pw.neto_prev, 0) > 0
          THEN ((w.neto_week - pw.neto_prev) / pw.neto_prev) ELSE 0 END
      ) DESC NULLS LAST) AS rn
    FROM w LEFT JOIN pw USING (brand)
    WHERE w.neto_week > 0
  ) t;

  -- ── Bloque 3.b: top 3 SKUs por neto de la semana ───────────────────────
  -- Va contra fjdhstvta1 directo (mv_ventas_diarias no tiene SKU).
  -- Cruza con dim_maestro_comercial vía sku_comercial para descripción.
  SELECT COALESCE(jsonb_agg(pg_catalog.to_jsonb(t) ORDER BY t.neto DESC) FILTER (WHERE rn <= 3), '[]'::jsonb)
  INTO v_movers_skus
  FROM (
    SELECT
      f.v_sku AS sku,
      MAX(TRIM(f.v_descrip)) AS description,
      MAX(TRIM(f.v_marca)) AS brand,
      SUM(f.v_cantvend)::numeric AS units,
      SUM(f.v_vtasimpu)::numeric AS neto,
      ROW_NUMBER() OVER (ORDER BY SUM(f.v_vtasimpu) DESC) AS rn
    FROM fjdhstvta1 f
    WHERE f.v_canal_venta IN ('B2C', 'B2B')
      AND make_date(f.v_año::int, f.v_mes::int, f.v_dia::int) BETWEEN p_week_start AND v_week_end
    GROUP BY f.v_sku
    HAVING SUM(f.v_vtasimpu) > 0
  ) t
  WHERE rn <= 3;

  -- ── Bloque 3.c: top 3 tiendas por crecimiento WoW ──────────────────────
  WITH w AS (
    SELECT UPPER(TRIM(v_sucursal_final)) AS store,
           v_canal_venta AS channel,
           SUM(v_vtasimpu) AS neto_week
    FROM fjdhstvta1
    WHERE v_canal_venta IN ('B2C', 'B2B')
      AND make_date(v_año::int, v_mes::int, v_dia::int) BETWEEN p_week_start AND v_week_end
    GROUP BY UPPER(TRIM(v_sucursal_final)), v_canal_venta
  ),
  pw AS (
    SELECT UPPER(TRIM(v_sucursal_final)) AS store,
           SUM(v_vtasimpu) AS neto_prev
    FROM fjdhstvta1
    WHERE v_canal_venta IN ('B2C', 'B2B')
      AND make_date(v_año::int, v_mes::int, v_dia::int) BETWEEN v_prev_week_start AND v_prev_week_end
    GROUP BY UPPER(TRIM(v_sucursal_final))
  )
  SELECT COALESCE(jsonb_agg(pg_catalog.to_jsonb(t) ORDER BY t.wow_pct DESC NULLS LAST) FILTER (WHERE rn <= 3), '[]'::jsonb)
  INTO v_movers_stores
  FROM (
    SELECT
      w.store AS store,
      w.channel AS channel,
      w.neto_week::numeric AS neto,
      COALESCE(pw.neto_prev, 0)::numeric AS neto_prev,
      CASE
        WHEN COALESCE(pw.neto_prev, 0) > 0
        THEN ROUND(((w.neto_week - pw.neto_prev) / pw.neto_prev * 100)::numeric, 1)
        ELSE NULL
      END AS wow_pct,
      ROW_NUMBER() OVER (ORDER BY (
        CASE WHEN COALESCE(pw.neto_prev, 0) > 0
          THEN ((w.neto_week - pw.neto_prev) / pw.neto_prev) ELSE 0 END
      ) DESC NULLS LAST) AS rn
    FROM w LEFT JOIN pw USING (store)
    WHERE w.neto_week > 0
      AND w.store NOT IN ('ALM-BATAS','FABRICA','LAMBARE','LAVADO','LUQ-DEP-OUT',
                          'MP','E-COMMERCE','PRODUCTO','SHOPSANLO',
                          'M-AGUSTIN','M-EDGAR','M-EMILIO','M-GAMARRA','M-JUAN',
                          'M-SALABERRY','M-SILVIO')
  ) t
  WHERE rn <= 3;

  -- ── Bloque 4.a: alerta novedades sin distribuir ────────────────────────
  -- est_comercial='lanzamiento' que están en STOCK/RETAILS pero no en
  -- ninguna tienda dependiente (B2C activa).
  WITH novelty AS (
    SELECT
      sku_comercial,
      MAX(description) AS description,
      MAX(brand) AS brand,
      COUNT(DISTINCT store) FILTER (
        WHERE store NOT IN ('STOCK','RETAILS','ALM-BATAS','FABRICA','LAMBARE',
                            'LAVADO','LUQ-DEP-OUT','MP','E-COMMERCE','PRODUCTO',
                            'SHOPSANLO','M-AGUSTIN','M-EDGAR','M-EMILIO','M-GAMARRA',
                            'M-JUAN','M-SALABERRY','M-SILVIO','UTP','UNIFORMES','MAYORISTA')
          AND units > 0
      ) AS stores_count,
      SUM(units) FILTER (
        WHERE store IN ('STOCK','RETAILS')
      ) AS units_in_depot
    FROM mv_stock_tienda
    WHERE est_comercial = 'lanzamiento'
      AND sku_comercial IS NOT NULL
    GROUP BY sku_comercial
    HAVING SUM(units) FILTER (WHERE store IN ('STOCK','RETAILS')) > 0
       AND COUNT(DISTINCT store) FILTER (
            WHERE store NOT IN ('STOCK','RETAILS','ALM-BATAS','FABRICA','LAMBARE',
                                'LAVADO','LUQ-DEP-OUT','MP','E-COMMERCE','PRODUCTO',
                                'SHOPSANLO','M-AGUSTIN','M-EDGAR','M-EMILIO','M-GAMARRA',
                                'M-JUAN','M-SALABERRY','M-SILVIO','UTP','UNIFORMES','MAYORISTA')
              AND units > 0
           ) = 0
  )
  SELECT jsonb_build_object(
    'count', (SELECT COUNT(*) FROM novelty),
    'examples', COALESCE((
      SELECT jsonb_agg(pg_catalog.to_jsonb(e))
      FROM (
        SELECT sku_comercial AS sku, description, brand, units_in_depot AS units
        FROM novelty ORDER BY units_in_depot DESC LIMIT 3
      ) e
    ), '[]'::jsonb)
  )
  INTO v_novelty_alert;

  -- ── Bloque 4.b: alerta sell-through bajo (30-90 días, sth < 30%) ───────
  WITH low_sth AS (
    SELECT
      c.sku,
      MAX(s.description) AS description,
      MAX(s.brand)       AS brand,
      SUM(c.units_received)::numeric AS units_received,
      SUM(c.units_sold)::numeric     AS units_sold,
      ROUND((SUM(c.units_sold)::numeric / NULLIF(SUM(c.units_received), 0) * 100)::numeric, 1) AS sth_pct
    FROM mv_sth_cohort c
    LEFT JOIN mv_stock_tienda s ON s.sku = c.sku
    WHERE c.cohort_age_days BETWEEN 30 AND 90
    GROUP BY c.sku
    HAVING SUM(c.units_received) >= 20
       AND (SUM(c.units_sold)::numeric / NULLIF(SUM(c.units_received), 0)) < 0.30
  )
  SELECT jsonb_build_object(
    'count', (SELECT COUNT(*) FROM low_sth),
    'examples', COALESCE((
      SELECT jsonb_agg(pg_catalog.to_jsonb(e))
      FROM (
        SELECT sku, description, brand, units_received, sth_pct
        FROM low_sth ORDER BY sth_pct ASC, units_received DESC LIMIT 3
      ) e
    ), '[]'::jsonb)
  )
  INTO v_low_sth_alert;

  -- ── Bloque 4.c: alerta DSO actual vs hace 4 semanas ────────────────────
  -- Snapshot del saldo abierto a v_week_end y a v_week_end - 28 días,
  -- dividido por ventas diarias promedio de los últimos 30 días.
  WITH cxc_now AS (
    SELECT COALESCE(SUM(pendiente_de_pago), 0) AS saldo
    FROM c_cobrar
    WHERE f_factura <= v_week_end AND pendiente_de_pago > 0
  ),
  cxc_prev AS (
    SELECT COALESCE(SUM(pendiente_de_pago), 0) AS saldo
    FROM c_cobrar
    WHERE f_factura <= (v_week_end - interval '28 days')::date AND pendiente_de_pago > 0
  ),
  ventas_30d AS (
    SELECT COALESCE(SUM(neto), 0)::numeric AS neto, COUNT(*) AS dias
    FROM mv_ventas_diarias
    WHERE make_date(year, month, day) BETWEEN (v_week_end - interval '29 days')::date AND v_week_end
  )
  SELECT jsonb_build_object(
    'current_days', CASE
      WHEN v.neto > 0 AND v.dias > 0 THEN ROUND((c.saldo / (v.neto / v.dias))::numeric, 0)
      ELSE NULL END,
    'four_weeks_ago_days', CASE
      WHEN v.neto > 0 AND v.dias > 0 THEN ROUND((p.saldo / (v.neto / v.dias))::numeric, 0)
      ELSE NULL END,
    'cxc_current', c.saldo::numeric,
    'cxc_four_weeks_ago', p.saldo::numeric
  )
  INTO v_dso_alert
  FROM cxc_now c, cxc_prev p, ventas_30d v;

  -- ── Bloque 5: freshness ────────────────────────────────────────────────
  SELECT MAX(make_date(year, month, day))
  INTO v_max_data_date
  FROM mv_ventas_diarias;

  SELECT jsonb_build_object(
    'sources', COALESCE(jsonb_agg(pg_catalog.to_jsonb(f) ORDER BY f.source_name), '[]'::jsonb),
    'max_data_date', v_max_data_date
  )
  INTO v_freshness
  FROM (
    SELECT source_name, refreshed_at, status
    FROM data_freshness
    WHERE source_name IN ('mv_ventas_diarias','mv_ventas_mensual','mv_stock_tienda','mv_sth_cohort')
  ) f;

  -- ── Salida final ───────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'week_start',  to_char(p_week_start, 'YYYY-MM-DD'),
    'week_end',    to_char(v_week_end,   'YYYY-MM-DD'),
    'iso_week',    EXTRACT(week FROM p_week_start)::integer,
    'year',        v_year,
    'sales', jsonb_build_object(
      'neto_week',         v_neto_week,
      'units_week',        v_units_week,
      'neto_prev_week',    v_neto_prev_week,
      'neto_year_ago',     v_neto_year_ago,
      'wow_pct', CASE WHEN v_neto_prev_week > 0
                      THEN ROUND(((v_neto_week - v_neto_prev_week) / v_neto_prev_week * 100)::numeric, 1)
                      ELSE NULL END,
      'yoy_pct', CASE WHEN v_neto_year_ago > 0
                      THEN ROUND(((v_neto_week - v_neto_year_ago) / v_neto_year_ago * 100)::numeric, 1)
                      ELSE NULL END
    ),
    'monthly', jsonb_build_object(
      'month_label',         v_month_label,
      'month_actual',        v_month_actual,
      'month_target',        v_month_target,
      'month_progress_pct',  CASE WHEN v_month_target > 0
                                  THEN ROUND((v_month_actual / v_month_target * 100)::numeric, 1)
                                  ELSE NULL END,
      'days_elapsed',        v_days_elapsed,
      'days_in_month',       v_days_in_month,
      'run_rate_projection', v_run_rate,
      'gap_to_target',       GREATEST(0, v_month_target - v_run_rate)
    ),
    'movers', jsonb_build_object(
      'brands', v_movers_brands,
      'skus',   v_movers_skus,
      'stores', v_movers_stores
    ),
    'alerts', jsonb_build_object(
      'novelty_undistributed', v_novelty_alert,
      'low_sell_through_30d',  v_low_sth_alert,
      'dso',                   v_dso_alert
    ),
    'freshness', v_freshness
  );
END;
$$;


-- ─── 3. Permisos ────────────────────────────────────────────────────────────
-- SECURITY DEFINER + GRANT EXECUTE solo a service_role para que la EF la pueda
-- invocar usando el service-role key del proyecto data, sin exponerla a anon.

REVOKE ALL ON FUNCTION compute_sales_pulse(date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compute_sales_pulse(date, integer) TO service_role;


-- ─── 4. Smoke test (descomentar para validar manualmente tras aplicar) ──────
-- SELECT compute_sales_pulse('2026-04-27'::date);
-- Debe devolver jsonb con 5 claves top-level: sales/monthly/movers/alerts/freshness.
