# Sales Pulse — Fase 2 (backlog)

Estado al cierre de la etapa MVP (2026-05-04): 4 de los 9 bloques diseñados están vivos en el email; los 5 restantes están **stubeados** (`[]` / `count: 0`) porque el RPC se cae por `statement_timeout` cuando intenta tocar `fjdhstvta1` (280K filas) o cruzar `mv_sth_cohort` (285K) con `mv_stock_tienda`. La solución correcta no es seguir parcheando el RPC actual; es una **MV semanal pre-agregada**.

## Bloques pendientes de habilitar

| ID | Bloque | Fuente actual | Por qué falla |
|---|---|---|---|
| 3.b | Top 3 SKUs por neto semanal | `fjdhstvta1` directo + filtro por fecha | `make_date(v_año::int, v_mes::int, v_dia::int)` envuelve las columnas → no usa `idx_fjdhstvta1_year_month`. Full scan de 280K filas. |
| 3.c | Top 3 tiendas WoW | `fjdhstvta1` directo (semana actual + previa) | Mismo problema; el `::int` cast rompe el uso del índice. |
| 4.a | Alerta novedades sin distribuir | `mv_stock_tienda` con filtros de exclusión múltiples | GROUP BY sobre ~30K filas + DISTINCT con HAVING — pesado pero salvable con índice expression. |
| 4.b | Alerta sell-through bajo 30-90d | JOIN `mv_sth_cohort` × `mv_stock_tienda` | El JOIN sobre 285K + 30K + filtros suma. |
| 4.c | Alerta DSO snapshot vs hace 4 semanas | `c_cobrar` (snapshot) + `mv_ventas_diarias` (30d) | Combinado con los demás explota el budget total del request. |

## Solución de diseño

### Opción recomendada — MV semanal pre-agregada

Crear `mv_pulso_semanal` en BD DATA con shape:

```sql
CREATE MATERIALIZED VIEW mv_pulso_semanal AS
SELECT
  date_trunc('week', make_date(v_año::int, v_mes::int, v_dia::int))::date AS week_start,
  v_canal_venta                  AS channel,
  TRIM(v_marca)                  AS brand,
  v_sku                          AS sku,
  TRIM(v_descrip)                AS description,
  UPPER(TRIM(v_sucursal_final))  AS store,
  SUM(v_vtasimpu)                AS neto,
  SUM(v_cantvend)                AS units,
  COUNT(DISTINCT v_ndocum)       AS tickets
FROM fjdhstvta1
WHERE v_canal_venta IN ('B2C', 'B2B')
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE INDEX idx_mv_pulso_week ON mv_pulso_semanal (week_start);
CREATE INDEX idx_mv_pulso_brand ON mv_pulso_semanal (week_start, brand);
CREATE INDEX idx_mv_pulso_store ON mv_pulso_semanal (week_start, store);
```

Filas estimadas: ~52 semanas × ~3 marcas × ~30 tiendas × ~2.000 SKUs activos ≈ 9.4M (worst case). Usar índice parcial sobre semanas recientes si crece.

### Integración con el refresh existente

Agregar `mv_pulso_semanal` al loop de `refresh_all_and_log()` en `sql/011_data_freshness.sql`. El cron `refresh-all-and-log` corre `:15 cada hora`, así que para el envío de los lunes 17:00 UTC habrá pasado por al menos 16 refreshes de la semana cerrada → garantía de data fresca.

### Rewrite del RPC

Reemplazar los CTEs problemáticos en `compute_sales_pulse`:

```sql
-- Top SKUs (ahora ~ms en lugar de ~30s)
SELECT sku, MAX(description) AS description, MAX(brand) AS brand,
       SUM(units) AS units, SUM(neto) AS neto
FROM mv_pulso_semanal
WHERE week_start = p_week_start AND neto > 0
GROUP BY sku
ORDER BY neto DESC
LIMIT 3;

-- Top tiendas WoW (con LEFT JOIN entre dos selects sobre la MV)
WITH w AS (
  SELECT store, channel, SUM(neto) AS neto FROM mv_pulso_semanal
  WHERE week_start = p_week_start GROUP BY store, channel
),
pw AS (
  SELECT store, SUM(neto) AS neto FROM mv_pulso_semanal
  WHERE week_start = p_week_start - interval '7 days' GROUP BY store
)
SELECT w.store, w.channel, w.neto,
       CASE WHEN COALESCE(pw.neto, 0) > 0
            THEN ROUND((w.neto - pw.neto) / pw.neto * 100, 1) END AS wow_pct
FROM w LEFT JOIN pw USING (store)
WHERE store NOT IN (... mismas exclusiones ...)
ORDER BY wow_pct DESC NULLS LAST
LIMIT 3;
```

### Bloques de alerta (4.a / 4.b / 4.c)

- **Novedades sin distribuir**: queda contra `mv_stock_tienda` pero con índice expression `CREATE INDEX idx_mv_stock_lanzamiento ON mv_stock_tienda (sku_comercial) WHERE est_comercial = 'lanzamiento'`. Pre-filtra el universo a ~230 SKUs novedad y el GROUP BY ya es trivial.
- **Sell-through bajo**: refactorizar a usar `mv_sth_cohort` solo (descripción y brand desde la propia view ya están), evitar el JOIN. Filtro `cohort_age_days BETWEEN 30 AND 90 AND sth < 0.30 AND units_received >= 20` con índice parcial existente.
- **DSO snapshot**: ya es rápido por sí mismo; lo que lo enlentecía era ejecutarse después de los otros bloques pesados (acumula contra el budget del request). Reabrir cuando los demás vuelen.

## Plan de ejecución sugerido (1-2h)

1. **Migration `sql/031_mv_pulso_semanal.sql`** + agregar al `refresh_all_and_log()`. Aplicar en BD DATA.
2. **Refresh inicial manual** para popular la MV.
3. **Migration `sql/032_compute_sales_pulse_v2.sql`** con el RPC re-escrito usando la MV. `CREATE OR REPLACE` reemplaza la versión actual sin tocar tablas.
4. **Smoke test** vía curl al EF (`x-cron-secret`) con `dry_run`. Confirmar que los 5 bloques antes en stub ahora traen datos.
5. **Tests:** sumar cobertura en `parsePulsePayload` para los shapes de SKUs/tiendas/alertas que antes nunca venían poblados (los tests actuales con FIXTURE_FULL ya los cubren porque el fixture los incluye, pero validar el integration path).
6. **Deploy** EF (no cambia código de la EF — solo el RPC) + verificar contra prod con dry-run.

## Salvedades

- **`fjdhstvta1` puede tener filas nuevas a horas raras**. Si el cliente carga ventas un lunes a las 12:00 PYT y el envío es a las 14:00, podría faltar el último día. Aceptable: el Sales Pulse es de **semana cerrada** (lun-dom anterior), no incluye el lunes mismo.
- **`v_descrip`** en `fjdhstvta1` puede variar entre filas del mismo SKU (operadores tipean distinto). En la MV uso `MAX(description)` como tiebreaker estable.
- **No tocar `mv_pulso_semanal` con `REFRESH MATERIALIZED VIEW CONCURRENTLY`** salvo crear unique index — en este caso no hace falta porque el refresh inline en `refresh_all_and_log` ya tolera bloqueo breve.

## Cuándo hacerlo

Sin presión. El cliente quedó satisfecho con el contenido actual del email para la presentación. Cuando Rod baje el formato definitivo o cuando pida explícitamente las alertas, abrir un PR `feat/sales-pulse-fase-2-aggregations`.
