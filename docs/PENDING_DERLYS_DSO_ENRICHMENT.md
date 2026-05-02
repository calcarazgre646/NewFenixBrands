# Pendiente Derlys — Enriquecer `c_cobrar` con dimensión de marca/canal/tienda

**Solicitante:** Calcaraz · **Fecha:** 2026-05-02 · **Prioridad:** Media · **Bloqueante de:** filtros brand/channel/store en KPI DSO de `/kpis`.

## Contexto

El KPI **DSO (Days Sales Outstanding)** ya está conectado en `https://fenix-brands-one.vercel.app/kpis` desde la sesión 02/05/2026 (PR #52). Funciona a nivel total empresa: saldo CxC abierto / ventas diarias promedio.

**Limitación actual:** la card se deshabilita cuando el usuario aplica filtro de marca, canal o tienda. Mensaje en UI: *"No disponible con filtro de marca/canal/tienda — la fuente de datos no lo soporta."*

## Por qué se deshabilita

`c_cobrar` (834.041 filas, 7.090 con saldo abierto) tiene este schema:

```
codigo_cliente, ruc, razon_social, monto_total, monto_sin_iva, iva,
pendiente_de_pago, fecha_pago, numero_documento, numero_cuota, sucursal,
f_venc_cuota, f_factura, f_pago, beneficiario
```

No hay columna que identifique **marca**, **canal** ni **tienda** de la factura original. Cada cuota es agregada (puede contener varias marcas/canales en una sola factura).

`mv_ventas_diarias` SÍ tiene `brand` y `channel`. Si filtrásemos solo el denominador (ventas) y no el numerador (CxC), el ratio sería matemáticamente incoherente:

```
DSO Martel "calculado" = CxC_total_empresa / ventas_diarias_Martel_solamente
                       ≈ 80.000M Gs / 40M Gs ≈ 2.000 días     ← sin sentido
```

Por eso el catálogo declara `supportedFilters: { brand: false, channel: false, store: false }` para DSO — es la opción honesta.

## Soluciones posibles (orden de costo creciente)

### Opción 1 — Tabla mapping `factura_marca` *(la más barata)*

Crear una tabla simple con el mapping mayoritario por factura:

```sql
CREATE TABLE factura_marca AS
SELECT
  v.num_documento::text                 AS numero_documento,
  -- Marca dominante por monto en líneas de la factura:
  (SELECT brand FROM (
     SELECT brand, SUM(v_vtasimpu) AS imp
     FROM fjdhstvta1
     WHERE num_documento = v.num_documento
     GROUP BY brand
     ORDER BY imp DESC
     LIMIT 1
   ) x)                                  AS brand_dominante,
  -- Canal dominante (heurística por sucursal):
  CASE
    WHEN v.cosujd IN ('MAYORISTA','UTP','UNIFORMES') THEN 'B2B'
    ELSE 'B2C'
  END                                    AS channel,
  v.cosujd                               AS store
FROM (
  SELECT DISTINCT num_documento, cosujd
  FROM fjdhstvta1
) v;

-- Refresh diario o nightly.
```

**Ventaja:** no toca el ETL del ERP; es un cruce sobre datos que ya existen.
**Desventaja:** brand_dominante es una aproximación cuando la factura tiene varias marcas. Aceptable para DSO (es ratio macro, no operativo).

### Opción 2 — Vista `v_cxc_enriched`

```sql
CREATE OR REPLACE VIEW v_cxc_enriched AS
SELECT
  c.numero_documento,
  c.numero_cuota,
  c.codigo_cliente,
  c.f_factura,
  c.f_venc_cuota,
  c.f_pago,
  c.pendiente_de_pago,
  c.monto_total,
  fm.brand_dominante,
  fm.channel,
  fm.store
FROM c_cobrar c
LEFT JOIN factura_marca fm ON fm.numero_documento = c.numero_documento;
```

**Ventaja:** no muta `c_cobrar`; PostgREST puede consumirla con `.eq("brand_dominante", ...)`.
**Requiere:** Opción 1 hecha primero.

### Opción 3 — Columnas nuevas en `c_cobrar` *(más invasivo)*

Agregar `brand`, `channel`, `cosujd` directamente en la tabla durante el ETL del ERP. Implica modificar el pipeline del ERP de Fenix (no Supabase). **Solo recomendado si la #1 demuestra problemas de performance.**

## Spec del cambio en NewFenixBrands

Una vez disponible Opción 1 + 2:

1. **Catálogo:** revertir `dso.supportedFilters` a `{ brand: true, channel: true, store: false }` (store sigue limitado por la heurística sucursal).
2. **Query:** `fetchDSO` agrega params opcionales `brand?`, `channel?` y aplica `.eq("brand_dominante", ...)` en la query a `v_cxc_enriched`.
3. **Tests:** 4 tests nuevos para asegurar paridad numerador/denominador.

Estimación: 2-3h de desarrollo + tests + deploy.

## Validación que pediremos a Derlys

- [ ] ¿Cuál es la tasa de facturas con múltiples marcas? (Si > 30%, "brand_dominante" no alcanza, hay que distribuir saldo proporcional.)
- [ ] ¿`fjdhstvta1.num_documento` está siempre poblado? (Hay registros 2024 con padding raro.)
- [ ] ¿Refresh diario o on-demand? (Opción 1 puede tardar ~2 min sobre 526K líneas de fjdhstvta1.)

## Estado al 2026-05-02

- KPI DSO funcional a nivel total. Mostrando valor razonable post-fix.
- Card se deshabilita con filtros activos hasta resolver este pendiente.
- No bloquea otros KPIs ni features.
