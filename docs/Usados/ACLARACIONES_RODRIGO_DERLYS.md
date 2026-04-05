# Cosas para aclarar con Rodrigo / Derlys

---

## 1. Discrepancia Objetivo Anual (70B) vs Presupuesto por Marca (16.8B)

**Fecha hallazgo:** 08/03/2026, 00:30

### El problema

El dashboard tiene dos fuentes de datos diferentes para el "objetivo":

| Fuente | Tabla BD | Que contiene | Total anual |
|--------|----------|--------------|-------------|
| **Store Goals** | `fmetasucu` | Metas por TIENDA (15 sucursales x 12 meses) | **69.89 B** |
| **Brand Budget** | `Budget_2026` | Presupuesto por MARCA x CANAL | **16.81 B** |

El ratio es **4.16x** — las metas por tienda son 4 veces mayores que el presupuesto por marca.

### Desglose store goals (fmetasucu)

```
MAYORISTA       21.67 B [B2B]
MARTELMCAL       6.80 B [B2C]
UTP              5.97 B [B2B]
0200             5.31 B [B2C]
TOLUQ            4.21 B [B2C]
GALERIAWRLEE     3.32 B [B2C]
WRSSL            3.11 B [B2C]
SHOPMCAL         3.06 B [B2C]
ESTRELLA         2.91 B [B2C]
WRMULTIPLAZA     2.82 B [B2C]
TOSUR            2.40 B [B2C]
MARTELSSL        2.11 B [B2C]
SHOPPINEDO       2.10 B [B2C]
SHOPMARIANO      2.05 B [B2C]
CERROALTO        2.04 B [B2C]
─────────────────────────────
B2C total:      42.25 B
B2B total:      27.64 B
TOTAL:          69.89 B
```

### Desglose brand budget (Budget_2026)

```
Wrangler / B2C    6.32 B
Wrangler / B2B    3.83 B
Martel / B2C      3.07 B
Martel / B2B      2.28 B
Lee / B2C         1.05 B
Lee / B2B         0.26 B
─────────────────────────────
TOTAL:           16.81 B
```

### Lo que ve el usuario en el dashboard

- **Vista Total (sin filtro)**: Objetivo = 69.89B, YTD = 5.43B, Forecast = 29.57B → **atrasados** (brecha 40B)
- **Vista Martel**: Objetivo = 5.35B (budget), YTD = 1.77B, Forecast = 9.64B → **adelantados** (supera por 4.29B)
- **Vista Wrangler**: Objetivo = 10.15B (budget), YTD = 3.18B, Forecast = 17.35B → **adelantados** (supera por 7.2B)
- **Vista Lee**: Objetivo = 1.30B (budget), YTD = 407M, Forecast = 2.22B → **adelantados** (supera por 917M)

**Paradoja:** Las 3 marcas individualmente estan adelantadas pero el total esta atrasado. Esto es porque el total usa store goals (70B) y las marcas usan brand budget (16.8B) — son numeros incompatibles.

### Lo que dijo Rodrigo en el chat (24/02/2026)

> **Rodrigo (9:53):** "esto son 70mil millones por favor (y todo va contra esta meta)"
>
> **Carlos (9:55):** "Si te parece podemos evitar hacer la suma y poner directamente fijo 70mil millones"
> "Pero no permitiria trazar x meta de tienda"
> "Cuando vemos el valor total vemos 70mil millones, pero en las vistas por tienda si estiramos las metas de la bd"
>
> **Rodrigo (9:57):** "Total contra los 70MM y todo el resto contra la BD"
>
> **Rodrigo (15:06):** "Falta modificar a $70.000.000.000 el objetivo anual. El resto contra BD."

### Implementacion actual

Siguiendo la instruccion de Rodrigo:
- **Total** → usa `calcAnnualTarget(storeGoals)` = 69.89B (aprox 70B)
- **Por canal** → filtra store goals por canal (B2C: 42.25B, B2B: 27.64B)
- **Por marca** → usa `Budget_2026` como proxy (porque store goals NO tienen columna de marca)
- **Por tienda** → filtra store goals por tienda

### Preguntas para Rodrigo/Derlys

1. **¿Es correcto que la suma de los budgets por marca (16.8B) sea tan diferente del objetivo total (70B)?** ¿Las store goals incluyen revenue que no es de estas 3 marcas (servicios, otros productos)?

2. **¿Deberiamos usar Budget_2026 como target cuando filtramos por marca?** Es lo unico que tenemos con desglose por marca, pero genera la paradoja de marcas-adelantadas/total-atrasado.

3. **Opcion A: Usar siempre Budget_2026 como target** (16.81B total). Consistente entre total y marcas. Pero descarta las metas por tienda y Rodrigo especificamente dijo "70MM el total".

4. **Opcion B: Mantener como esta** — 70B para total, budget por marca. Aceptar que la suma de partes no es igual al todo porque son fuentes de datos diferentes con scopes diferentes.

5. **Opcion C: Cargar un nuevo dato** — `Budget_2026` con metas de marca que sumen ~70B. Asi total y marcas serian consistentes.

---

---

## 2. mv_ventas_mensual.neto: ¿v_vtasimpu o v_impneto?

**Fecha hallazgo:** 08/03/2026, 01:00

### Verificacion empirica

Comparamos totales de Enero 2026 entre `mv_ventas_mensual` y `fjdhstvta1`:

```
mv_ventas_mensual.neto (Ene 2026) = 4,041,505,354

fjdhstvta1:
  SUM(v_impneto)  = 4,444,301,169   (diff: 402M — NO coincide)
  SUM(v_vtasimpu) = 4,040,465,581   (diff: 1M — COINCIDE con margen de redondeo)

Ratio mv.neto / SUM(v_vtasimpu) = 1.000257 (≈ 1:1)
Ratio mv.neto / SUM(v_impneto)  = 0.909368 (≈ 1/1.10 — factor IVA 10%)
```

### Conclusion

**mv_ventas_mensual.neto = SUM(v_vtasimpu)** — La vista YA usa la columna correcta (ventas sin IVA). La diferencia de ~1M sobre 4B es redondeo de precision flotante (0.025%), aceptable.

**NO hay bug.** La instruccion de Derlys del 25/02 ya fue aplicada en la vista materializada.

### Hallazgo adicional: la vista incluye TODOS los canales

```
Canales en mv_ventas_mensual: B2B, B2C, Batas, Interno, Otros
```

La vista incluye canales no-comerciales (Batas, Interno, Otros). La app los filtra correctamente con `.in("v_canal_venta", ["B2C", "B2B"])` en todas las queries, pero la vista tiene mas datos de los necesarios. No es un bug pero se podria optimizar la vista para excluirlos.

---

## 3. Markdown: formula amount-based vs count-based

**Fecha hallazgo:** 08/03/2026, 01:00

Derlys dijo (26/02): "conteo de las ventas donde v_impdscto es mayor a cero" — esto suena a **count-based** (facturas con descuento / total facturas).

La app implementa **amount-based**: `dcto / bruto × 100` (monto de descuentos / monto bruto).

Esto es matematicamente mas preciso para medir dependencia de oferta en terminos de impacto financiero. El count-based mediria frecuencia de descuento. Son metricas diferentes.

**Preguntar:** ¿Rodrigo/Derlys prefieren:
- **Amount-based (actual):** "30% del revenue vino con descuento" → impacto financiero
- **Count-based:** "45% de las facturas tuvieron algun descuento" → frecuencia

Se puede ofrecer ambas si quieren.

---

## 4. UPT deshabilitado

**Fecha hallazgo:** 08/03/2026, 01:00

El KPI de UPT (Units Per Transaction) esta deshabilitado con mensaje "Dato no disponible — se necesita vista con items por factura".

La formula `calcUPT(totalUnits, totalTickets)` existe en el codigo. El problema es que `vw_ticket_promedio_diario` no tiene desglose por marca, asi que cuando se filtra por marca el denominador (total facturas) seria de TODAS las marcas — inflando el UPT.

**Preguntar:** ¿Derlys puede agregar columna de marca a `vw_ticket_promedio_diario`? Con eso se activa inmediatamente.

---

## 5. SKU Comercial vs SKU ERP

**Fecha hallazgo:** 08/03/2026, 01:00

Rodrigo instruyó (25/02): "Todo análisis de SKU debe hacerse sobre la base del SKU Comercial y no la Referencia del ERP."

**Estado actual:** La app usa SKU ERP (`e_sku` / `v_sku`) en TODOS los modulos:
- Cola de Acciones: muestra SKU numerico (ej: `7031457`)
- Top SKUs (Ventas): muestra SKU numerico
- Inventario: SKU numerico

**Dim_maestro_comercial** tiene el campo `codigo_unico_final` (ej: `MACA004428`) que es el SKU Comercial. La tabla ya esta en la BD y el JOIN ya existe en `mv_stock_tienda` pero solo se extrae `tipo_articulo`, no el codigo comercial.

**Para implementar:**
1. Agregar `codigo_unico_final` a `mv_stock_tienda` (SQL por Derlys)
2. Agregar campo `comercialSku` a InventoryRecord type
3. Actualizar queries para extraer el campo
4. Actualizar tablas UI para mostrar SKU comercial

**Pregunta:** ¿Para las ventas (fjdhstvta1) tambien se necesita JOIN con Dim_maestro_comercial? Actualmente `fetchTopSkus` muestra `v_sku` directo.

---

## Instrucciones del chat sobre datos y BD (oro para desarrollo)

### Columnas y tablas

| Fecha | Quien | Instruccion |
|-------|-------|-------------|
| 25/02 13:59 | Derlys | Ventas sin IVA usar columna `v_vtasimpu` en lugar de `v_impneto` |
| 25/02 12:43 | Carlos | Budget_2026 = presupuesto mensual por marca y canal |
| 25/02 12:43 | Carlos | Dim_maestro_comercial = categoria comercial por SKU (llave: SKU + Talla) |
| 25/02 12:43 | Carlos | Dim_marcas = normalizar nombres de marca |
| 25/02 13:23 | Derlys | Tipo de articulo agregado como columna en Dim_maestro_comercial |
| 26/02 16:38 | Derlys | Devoluciones = montos negativos en columna de importe. % devolucion = negativos / total ventas |
| 26/02 16:40 | Derlys | Markdown/oferta = conteo de ventas donde `v_impdscto > 0` |
| 03/03 15:44 | Derlys | UPT: cantidad facturas viene de vista, numerador de `v_cantvend` de fjdhstvta1 |
| 05/03 17:44 | Derlys | Recurrencia, EBITDA (tabla gastos), presupuesto de compra, SL (movimientos), cobranzas (tabla limpiandose), conversion (facturas / gente que entra - sensor) pendientes |

### Filtros y reglas de negocio

| Fecha | Quien | Instruccion |
|-------|-------|-------------|
| 24/02 09:54 | Rodrigo | Solo ventas B2B y B2C. Sin Batas, PI, etc. |
| 24/02 09:57 | Rodrigo | **"Total contra los 70MM y todo el resto contra la BD"** |
| 24/02 15:12 | Rodrigo | "Me interesa que el POD sea 100% comercial B2B y B2C solamente" |
| 24/02 15:44 | Rodrigo | Solo zonas de mayoristas y tiendas de retail |
| 25/02 09:25 | Rodrigo | Necesita capa intermedia ejecutiva: por Categoria de Producto y por Tienda/Zona antes de SKU |
| 25/02 09:27 | Rodrigo | Performance Mensual: opcion de elegir total Fenix, B2B, B2C y cada marca |
| 25/02 16:06 | Rodrigo | Analisis de SKU sobre SKU Comercial, no referencia ERP |
| 25/02 16:06 | Rodrigo | Calendario: definir SKUs que participan en accion + nivel de disponibilidad (stock actual) |
| 25/02 16:06 | Rodrigo | Logistica: ETAs de importacion y fabricacion. Cruce con calendario (auto-poblar llegadas) |
| 03/03 11:49 | Derlys | Cola de acciones: priorizar por "reponer" como mas critico, luego por volumen |

### Deployment y accesos

| Fecha | Quien | Dato |
|-------|-------|------|
| 05/02 14:49 | Derlys | API ventas sin IVA: ngrok URL (temporal) con x-api-key |
| 24/02 09:44 | Carlos | Produccion: fenixbrands.subestatica.com |
| 05/03 16:32 | Derlys | Acceso BD Supabase compartido con Carlos y Fabian |

### Datos pendientes de cargar (segun chat 05/03)

- [ ] Tabla de gastos (para EBITDA)
- [ ] Presupuesto de compra
- [ ] Movimientos para SL (Service Level)
- [ ] Tabla de cobranzas (Derlys limpiando)
- [ ] Tabla del sensor (conversion rate — con proveedor)
- [ ] Historico de venta por cliente (Derlys dijo que falta)
