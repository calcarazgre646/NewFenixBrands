# Centro de Acciones — Requerimientos del Cliente

**Fecha:** 2026-04-15
**Fuente:** Conversaciones WhatsApp + Email Rodrigo Aguayo (01/04–09/04/2026)
**Participantes:** Rodrigo Aguayo (Gerente Comercial), Derlys (Datos), Carlos (Dev)

---

## Origen del requerimiento

El cliente detectó una inconsistencia: el sistema recomendaba reponer un SKU con 169 días sin movimiento. Rodrigo: *"si un producto lleva 169d es ilógico que lo repongamos"*. Se acordó que el DOI debe participar en la decisión, no solo mostrarse.

---

## 1. Regla core: SKU Lifecycle por Edad × STH

### 1.1 Definición de métricas

| Métrica | Definición | Fuente de datos |
|---------|-----------|-----------------|
| **Edad** | Días desde la fecha de ingreso del SKU a la tienda, medida por **cohorte original** (no se resetea por transferencias) | `movimientos_st_jde` — primer movimiento positivo |
| **STH (Sell-Through Rate)** | Unidades vendidas / Unidades recibidas, ajustado por salidas no-venta | `movimientos_st_jde` + `fjdhstvta1` |
| **DOI (Days of Inventory)** | Cobertura estimada: `Edad × (1 - STH) / STH` | Derivado de Edad + STH |

### 1.2 Umbrales por tipo de producto (Linealidad)

Rodrigo definió 3 perfiles de producto con tolerancias distintas de STH por tramo de edad:

| Edad → | 15d | 30d | 45d | 60d | 75d | 90d |
|--------|-----|-----|-----|-----|-----|-----|
| **Carry Over** → STH mínimo | ≥ 20% | ≥ 40% | ≥ 50% | ≥ 65% | ≥ 80% | ≥ 95% |
| **Básicos** → STH mínimo | ≥ 15% | ≥ 30% | ≥ 40% | ≥ 55% | ≥ 70% | ≥ 85% |
| **Temporada / Moda** → STH mínimo | ≥ 10% | ≥ 20% | ≥ 30% | ≥ 45% | ≥ 60% | ≥ 75% |

**Clasificación de tipo de producto:**
- **Carry Over** = `carry_over = "SI"` en ERP (producto que se repite entre temporadas)
- **Básicos** = producto estándar sin flag carry over ni lanzamiento
- **Temporada / Moda** = `est_comercial = "lanzamiento"` o producto de temporada específica

### 1.3 Acciones cuando STH < Target por tramo de edad

| Tramo | Acción | Responsable |
|-------|--------|-------------|
| **15 días** | Revisar Exhibición en Tienda | Marketing B2C (Temporada: + Brand Manager) |
| **30 días** | Revisar Asignación de Tienda | Brand Manager |
| **45 días** | Acción Comercial y Marketing | Brand Manager (Temporada: + Marketing B2C) |
| **60 días** | Markdown Selectivo | Brand Manager + Gerencia Retail |
| **75 días** | Transferencia OUT + Markdown Progresivo | Brand Manager + Gerencia Retail + Operaciones + Logística |
| **90 días** | Markdown Liquidación | Gerencia Retail |

**Nota:** Las acciones son idénticas para los 3 tipos de producto. Lo que cambia es el **umbral de STH** que dispara la acción.

---

## 2. Reglas por Cluster de tienda

Rodrigo definió comportamiento diferenciado por cluster:

| Cluster | Perfil | Regla |
|---------|--------|-------|
| **A (premium)** | Prioridad novedades, mix completo, precio alto | Si SKU no rinde → primero corregir ejecución, luego evaluar pase a B |
| **B (standard)** | Absorbe SKUs con potencial que no consolidan en A | Cuidar margen y rotación |
| **OUT (outlet)** | Concentra SKUs de salida, quiebre de talla, mayor edad | Acelerar rotación |

**Implicación:** El waterfall debe considerar el cluster al recomendar transferencias. Un SKU que no rinde en A no va directo a OUT — pasa primero por B.

---

## 3. Análisis secuencial de decisión (Rodrigo, 09/04/2026)

Antes de recomendar una acción, el sistema debe seguir esta secuencia:

```
1. Revisar tallas disponibles en la tienda
2. Revisar si existen tallas en OTRAS tiendas para completar curva
3. Si HAY tallas disponibles:
   a. ¿Consolidar curva en tienda actual?
   b. ¿Mover a tienda de mejor performance para ese SKU (cuando tuvo curva completa)?
4. Si NO hay tallas:
   a. STH > promedio de la tienda → mantener hasta agotar
   b. STH < promedio de la tienda → sugerir transferencia/markdown
5. Sugerir acción de movimiento o reposición de tallas según paso 3/4
```

---

## 4. Salidas no-venta (merma, devolución, cambio)

Rodrigo definió 3 tipos de salida no-venta y su tratamiento:

| Tipo | Definición | Tratamiento |
|------|-----------|-------------|
| **Merma** | Pérdida de unidades (robo, hurto). Se detecta cuando ST(inicial) > ST(final) sin venta registrada | Unidades perdidas — no afectan STH denominador |
| **Devolución** | SKU retornado, dinero devuelto al cliente. No hay salida de otro SKU | Unidades retornadas → depósito virtual "Segunda Mano" |
| **Cambio** | SKU retornado, otro SKU entregado en reemplazo | Unidades retornadas → depósito virtual "Segunda Mano" |

**Regla:** Devoluciones y cambios generan reingreso de unidades que **no pueden ser vendidas en tienda** (asumimos que se abrió, quitaron etiquetas). Van a un depósito virtual de "Segunda Mano" en el dashboard (no en el ERP).

---

## 5. Tramos de análisis por perfil de usuario

| Perfil | Tramos de DOI | Uso |
|--------|---------------|-----|
| **Gerencia de Producto / Brand Managers** | 15 días (0-15, 16-30, 31-45, ..., 90+) | Análisis granular por SKU |
| **Gerencia Comercial Retail** | 45 días (0-45, 46-90, 90+) | Vista ejecutiva agregada |

---

## 6. Reglas de negocio confirmadas (Q&A 09/04/2026)

### P1: Exit obligatorio con STH alto
**R:** Se debe realizar el análisis secuencial (sección 3) antes de definir acción. Un STH alto con pocas unidades puede mantenerse hasta agotar.

### P2: Edad post-transferencia A→B
**R:** La edad se conserva del **cohorte original**, independiente de los movimientos posteriores.

### P3: Salidas no-venta
**R:** Ver sección 4. Merma = pérdida. Devolución/cambio = reingreso a depósito virtual "Segunda Mano".

### P4: Umbrales por tipo de marca (importada vs nacional)
**R:** Se estandarizaron por **tipo de producto** (Carry Over / Básicos / Temporada), no por marca. Ver tabla sección 1.2.

### P5: Quiebre de talla
**R:** Seguir análisis secuencial (sección 3). Primero intentar completar curva, luego evaluar transferencia/markdown según STH vs promedio.

### P6: Acción "corregir exhibición"
**R:** Genera una acción asignada a un usuario específico según la tabla de responsables (sección 1.3), siguiendo la lógica del perfil de usuario (sección 5).

---

## 7. Datos nuevos de Derlys (06/04/2026)

### 7.1 Capacidades de tienda por tipo de artículo
Derlys cargó una tabla con capacidades de tiendas. La columna `tipo_articulo` agrupa cantidades directamente, **excepto** cuando dice "camisa/vaquero" que se divide 50/50.

**Nota:** Esta tabla no está completa — faltan algunas tiendas por relevar. El join es por `codigo_tienda` con la tabla de maestro de sucursales.

### 7.2 Mueble mixto
Cuando una tienda tiene un mueble tipo "camisa/vaquero", la capacidad total se reparte 50/50 entre ambos tipos de artículo.

---

## 8. Acciones constantes (siempre activas)

Rodrigo definió 3 análisis que corren permanentemente, independiente del tramo de edad:

| Análisis | Qué hace | Responsable |
|----------|----------|-------------|
| **Reposición de tallas** | Detectar %OOS (Out of Stock) por SKU → sugerir reposición para curva completa | Brand Manager + Operaciones + Logística |
| **Asignación de tienda** | Medir STH × SKU por tienda vs promedio de la red → sugerir movimiento a tienda de mejor STH | Brand Manager + Operaciones + Logística |
| **Cobertura de ventas (DOI)** | DOI ≈ Edad × (1 - STH) / STH → alertar cobertura insuficiente | Brand Manager |

---

## 9. Resumen de lo que se necesita construir

| # | Componente | Complejidad | Dependencia |
|---|-----------|-------------|-------------|
| 1 | **STH por cohorte** (cálculo desde movimientos_st_jde) | Alta | Nueva MV o query compleja |
| 2 | **Clasificación de producto** (Carry Over / Básicos / Temporada) | Baja | Pasar `est_comercial` + `carry_over` al domain |
| 3 | **Tabla de linealidad** (edad × STH × tipo → acción) | Media | Config parametrizable |
| 4 | **Análisis de curva de tallas** (%OOS por SKU en tienda) | Media | Cruzar stock actual vs tallas históricas |
| 5 | **Integración DOI en waterfall** (filtrar SKUs muertos) | Media | Modificar `computeActionQueue` |
| 6 | **Flujo A→B→OUT por cluster** | Media | Modificar lógica N1 del waterfall |
| 7 | **Acciones con responsable** | Baja | Nuevo tipo + lookup table |
| 8 | **Depósito virtual "Segunda Mano"** | Baja | Derivado de salidas no-venta |
| 9 | **Vista por perfil** (tramos 15d vs 45d) | Baja | Filtro UI |
| 10 | **Persistencia de acciones** (asignación a usuario) | Media | Extender `decision_actions` |
