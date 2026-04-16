# BUG: Margen Bruto muestra ~95% (valor incorrecto)

**Fecha de detección:** 2026-04-15, 17:00 PYT  
**Estado:** PENDIENTE — esperando corrección de Benicio en el ERP (JDE)  
**Severidad:** Alta — afecta KPI Dashboard, Ventas, y toda vista que muestre margen  
**Reportado por:** Carlos  
**Confirmado por:** Derlys (17:05 PYT, vía WhatsApp)

---

## Síntoma

El KPI "Margen Bruto" muestra ~95% en todas las vistas (KPIs, Ventas, store breakdown). El valor real esperado es ~40-55% según los costos de inventario.

## Causa raíz

La columna `v_valor` en `fjdhstvta1` (tabla de ventas del ERP JDE) viene en **0 para ~97% de las filas**. Esta columna es la fuente de `costo` en las vistas materializadas `mv_ventas_mensual` y `mv_ventas_diarias`.

- Fórmula: `(neto - costo) / neto × 100`
- Con `costo ≈ 0`: `(neto - 0) / neto × 100 ≈ 100%`

**No es un bug de código.** La fórmula y el flujo de datos son correctos. El problema es que el ERP dejó de poblar `v_valor` con el costo real de las transacciones.

## Evidencia (diagnóstico 2026-04-15)

### Datos de `mv_ventas_mensual` 2026

| Mes | Neto | Costo | Margen (incorrecto) |
|-----|------|-------|---------------------|
| Ene | ₲ 2.520M | ₲ 160M | 93.64% |
| Feb | ₲ 2.908M | ₲ 108M | 96.27% |
| Mar | ₲ 4.252M | ₲ 199M | 95.31% |
| Abr | ₲ 1.474M | ₲ 76M | 94.83% |
| **YTD** | **₲ 11.155M** | **₲ 544M** | **95.12%** |

### Filas con `v_valor > 0` en fjdhstvta1 2026

Solo ~1,000 de ~43,000 filas tienen costo. Concentradas en pocas tiendas:

| Tienda | Filas con costo |
|--------|----------------|
| MARTELLUQUE | 242 |
| TOSUR | 205 |
| MARTELMCAL | 123 |
| MAYORISTA | 106 |
| UTP | 65 |
| SHOPMCAL | 54 |
| ESTRELLA | 47 |

Las filas que SÍ tienen `v_valor` dan márgenes razonables: Martel ~55-60%, Wrangler ~46-62%, Lee ~26-35%.

### Validación cruzada con inventario

Calculando COGS desde `fjdexisemp.e_costo × unidades` (mes 3, 2026):

| Método | COGS | Margen |
|--------|------|--------|
| `v_valor` (actual, roto) | ₲ 204M | 95.3% |
| Inventario `e_costo` | ₲ 1.808M | **58.6%** |

Cobertura del cálculo alternativo: 75.7% de SKUs (11,774 de 15,545 filas).

## Confirmación de Derlys

> "De la fuente es. Ahí le avisé a Benicio. Trae valor 0 en la mayoría."  
> — Derlys, 2026-04-15 17:05 PYT

## Acción requerida

### Para Benicio (ERP/JDE)
Corregir la extracción de datos para que `v_valor` en `fjdhstvta1` contenga el costo real de cada transacción de venta.

### Post-corrección (ejecutar en Supabase SQL Editor)
```sql
REFRESH MATERIALIZED VIEW mv_ventas_mensual;
REFRESH MATERIALIZED VIEW mv_ventas_diarias;
REFRESH MATERIALIZED VIEW mv_ventas_12m_por_tienda_sku;
```

### Verificación post-fix
```sql
-- Debe dar un ratio costo/neto de ~40-60%, NO ~5%
SELECT
  v_mes,
  SUM(neto) AS neto,
  SUM(costo) AS costo,
  ROUND(SUM(costo)::numeric / NULLIF(SUM(neto), 0) * 100, 1) AS ratio_pct
FROM mv_ventas_mensual
WHERE v_año = 2026 AND v_canal_venta IN ('B2C', 'B2B')
GROUP BY v_mes
ORDER BY v_mes;
```

## Código afectado (NO requiere cambios)

- `src/domain/kpis/calculations.ts` → `calcGrossMargin()` — fórmula correcta
- `src/features/kpis/hooks/useKpiDashboard.ts` → lee `cogs` de MV — correcto
- `src/features/sales/hooks/useSalesAnalytics.ts` → `buildStoreBreakdown()` — correcto
- `src/queries/sales.queries.ts` → mapea `costo` → `cogs` — correcto
- `sql/003_mv_ventas_diarias.sql` → `SUM(v_valor) AS costo` — correcto (si la fuente tiene datos)

## Fallback alternativo (si Benicio tarda)

Se puede implementar un cálculo de COGS desde inventario (`fjdexisemp.e_costo × v_cantvend`) como fallback cuando `v_valor = 0`. Diagnóstico confirmó viabilidad con 75.7% de cobertura y margen resultante de ~58.6%.

## Scripts de diagnóstico

Archivos usados para esta investigación (pueden eliminarse después):
- `scripts/diagnose-margin.mjs`
- `scripts/diagnose-margin-2.mjs`
- `scripts/diagnose-margin-3.mjs`
