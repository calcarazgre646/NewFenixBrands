# Sesión 04/05/2026 — Carga de Markdown por SKU (Fase 1)

## Origen

Ticket del cliente: *"Carga de markdown por SKU. Usuario carga markdown por SKU. A futuro desencadena solicitud de aprobación para Gte Comercial. Depende de Vista Lista de Precios."*

## Encuadre

Antes de este PR, `/precios` era read-only: PVP/PVM/Costo/MBP%/MBM% se leían de `mv_stock_tienda` (BD DATA, ERP). La columna "Promoción" existía pero estaba hardcoded a `false` desde el PR de 22/04 — placeholder esperando definición del cliente.

Este PR es esa definición: **el equipo comercial carga markdown manual por SKU comercial**, el sistema persiste en BD AUTH (auditado, append-only) y la tabla muestra el PVP efectivo + el original tachado + MBP% recalculado.

Es la primera **Action editable sobre el Object Type SKU** del proyecto. Base para Fase 2 (workflow de aprobación al Gte Comercial) y para promociones por evento.

## Decisiones tomadas

1. **Granularidad:** por `sku_comercial` (style-color). Una sola fila activa por SKU.
2. **Aplica solo a PVP** (retail). PVM no recibe markdown en Fase 1.
3. **Vigencia:** `valid_until` opcional (NULL = indefinido). Apagado manual en Fase 1.
4. **Permiso:** super_user + gerencia. `negocio` no edita (de hecho hoy no entra a `/precios`).
5. **Audit:** append-only. Cada edit inserta nueva fila; la anterior queda con `superseded_at` + `is_active=false`. UNIQUE INDEX parcial enforcer.

## Cambios

| Archivo | Cambio |
|---|---|
| `sql/028_sku_markdowns.sql` (nuevo) | Tabla `sku_markdowns` en BD AUTH + RLS (read=auth, write=super_user/gerencia, no DELETE) + UNIQUE parcial sobre `(sku_comercial)` WHERE `is_active=true` + columna `status` con `pending_approval`/`rejected` reservados para Fase 2. |
| `src/domain/pricing/markdown.ts` (nuevo) | Funciones puras: `applyMarkdown`, `calcMbpEffective`, `validateMarkdownPct`, `isValidMarkdownPct`. Constantes `MARKDOWN_PCT_MIN=0.01`, `MARKDOWN_PCT_MAX=90`. |
| `src/domain/pricing/calculations.ts` | Eliminado placeholder `getPromotionStatus`. Reemplazado por const `NO_PROMOTION` (nadie lo importaba fuera de tests). |
| `src/domain/pricing/__tests__/markdown.test.ts` (nuevo) | 17 tests: applyMarkdown (rangos, redondeo, placeholders), calcMbpEffective (margen negativo por markdown agresivo), validateMarkdownPct (mensajes). |
| `src/queries/markdowns.queries.ts` (nuevo) | `fetchActiveMarkdowns`, `upsertMarkdown` (supersede previo + insert), `clearMarkdown` (mark expired, no DELETE). authClient. |
| `src/queries/keys.ts` | + `markdownKeys.active(brand)` + `markdownKeys.history(sku)`. |
| `src/features/pricing/hooks/useSkuMarkdowns.ts` (nuevo) | useQuery + 2 mutations + invalidation cruzada (`pricingKeys.all` + `markdownKeys.all`). Devuelve `bySku: Map`. |
| `src/features/pricing/components/MarkdownEditModal.tsx` (nuevo) | Modal con input %, nota opcional, preview de PVP efectivo + MBP% recalculado, botón "Quitar promoción" cuando ya hay markdown. |
| `src/features/pricing/components/PricingTable.tsx` | `PvpCell` (efectivo + tachado del original). `PromoCell` editable: pill clickeable si hay markdown, `+ Cargar` con borde dashed si no. MBP% se calcula sobre PVP efectivo. |
| `src/features/pricing/PricingPage.tsx` | Wire de `useSkuMarkdowns`, estado `editingRow`, render del modal. Stats (avgMBP, negativeMargin) recalculadas con PVP efectivo cuando hay markdown. |
| `src/domain/auth/types.ts` | + `canEditPricing: boolean` en `Permissions`. true para super_user/gerencia, false para resto. |

## Operador (post-merge)

1. Aplicar `sql/028_sku_markdowns.sql` en Supabase AUTH (`uxtzzcjimvapjpkeruwb`).
2. `vercel --prod`.

## Pendiente Fase 2 (futuro PR)

- Status `pending_approval` antes de `is_active=true` (la columna ya existe).
- Email al Gte Comercial vía Edge Function `send-email`.
- Bandeja de aprobación en `/precios` o página separada.
- Auto-expiración por `valid_until` vencido (cron o trigger).

## Verificación

```
Tests:  1856 passing (67 suites, +17 nuevos en markdown.test.ts, −3 en getPromotionStatus removido)
TSC:    0 errores
ESLint: 0 errores (2 warnings preexistentes en marketing/useMarketingProducts.ts)
Build:  OK (3.15s)
```
