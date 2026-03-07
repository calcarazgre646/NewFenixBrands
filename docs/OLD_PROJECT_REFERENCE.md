# Proyecto Viejo — Guía de Referencia

## Ruta

```
/Users/prueba/Downloads/FenixBrands
```

## Para qué sirve como referencia

El proyecto viejo es útil para entender **qué mostrar** (UI, business rules, thresholds).
NO sirve como referencia de **cómo hacerlo** (arquitectura, queries, estado).

### ✅ Usar el viejo para:

1. **Diseño visual de componentes** — cómo se ven las cards KPI, qué info muestran
2. **Lógica de negocio específica del cliente** — thresholds, reglas no documentadas
3. **Nombres de columnas del ERP** — si una query nueva necesita campos no usados aún
4. **Entender qué KPIs son importantes** para el usuario (Rodrigo/Derlys)

### ❌ NO copiar del viejo:

- Queries Supabase dentro de componentes (`useEffect + useState`)
- Funciones `resolveActiveMonths`, `getActiveMonths` o similares → usar `resolvePeriod()`
- Manejo de fechas ad-hoc → usar `domain/period/helpers.ts`
- Normalización de marcas inline → usar `normalizeBrand()` de `api/normalize.ts`
- `type Row = any` en componentes → ya está resuelto en queries/

---

## Estructura del viejo (para navegar rápido)

```
FenixBrands/src/
  components/
    Dashboard/        — Los KPI cards del dashboard principal
    Ventas/           — Página de ventas
    Inventario/       — Página de inventario / Cola de acciones
    Logistica/        — Página de logística
  hooks/              — Hooks mezclados con queries Supabase
  utils/              — Funciones de formateo y helpers
  lib/supabase.ts     — Cliente Supabase (una sola instancia en el viejo)
```

---

## Bugs conocidos del viejo que NO heredar

### 1. JOIN cartesiano en v_inventario
La vista `v_inventario` hace un JOIN sin condición de talla → multiplica filas.
**429K filas vs 54K reales.**
Fix: usar `fjdexisemp` directamente (ya implementado en `inventory.queries.ts`).

### 2. Mes actual determinado por BD
El viejo usaba el máximo mes con datos en BD para determinar el mes actual.
→ Cuando el ETL cargó datos de Marzo 1, la app creyó que era Marzo.
Fix: `getCalendarMonth()` siempre usa `new Date()` (ya implementado en `period/helpers.ts`).

### 3. LfL con períodos asimétricos
El viejo comparaba el mes actual completo del año anterior vs datos parciales del mes actual.
Fix: usar `closedMonths` de `resolvePeriod()` para YoY simétrico.

### 4. CLIM100 con 82.905 clientes sin uso
Hay una tabla de clientes nueva. Sin implementar en ninguno de los dos proyectos aún.

### 5. Budget hardcodeado a 2026
La tabla `Budget_2026` tiene el nombre del año en el nombre. En 2027 habrá que crear `Budget_2027` o una vista genérica `Budget`.

---

## Contexto de negocio (del viejo)

### La empresa
- **FenixBrands / Ultrathing** — distribuidora de ropa en Paraguay
- **Marcas:** Martel (nacional), Wrangler (importada, 180d lead time), Lee (importada, 180d)
- **Canales:** B2C (tiendas propias ~25), B2B (mayorista: MAYORISTA, UTP)
- **Tiendas excluidas del análisis:** ALM-BATAS, FABRICA, LAMBARE, LAVADO, LUQ-DEP-OUT, MP

### Usuarios principales
- **Rodrigo** — dueño, quiere KPIs ejecutivos y análisis estratégico
- **Derlys** — operaciones, quiere cola de acciones de inventario y logística

### Períodos típicos de análisis
- **YTD** (año a la fecha): meses cerrados desde Enero
- **Último mes cerrado**: el mes anterior completo
- **Mes actual**: datos parciales del ETL

### Moneda
- Los montos en la BD están en **Guaraníes (Gs. / PYG)**
- Algunos campos de logística están en **USD**
- Formateo: `₲ 6.263.380` (sin decimales, punto como separador de miles en Paraguay)

### Thresholds KPI (del viejo, a confirmar con cliente)
- Margen bruto saludable B2C: > 45%
- Dependencia de ofertas alarmante: > 35%
- Tasa de devoluciones alarmante: > 5%
- GMROI saludable: > 2.0x
- Rotación saludable: > 3x anualizado
