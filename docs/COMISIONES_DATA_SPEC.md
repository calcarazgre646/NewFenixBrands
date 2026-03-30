# Comisiones — Especificacion de Datos

## Estado: Retail FUNCIONAL con datos reales. Mayorista/UTP esperando metas individuales.

---

## Logica de negocio implementada (2 modelos separados)

### RETAIL — % segun escala por meta por tienda

| Paso | Descripcion | Fuente de datos |
|------|-------------|-----------------|
| 1 | Sumar ventas de TODOS los vendedores de una tienda en el mes | `fjdhstvta1` agrupado por `v_sucursal_final` |
| 2 | Comparar total de la tienda vs meta de la tienda → cumplimiento% | `fmetasucu` (meta por tienda/mes) |
| 3 | Cumplimiento% determina el tramo de la escala del rol | `scales.ts` (8 escalas codificadas) |
| 4 | Comision de cada vendedor = su venta individual × % del tramo | Motor de calculo puro |
| 5 | Supervisores: monto fijo segun tramo (no %) | Gs. 0 / 600K / 700K / 800K |

**Estado: FUNCIONAL.** Datos reales de 33 vendedores en 13 tiendas.

### MAYORISTA / UTP — % meta de ventas + % meta de cobranza por ruta/vendedor

| Paso | Descripcion | Fuente de datos |
|------|-------------|-----------------|
| 1 | Venta del vendedor individual en el mes | `fjdhstvta1` filtrado por `v_vended` |
| 2 | Comparar vs meta INDIVIDUAL del vendedor → cumplimiento% ventas | `comisiones_metas_vendedor` (**NO EXISTE**) |
| 3 | Cumplimiento% determina tramo de la escala | `scales.ts` |
| 4 | Comision ventas = venta del vendedor × % del tramo | Motor de calculo puro |
| 5 | Comparar cobranza real vs meta cobranza → cumplimiento% cobranza | `c_cobrar` (**VACIA**) |
| 6 | Comision cobranza = cobranza real × % del tramo | Motor de calculo puro |
| 7 | Total = comision ventas + comision cobranza | Suma |

**Estado: PARCIAL.** Ventas reales conectadas (4 mayoristas + 1 UTP). Meta y cobranza en 0 → comision "Pendiente" en UI.

---

## 8 escalas codificadas (verificadas contra specs de Rodrigo)

### Canal Mayorista / UTP

| Rol | Umbral 0% | Primer tramo | 100% |
|-----|-----------|--------------|------|
| Vendedor Mayorista | < 70% → 0 | 70% → 0.85% | 100% → 1.15% |
| Vendedor UTP | < 80% → 0 | 80% → 0.12% | 100% → 0.17% |
| Back Office UTP | < 80% → 0 | 80% → 0.24% | 100% → 0.34% |
| Gerencia Mayorista | < 80% → 0 | 80% → 0.17% | 100% → 0.23% |
| Gerencia UTP | < 80% → 0 | 80% → 1.00% | 100% → 1.60% |

### Canal Retail

| Rol | Umbral 0% | Primer tramo | 100% |
|-----|-----------|--------------|------|
| Vendedor Tienda | < 70% → 0 | 70% → 0.85% | 100% → 1.15% |
| Supervisor Tienda | < 100% → Gs. 0 | 100% → Gs. 600K | 120%+ → Gs. 800K |
| Gerencia Retail | < 80% → 0 | 80% → 0.17% | 100% → 0.23% |

41 tests cubren las 8 escalas, edge cases, batch y summary.

---

## Datos que YA usamos (conectados)

### `fjdhstvta1` — Ventas por vendedor (~252K filas/ano)

| Campo | Ejemplo | Uso |
|-------|---------|-----|
| `v_vended` | 666 | Codigo unico del vendedor |
| `v_dsvende` | MARGARITA ORUE GAUTO | Nombre del vendedor |
| `v_sucursal_final` | ESTRELLA | Tienda donde vendio |
| `v_canal_venta` | B2C / B2B | Canal → determina logica retail vs mayorista |
| `v_uniforme` | retail / vtaxmayor / uniforme | Sub-tipo → determina rol |
| `v_vtasimpu` | 271818.18 | Venta neta sin impuesto (base de comision) |

**Vendedores activos (Ene 2026):** 33 retail + 4 mayorista + 1 UTP = 38 vendedores

### `fmetasucu` — Metas por tienda/mes (180 filas)

15 tiendas × 12 meses. Usado para **cumplimiento Retail** (meta por tienda).

### `fintsucu` — Mapeo codigos de tienda (50 filas)

`cosupc` → `cosujd` (ej: 0025 → MARTELMCAL). Usado para unir fmetasucu con fjdhstvta1.

---

## Datos que FALTAN (del lado de Fenix)

### 1. `comisiones_metas_vendedor` — BLOQUEANTE para Mayorista/UTP

Meta mensual individual por vendedor. Sin esto, Mayorista/UTP muestra "Pendiente".

```sql
CREATE TABLE comisiones_metas_vendedor (
  id BIGSERIAL PRIMARY KEY,
  vendedor_codigo INT NOT NULL,          -- v_vended de fjdhstvta1
  vendedor_nombre TEXT NOT NULL,
  rol_comision TEXT NOT NULL CHECK (rol_comision IN (
    'vendedor_mayorista', 'vendedor_utp', 'backoffice_utp',
    'gerencia_mayorista', 'gerencia_utp',
    'vendedor_tienda', 'supervisor_tienda', 'gerencia_retail'
  )),
  canal TEXT NOT NULL CHECK (canal IN ('mayorista', 'utp', 'retail')),
  año INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  trimestre INT NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  meta_ventas NUMERIC NOT NULL DEFAULT 0,
  meta_cobranza NUMERIC DEFAULT 0,       -- solo Mayorista/UTP
  sucursal_codigo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (vendedor_codigo, año, mes)
);

ALTER TABLE comisiones_metas_vendedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON comisiones_metas_vendedor FOR SELECT TO anon USING (true);
```

**Datos minimos por vendedor:**

| Campo | Ejemplo Mayorista | Ejemplo Retail |
|-------|-------------------|----------------|
| vendedor_codigo | 9 | 666 |
| vendedor_nombre | EDGAR LOPEZ | MARGARITA ORUE GAUTO |
| rol_comision | vendedor_mayorista | vendedor_tienda |
| canal | mayorista | retail |
| año | 2026 | 2026 |
| mes | 4 | 4 |
| meta_ventas | 80000000 | (no necesario, usa fmetasucu) |
| meta_cobranza | 50000000 | 0 |

**Alternativa:** CSV/Excel que nosotros importamos.

### 2. `c_cobrar` con datos — BLOQUEANTE para cobranza Mayorista/UTP

Tabla existe con 15 columnas pero **0 filas**. Campos disponibles: f_factura, f_pago, f_venc_cuota, monto_total, pendiente_de_pago, sucursal, ruc, razon_social.

**Sin este dato:** Comision de cobranza = Gs. 0 para todos los vendedores B2B.

### 3. Rol de comision por vendedor — MEJORA (no bloqueante)

Hoy inferimos el rol del canal:
- B2C → vendedor_tienda
- B2B vtaxmayor → vendedor_mayorista
- B2B uniforme → vendedor_utp

Sin mapeo explicito, no podemos distinguir: supervisor vs vendedor, gerencia vs vendedor, backoffice vs vendedor UTP.

**Se incluye en `comisiones_metas_vendedor.rol_comision`.**

---

## Archivos del modulo

### Domain (logica pura, 41 tests)

| Archivo | Contenido |
|---------|-----------|
| `domain/commissions/types.ts` | 8 roles, 3 canales, SellerGoal, CommissionResult, CommissionSummary |
| `domain/commissions/scales.ts` | 8 escalas verificadas + SCALE_BY_ROLE registry + labels |
| `domain/commissions/calculations.ts` | calcCumplimiento, findTier, calcPercentageCommission, calcFixedCommission, calcCommission, calcAllCommissions, buildCommissionSummary |
| `domain/commissions/storeMapping.ts` | classifyStoreForCommission, storeGoalToSellerGoal |
| `domain/commissions/__tests__/calculations.test.ts` | 41 tests: 8 roles, edge cases, batch, summary |

### Queries

| Archivo | Contenido |
|---------|-----------|
| `queries/commissions.queries.ts` | fetchSellerSales — ventas por vendedor de fjdhstvta1 |

### UI

| Archivo | Contenido |
|---------|-----------|
| `features/commissions/CommissionsPage.tsx` | Pagina: KPIs, filtro mes/canal, badge "Datos reales" |
| `features/commissions/hooks/useCommissions.ts` | Hook con 2 logicas: Retail (tienda) + Mayorista/UTP (vendedor) |
| `features/commissions/components/CommissionTable.tsx` | Tabla paginada, "Pendiente" para datos faltantes |
| `features/commissions/components/ScalesReference.tsx` | 8 tablas de referencia collapsibles |

### Infraestructura

| Archivo | Cambio |
|---------|--------|
| `domain/auth/types.ts` | +canViewCommissions (super_user + gerencia) |
| `App.tsx` | +ruta `/comisiones` con PermissionGuard |
| `layout/AppSidebar.tsx` | +item "Comisiones" en seccion Control |
| `layout/AppHeader.tsx` | Filtros ocultos en `/comisiones` |
| `queries/keys.ts` | +commissionKeys |

---

## Cuando Fenix entregue los datos

### Con `comisiones_metas_vendedor`:
1. Agregar query que lea la tabla
2. En el hook, para Mayorista/UTP: usar meta individual en vez de 0
3. Aplicar `rol_comision` del vendedor en vez de inferirlo
4. **Estimado: 1-2 horas**

### Con `c_cobrar` poblada:
1. Agregar query que sume cobranza por vendedor/mes
2. En el hook, pasar cobranzaReal al calcCommission
3. **Estimado: 1 hora**

### Total integracion final: ~3 horas cuando esten los datos.

---

## Preguntas pendientes para Rodrigo / Derlys

1. **Base de calculo:** Asumimos `v_vtasimpu` (venta neta sin impuesto). Correcto?
2. **Meta de cobranza:** Usa la misma escala que ventas? Se suman los dos montos resultantes?
3. **Supervisores Tienda:** Monto fijo por supervisor o por cada tienda que supervisa?
4. **Gerencia:** % sobre total del canal o sobre ventas de sus reportes directos?
5. **Vendedor 999:** Transacciones sin vendedor (varias tiendas). Se ignoran?
6. **Frecuencia de metas:** Una vez al trimestre o ajustables mes a mes?
7. **Excel clientes por ruta:** Lo necesitamos? Ya tenemos `maestro_clientes_mayoristas` (444 clientes).
