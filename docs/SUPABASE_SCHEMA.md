# Mapeo Completo - Supabase GH

**Proyecto:** gwzllatcxxrizxtslkeh
**URL:** `https://gwzllatcxxrizxtslkeh.supabase.co`
**PostgreSQL:** v14.1
**Fecha de mapeo:** 2026-03-05

---

## Resumen General

| # | Entidad | Tipo | Filas | Columnas | Acceso API |
|---|---------|------|------:|----------|------------|
| 1 | `Budget_2026` | Tabla | 2,842 | 15 | GET, POST, PATCH, DELETE |
| 2 | `CLIM100` | Tabla | 82,905 | 17 | GET, POST, PATCH, DELETE |
| 3 | `Dim_maestro_comercial` | Tabla | 511,086 | 5 | GET, POST, PATCH, DELETE |
| 4 | `Dim_marcas` | Tabla | 22 | 2 | GET, POST, PATCH, DELETE |
| 5 | `Import` | Tabla | 303 | 16 | GET, POST, PATCH, DELETE |
| 6 | `fintsucu` | Tabla | 121 | 3 | GET, POST, PATCH, DELETE |
| 7 | `fjdexisemp` | Tabla | 54,624 | 30 | GET, POST, PATCH, DELETE |
| 8 | `fjdhstvta1` | Tabla | 252,936 | 40 | GET, POST, PATCH, DELETE |
| 9 | `fmetasucu` | Tabla | 180 | 4 | GET, POST, PATCH, DELETE |
| 10 | `mv_ventas_mensual` | Vista Materializada | 1,429 | 9 | GET (solo lectura) |
| 11 | `v_inventario` | Vista | 429,004 | 31 | GET (solo lectura) |
| 12 | `v_transacciones_dwh` | Tabla | 0 | 16 | GET, POST, PATCH, DELETE |
| 13 | `vw_ticket_promedio_diario` | Vista | 10,115 | 8 | GET (solo lectura) |

**Total filas:** ~1,345,447
**Total entidades:** 13 (9 tablas + 1 vista materializada + 3 vistas/tablas sin escritura)
**RPC Functions:** Ninguna expuesta

---

## Detalle por Entidad

---

### 1. `Budget_2026` — Presupuesto 2026

**Filas:** 2,842 | **Columnas:** 15 | **PK:** ninguna definida
**Descripcion:** Presupuesto semanal por tienda/marca con proyecciones de revenue, costo y margen.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `Year` | bigint | no | Ano fiscal (2026) |
| `Qtr` | text | no | Trimestre: Q1, Q2, Q3, Q4 |
| `Month` | text | no | Mes en espanol: Enero, Febrero... |
| `Week` | text | no | Semana: W01, W02... |
| `Area` | text | no | B2C, B2B |
| `Channel/Store` | text | no | Codigo de tienda (ej: GALERIAWRLEE) |
| `Brand` | text | no | Marca: Lee, Wrangler, Martel... |
| `Units` | double precision | no | Unidades presupuestadas |
| `Revenue` | text | no | Ingreso bruto (formato texto con separador de miles) |
| `COGS` | text | no | Costo de ventas (texto) |
| `Gross Margin` | text | no | Margen bruto (texto) |
| `%GM` | text | no | Porcentaje margen bruto |
| `%COGS` | text | no | Porcentaje COGS |
| `Status` | text | no | "Presupuesto" |
| `Sales Comisions` | text | no | Comisiones de venta (texto) |

**Observaciones:**
- Los campos monetarios (Revenue, COGS, Gross Margin, Sales Comisions) estan almacenados como **texto** con formato de separador de miles y espacios. Requieren limpieza para calculos.
- No tiene PK ni FK definidos.

---

### 2. `CLIM100` — Maestro de Clientes

**Filas:** 82,905 | **Columnas:** 17 | **PK:** `Codigo`
**Descripcion:** Tabla maestra de clientes con datos de contacto, RUC y clasificacion.

| Columna | Tipo PostgreSQL | Requerida | Max Length | Notas |
|---------|----------------|-----------|-----------|-------|
| `Codigo` | character varying | **SI** | 50 | **PK** - Codigo unico de cliente |
| `RUC` | character varying | no | 20 | Numero de RUC |
| `DV` | character varying | no | 5 | Digito verificador |
| `Ruc_completo` | character varying | no | 30 | RUC + DV concatenados |
| `Razon_social` | text | no | - | Nombre completo del cliente |
| `Domicilio` | text | no | - | Direccion |
| `Telefono1` | character varying | no | 50 | Telefono principal |
| `Telefono2` | character varying | no | 50 | Telefono secundario |
| `Dip` | character varying | no | 50 | Documento de identidad |
| `Fecha_ingreso` | timestamptz | no | - | Fecha de alta |
| `Ultima_modificacion` | timestamptz | no | - | Ultima fecha de edicion |
| `Tipo_cliente` | character varying | no | 100 | Tipo numerico (0, 1...) |
| `Correo` | character varying | no | 255 | Email |
| `Cat_Tipo_cliente` | character varying | no | 100 | Categoria de tipo de cliente |
| `Sucursal_modificacion` | character varying | no | 50 | Sucursal que hizo la ultima modificacion |
| `Linea_credito` | numeric | no | - | Limite de credito |
| `created_at` | timestamptz | no | - | Timestamp de carga (default=now()) |

**Observaciones:**
- Unica tabla con PK definida en el schema.
- Los campos de texto tienen espacios en blanco (padding) — datos vienen de un sistema legacy.
- `created_at` = 2026-03-03 para todos los registros → carga masiva reciente.

---

### 3. `Dim_maestro_comercial` — Dimension Maestro Comercial (SKU)

**Filas:** 511,086 | **Columnas:** 5 | **PK:** ninguna definida
**Descripcion:** Catalogo de productos con mapeo de SKU a tipo de articulo y codigo unico.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `codigo_unico_final` | text | no | Codigo unico del producto (ej: MACA004428) |
| `sku` | text | no | SKU con talla incluida (ej: 7031457-50) |
| `SKU-I` | bigint | no | SKU numerico sin talla |
| `talla` | text | no | Talla del articulo |
| `tipo_articulo` | text | no | Tipo: camisa, bermuda, jean, remera, etc. |

**Observaciones:**
- Tabla de dimension grande (511K filas) — un registro por combinacion SKU+talla.
- `codigo_unico_final` agrupa multiples SKUs del mismo producto.
- Relacion implicita con `fjdexisemp.e_sku` y `fjdhstvta1.v_sku` via `SKU-I`.

---

### 4. `Dim_marcas` — Dimension de Marcas

**Filas:** 22 | **Columnas:** 2 | **PK:** ninguna definida
**Descripcion:** Mapeo de marcas originales a marcas agrupadas/finales.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `Marca` | text | no | Nombre original de la marca |
| `Marca_final` | text | no | Nombre agrupado (Martel, Wrangler, Lee, Otras) |

**Contenido completo (22 registros):**

| Marca | Marca_final |
|-------|-------------|
| Martel | Martel |
| Martel Premium | Martel |
| Martel Ao Po'i | Martel |
| Martel Express | Martel |
| Niella | Martel |
| Wrangler | Wrangler |
| Lee | Lee |
| Lee Cooper | Otras |
| M & CO | Otras |
| Urban | Otras |
| Maverick | Otras |
| Alfesa | Otras |
| Vans | Otras |
| Forli | Otras |
| Sara | Otras |
| Individual | Otras |
| Lez a Lez | Otras |
| Cat | Otras |
| Jeep | Otras |
| Calvin Klein | Otras |
| Base | Otras |
| Varias | Otras |

**Observaciones:**
- 4 grupos finales: Martel (5 sub-marcas), Wrangler, Lee, Otras (14 marcas).
- Relacion implicita con `fjdexisemp.e_marca`, `fjdhstvta1.v_marca`, `mv_ventas_mensual.v_marca`.

---

### 5. `Import` — Importaciones

**Filas:** 303 | **Columnas:** 16 | **PK:** ninguna definida
**Descripcion:** Catalogo de productos en proceso de importacion con costos y margenes estimados.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `MARCA` | text | no | Marca del producto |
| `TEMPORADA` | text | no | Temporada (ej: SS25/26) |
| `PROVEEDOR` | text | no | Nombre del proveedor |
| `CATEGORIA` | text | no | Categoria de producto |
| `INFOGRAL.` | text | no | Informacion general |
| `CODIGOEAN` | text | no | Codigo EAN/barras |
| `DESCRIPCION` | text | no | Descripcion del producto |
| `COLOR/WASH` | text | no | Color o lavado |
| `CANTIDAD` | bigint | no | Cantidad a importar |
| `ORIGEN` | text | no | Pais de origen (Peru, etc.) |
| `COSTOESTIMADO` | text | no | Costo estimado (texto con formato moneda) |
| `PVPSUGERIDOB2C` | text | no | Precio sugerido B2C |
| `PVPSUGERIDOB2B` | text | no | Precio sugerido B2B |
| `MARGENB2C` | text | no | Margen B2C porcentual |
| `MARGENB2B` | text | no | Margen B2B porcentual |
| `FECHAAPROXIMADADEARRIBO` | text | no | Fecha estimada de llegada (texto) |

**Observaciones:**
- Campos de precio/costo almacenados como texto con formato moneda.
- Fechas almacenadas como texto (dd/mm/yyyy).

---

### 6. `fintsucu` — Tabla Puente de Sucursales

**Filas:** 121 | **Columnas:** 3 | **PK:** ninguna definida
**Descripcion:** Mapeo de codigos de sucursal entre sistemas (codigo PC vs codigo JD).

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `cosupc` | text | no | Codigo sucursal sistema PC (4 digitos: 0001-9999) |
| `cosujd` | text | no | Codigo sucursal sistema JD (nombre corto) |
| `dscsuc` | text | no | Descripcion/nombre completo de la sucursal |

**Observaciones:**
- 121 sucursales registradas.
- `cosujd` se relaciona con `fjdexisemp.e_sucursal` y `fjdhstvta1.v_sucursal`.
- `cosupc` se relaciona con `fmetasucu.cod_sucursal`, `vw_ticket_promedio_diario.codigo_sucursal`.
- Incluye: tiendas retail (GALERIAWRLEE, SHOPMARIANO...), almacenes, fabricas, show rooms, consignatarios (JS/JeansStore), muestrarios de vendedores mayoristas, exportacion, e-commerce.

---

### 7. `fjdexisemp` — Existencias (Inventario Detallado)

**Filas:** 54,624 | **Columnas:** 30 | **PK:** ninguna definida
**Descripcion:** Stock actual por sucursal/SKU/talla con atributos comerciales completos del producto.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `e_sucursal` | text | no | Codigo sucursal (sistema JD) |
| `e_dssucurs` | text | no | Descripcion sucursal |
| `e_tpitem` | text | no | Tipo de item (1=producto) |
| `e_sku` | text | no | Codigo SKU |
| `e_talle` | text | no | Talla |
| `e_descrip` | text | no | Descripcion completa del producto |
| `e_rubro` | text | no | Rubro (Confeccion) |
| `e_marca` | text | no | Marca |
| `e_tipoart` | text | no | Tipo articulo (bermuda, jean, remera...) |
| `e_modelo` | text | no | Modelo (moda, polo, basico...) |
| `e_edadgen` | text | no | Edad/genero (adulto masculino, adulto femenino...) |
| `e_tempano` | text | no | Temporada/ano (Ver.25/26...) |
| `e_diseno` | text | no | Diseno (liso, estampado, varios...) |
| `e_nomsilue` | text | no | Nombre silueta (5 Pocket Short, SS Polo...) |
| `e_dscsilue` | text | no | Descripcion silueta/fit (Relaxed Fit, Regular Fit...) |
| `e_color` | text | no | Color |
| `e_estcomer` | text | no | Estado comercial (lanzamiento, bloqueado...) |
| `e_carryov` | text | no | Carry over (SI/NO) |
| `e_tempvta` | text | no | Temporada de venta |
| `e_lineapr` | text | no | Linea de producto (Pantalaneria, etc.) |
| `e_mercvta` | text | no | Mercado de venta (Local, Export) |
| `e_tipotej` | text | no | Tipo de tejido |
| `e_tipocue` | text | no | Tipo de cuello |
| `e_tipoman` | text | no | Tipo de manga |
| `e_cantid` | double precision | no | **Cantidad en stock** |
| `e_costo` | double precision | no | Costo unitario |
| `e_valor` | double precision | no | Valor total (costo x cantidad) |
| `e_tipoprec` | text | no | Tipo de precio (PN=normal) |
| `e_precio` | double precision | no | Precio de venta retail |
| `e_precmay` | double precision | no | Precio mayorista |

**Observaciones:**
- Granularidad: una fila por sucursal + SKU + talla.
- Relaciones implicitas: `e_sucursal` → `fintsucu.cosujd`, `e_sku` → `Dim_maestro_comercial.SKU-I`, `e_marca` → `Dim_marcas.Marca`.

---

### 8. `fjdhstvta1` — Historial de Ventas (Detalle Transaccional)

**Filas:** 252,936 | **Columnas:** 40 | **PK:** ninguna definida
**Descripcion:** Detalle de cada linea de venta con producto, vendedor, precios y descuentos. Tabla principal de hechos.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `v_ano` | double precision | no | Ano de la venta |
| `v_mes` | double precision | no | Mes (1-12) |
| `v_dia` | double precision | no | Dia (1-31) |
| `v_sucursal` | text | no | Codigo sucursal (sistema JD) |
| `v_ccosto` | text | no | Centro de costo |
| `v_dsccosto` | text | no | Descripcion centro de costo |
| `v_uniforme` | text | no | Tipo negocio (Retail, Mayoreo...) |
| `v_vended` | double precision | no | Codigo vendedor |
| `v_dsvende` | text | no | Nombre del vendedor |
| `v_sku` | text | no | Codigo SKU |
| `v_talle` | text | no | Talla |
| `v_descrip` | text | no | Descripcion del producto |
| `v_rubro` | text | no | Rubro |
| `v_marca` | text | no | Marca |
| `v_tipoart` | text | no | Tipo de articulo |
| `v_modelo` | text | no | Modelo |
| `v_edadgen` | text | no | Edad/genero |
| `v_tempano` | text | no | Temporada/ano |
| `v_diseno` | text | no | Diseno |
| `v_nomsilue` | text | no | Nombre silueta |
| `v_dscsilue` | text | no | Descripcion silueta/fit |
| `v_color` | text | no | Color |
| `v_estcomer` | text | no | Estado comercial |
| `v_carryov` | text | no | Carry over (SI/NO) |
| `v_tempvta` | text | no | Temporada de venta |
| `v_lineapr` | text | no | Linea de producto |
| `v_mercvta` | text | no | Mercado de venta |
| `v_tipotej` | text | no | Tipo de tejido |
| `v_tipocue` | text | no | Tipo de cuello |
| `v_tipoman` | text | no | Tipo de manga |
| `v_tipoprec` | text | no | Tipo de precio |
| `v_cantvend` | double precision | no | **Cantidad vendida** |
| `v_impbruto` | double precision | no | **Importe bruto** |
| `v_impdscto` | double precision | no | **Importe descuento** |
| `v_impneto` | double precision | no | **Importe neto** (bruto - descuento) |
| `v_vtasimpu` | double precision | no | **Venta sin impuesto** |
| `v_porcdcto` | double precision | no | Porcentaje de descuento |
| `v_valor` | double precision | no | Valor/costo del producto |
| `v_sucursal_final` | text | no | Sucursal final (puede diferir de v_sucursal) |
| `v_canal_venta` | text | no | Canal: B2C, B2B |

**Observaciones:**
- Tabla de hechos principal. Granularidad: una fila por linea de venta.
- Misma estructura de atributos de producto que `fjdexisemp`.
- Datos observados: ano 2025 (dic) y 2026 (ene-feb).
- Relaciones implicitas: `v_sucursal` → `fintsucu.cosujd`, `v_sku` → `Dim_maestro_comercial.SKU-I`, `v_marca` → `Dim_marcas.Marca`.

---

### 9. `fmetasucu` — Metas por Sucursal

**Filas:** 180 | **Columnas:** 4 | **PK:** ninguna definida
**Descripcion:** Metas de venta mensuales por sucursal.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `cod_sucursal` | text | no | Codigo sucursal (sistema PC, 4 digitos) |
| `meta` | double precision | no | Meta de venta en guaranies |
| `periodo` | text | no | Periodo YYYYMM (ej: 202601) |
| `fecha_carga` | timestamp | no | Timestamp de carga |

**Observaciones:**
- Relacion implicita: `cod_sucursal` → `fintsucu.cosupc`.
- 180 registros ÷ ~120 sucursales activas ≈ 1-2 meses de metas cargadas.

---

### 10. `mv_ventas_mensual` — Vista Materializada: Ventas Mensuales

**Filas:** 1,429 | **Columnas:** 9 | **Acceso:** Solo lectura (GET)
**Descripcion:** Agregado mensual de ventas por marca, sucursal y canal. Pre-calculado desde `fjdhstvta1`.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `v_ano` | double precision | no | Ano |
| `v_mes` | double precision | no | Mes |
| `v_marca` | text | no | Marca |
| `v_sucursal_final` | text | no | Sucursal final |
| `v_canal_venta` | text | no | Canal (B2C, B2B) |
| `neto` | double precision | no | Suma importe neto |
| `costo` | double precision | no | Suma costo |
| `bruto` | double precision | no | Suma importe bruto |
| `dcto` | double precision | no | Suma descuentos |

**Observaciones:**
- Vista materializada — datos pre-agregados para dashboards.
- Contiene datos 2025 y 2026.

---

### 11. `v_inventario` — Vista: Inventario con Tipo de Articulo

**Filas:** 429,004 | **Columnas:** 31 | **Acceso:** Solo lectura (GET)
**Descripcion:** Vista que extiende `fjdexisemp` con la columna `tipo_articulo` de `Dim_maestro_comercial`.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| *(mismas 30 columnas de `fjdexisemp`)* | | | |
| `tipo_articulo` | text | no | Tipo de articulo desde `Dim_maestro_comercial` |

**ALERTA - BUG CONOCIDO:**
- **429,004 filas vs 54,624 en `fjdexisemp`** → factor ~7.8x de inflacion.
- Probable JOIN cartesiano entre `fjdexisemp` y `Dim_maestro_comercial` cuando un SKU tiene multiples tallas en la dimension.
- Se observan filas duplicadas (misma sucursal + SKU + talla aparece multiples veces).
- **Los totales de inventario calculados desde esta vista estaran INFLADOS.**

---

### 12. `v_transacciones_dwh` — Transacciones DWH

**Filas:** 0 (vacia) | **Columnas:** 16 | **Acceso:** GET, POST, PATCH, DELETE
**Descripcion:** Tabla preparada para un Data Warehouse de transacciones. Actualmente vacia.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `id_transaccion_fecha` | text | no | ID compuesto transaccion+fecha |
| `num_transaccion` | double precision | no | Numero de transaccion |
| `fecha_original` | text | no | Fecha original (texto) |
| `ano` | text | no | Ano |
| `mes` | text | no | Mes |
| `dia` | text | no | Dia |
| `fecha_formateada` | text | no | Fecha en formato dd/mm/yyyy |
| `codigo_sucursal` | text | no | Codigo sucursal |
| `codigo_cliente` | double precision | no | Codigo del cliente |
| `razon_social` | text | no | Nombre del cliente |
| `ruc` | text | no | RUC del cliente |
| `tipo_cliente` | double precision | no | Tipo de cliente |
| `tipo_factura` | double precision | no | Tipo de factura |
| `tipo_transaccion` | double precision | no | Tipo de transaccion |
| `importe_neto` | double precision | no | Importe neto |
| `venta_sin_impuesto` | double precision | no | Venta sin impuesto |

**Observaciones:**
- Tabla estructura preparada pero sin datos cargados.
- Disenada para cruzar transacciones con clientes (CLIM100).

---

### 13. `vw_ticket_promedio_diario` — Vista: Ticket Promedio Diario

**Filas:** 10,115 | **Columnas:** 8 | **Acceso:** Solo lectura (GET)
**Descripcion:** Ticket promedio diario por sucursal, calculado desde transacciones.

| Columna | Tipo PostgreSQL | Requerida | Notas |
|---------|----------------|-----------|-------|
| `ano` | text | no | Ano |
| `mes` | text | no | Mes |
| `dia` | text | no | Dia |
| `fecha_formateada` | text | no | Fecha dd/mm/yyyy |
| `codigo_sucursal` | text | no | Codigo sucursal (sistema PC) |
| `cantidad_facturas` | bigint | no | Numero de facturas del dia |
| `venta_total_dia` | double precision | no | Venta total del dia |
| `ticket_promedio` | numeric | no | Venta total / cantidad facturas |

**Observaciones:**
- Datos desde enero 2024.
- `codigo_sucursal` → `fintsucu.cosupc`.

---

## Mapa de Relaciones (Implicitas)

No hay foreign keys formales definidas en el schema (excepto PK en CLIM100). Las relaciones son **implicitas por convencion de nombres**:

```
fintsucu (tabla puente de sucursales)
  ├── cosupc ←→ fmetasucu.cod_sucursal
  ├── cosupc ←→ vw_ticket_promedio_diario.codigo_sucursal
  ├── cosupc ←→ v_transacciones_dwh.codigo_sucursal
  ├── cosujd ←→ fjdexisemp.e_sucursal
  ├── cosujd ←→ fjdhstvta1.v_sucursal
  └── cosujd ←→ Budget_2026."Channel/Store"

Dim_marcas (dimension de marcas)
  ├── Marca ←→ fjdexisemp.e_marca
  ├── Marca ←→ fjdhstvta1.v_marca
  ├── Marca ←→ mv_ventas_mensual.v_marca
  └── Marca ←→ Budget_2026.Brand

Dim_maestro_comercial (dimension de SKUs)
  ├── SKU-I ←→ fjdexisemp.e_sku
  ├── SKU-I ←→ fjdhstvta1.v_sku
  └── tipo_articulo → v_inventario.tipo_articulo (JOIN en la vista)

CLIM100 (maestro de clientes)
  └── Codigo ←→ v_transacciones_dwh.codigo_cliente (probable)

fjdhstvta1 (ventas detalle)
  └── aggregated → mv_ventas_mensual (vista materializada)
```

---

## Clasificacion Funcional

### Tablas de Hechos (Fact Tables)
| Tabla | Dominio | Granularidad |
|-------|---------|-------------|
| `fjdhstvta1` | Ventas | Linea de venta (transaccion) |
| `fjdexisemp` | Inventario | SKU + Talla + Sucursal |
| `v_transacciones_dwh` | Transacciones | Transaccion (vacia) |

### Tablas de Dimension (Dimension Tables)
| Tabla | Dominio | Registros |
|-------|---------|-----------|
| `Dim_marcas` | Marcas | 22 |
| `Dim_maestro_comercial` | Productos/SKU | 511,086 |
| `fintsucu` | Sucursales | 121 |
| `CLIM100` | Clientes | 82,905 |

### Tablas de Planificacion
| Tabla | Dominio | Registros |
|-------|---------|-----------|
| `Budget_2026` | Presupuesto | 2,842 |
| `fmetasucu` | Metas sucursal | 180 |
| `Import` | Importaciones | 303 |

### Vistas / Agregados
| Vista | Tipo | Fuente |
|-------|------|--------|
| `mv_ventas_mensual` | Materializada | `fjdhstvta1` |
| `v_inventario` | Vista | `fjdexisemp` + `Dim_maestro_comercial` |
| `vw_ticket_promedio_diario` | Vista | Transacciones |

---

## Sucursales Completas (121 registros en `fintsucu`)

| Codigo PC | Codigo JD | Descripcion |
|-----------|-----------|-------------|
| 0001 | PALMA | PALMA |
| 0002 | VMORRA | C.C. Villa Morra |
| 0003 | LUQ-OUTLET | P.Vta. OUTLET Luque |
| 0004 | TOLAMB | T. O Lambare |
| 0005 | TOSUR | T. O Sur |
| 0006 | UNIFORMES | DEPOSITO UNIFORMES |
| 0007 | MAYORISTA | DEPOSITO UNIFORMES |
| 0008 | REVENTA | Alm. Compras Reventa |
| 0009 | SERVICIOS | Almac.SERVICIOS |
| 0010 | MVMORRA | Boutique Cab.MVMORRA |
| 0011 | LICITACION | Almacen d/LICITACION |
| 0012 | UTP | UNIF. TEC. PROFES. |
| 0013 | E-COMMERCE | ALMACEN E-COMMERCE |
| 0014 | CONSIGNACION | Alm. Consignacion |
| 0015 | PASEOTRINI | Martel PaseoTrinidad |
| 0016 | STOCK | Almacen PT y RV |
| 0017 | LAMBARE | Pto.Vta.Lambare |
| 0018 | LUISITO | Pto. Vta. Luisito |
| 0019 | WEB | Almacen Virtual |
| 0022 | FABRICA | Fabrica |
| 0023 | LCOOPER | JStore Lee Cooper |
| 0024 | SHOPVMORRA | SHOP. VILLA MORRA |
| 0025 | MARTELMCAL | Martel Mariscal |
| 0026 | LARURAL | La Rural |
| 0027 | SHOPSANLO | Shop.San Lorenzo |
| 0028 | LASLOMAS | Martel Las Lomas |
| 0029 | PASEOLAMB | Martel Paseo Lambare |
| 0030 | SHOPPINEDO | Martel Shop. Pinedo |
| 0031 | TOLUQ | T.O. Luque |
| 0032 | SHOPMARIANO | Shopping Mariano |
| 0033 | PASEOSANVICE | Paseo San Vicente |
| 0034 | GALERIAMART | PASEO GALERIA MARTEL |
| 0035 | GALERIAWRLEE | PASEO GALERIA WR-LEE |
| 0036 | SHOPMCAL | Shop. Mariscal Lopez |
| 0037 | SHOPFUENTE | Shop.Fuente Salemma |
| 0038-0045 | M-AGUSTIN...M-GAMARRA | Muestrarios vendedores mayoristas |
| 0046 | OTROS | Otros Canales |
| 0047 | EXPORT | Exportacion |
| 0048 | CCALIDAD | Control de Calidad |
| 0049 | VIDMORRA | Vidriera Villa Morra |
| 0050 | SANBER | San Bernardino |
| 0051 | ALM-BATAS | ALMACEN DE BATAS |
| 0052 | LUQ-DEP-OUT | Deposito OUTLET MARAM |
| 0053 | TEJIMARAMBU | Tejidos MARAMBURE |
| 0054 | RETAILS | ALM.DISTRIB. RETAILS |
| 0055 | FERIA | ALMAC. FERIA |
| 0056 | CERROALTO | Paseo CERROALTO |
| 0057 | MARTELSSL | MARTEL SHOP.S.LORENZO |
| 0058 | WRSSL | WR SHOP SAN LORENZO |
| 0059 | WRMULTIPLAZA | WR MULTIPLAZA |
| 0060-0064 | VTA-EDGAR...VTA-EMILIO | Mayoristas (ventas) |
| 0065-0105 | CO* | Consignatarios / Jeans Store |
| 0106 | LAVADO | Proc.de Lavado-Luque |
| 0107 | REPUESTOS | Almacen de Repuestos |
| 1038 | ESTRELLA | MARTEL ESTRELLA |
| 9985-9999 | (varios) | Dpto. Contable, Lavadero, MT, Show Rooms, etc. |

---

## Problemas y Observaciones

1. **BUG v_inventario:** JOIN cartesiano produce ~429K filas vs ~54K reales en fjdexisemp. No usar esta vista para calculos de inventario sin corregir el JOIN.

2. **Tipos de datos inconsistentes:** Campos monetarios en `Budget_2026` e `Import` estan como texto con formato (separadores de miles, simbolo $, %). Requieren parsing para calculos.

3. **Sin Foreign Keys formales:** Solo existe 1 PK (`CLIM100.Codigo`). No hay constraints de FK. La integridad referencial depende de la aplicacion.

4. **Tabla vacia:** `v_transacciones_dwh` tiene 0 filas — estructura preparada pero sin cargar.

5. **Datos legacy con padding:** Campos de texto en `CLIM100`, `fintsucu`, `fjdexisemp`, `fjdhstvta1` contienen espacios en blanco de relleno (herencia de sistema mainframe/AS400).

6. **Sin RPC functions** expuestas en el schema publico.

7. **Sin RLS (Row Level Security)** aparente — acceso con anon key devuelve todos los datos.

8. **Doble codificacion de sucursales:** Sistema PC (numerico 4 digitos) vs Sistema JD (texto alfanumerico). La tabla `fintsucu` es el puente entre ambos.
