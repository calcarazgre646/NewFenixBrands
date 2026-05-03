# Lifecycle — Features Evaluadas y Pendientes

**Fecha:** 2026-04-16
**Contexto:** Post-implementacion de lifecycle SKU. El motor de decisiones funciona. Estas features suben el nivel del producto hacia estandares enterprise (Oracle Retail, SAP, JDA/Blue Yonder).

---

## Features priorizadas

### F1 — Workflow de Aprobacion (RECOMENDADO PRIMERO)

**Que es:** Las acciones recomendadas pasan por un flujo de aprobacion antes de ejecutarse. Gerencia revisa, aprueba o rechaza. Se registra quien aprobo que y cuando.

**Por que importa:** Sin esto, las recomendaciones son sugerencias que nadie trackea. No sabemos si se ejecutaron, quien decidio, ni por que se rechazo una accion. Es el feature que convierte el sistema de "dashboard informativo" a "herramienta operativa".

**Implementacion:**
- Campo `status: pending | approved | rejected | executed` en cada accion (nueva tabla `action_decisions`)
- Vista "Bandeja de aprobacion" para gerencia: "55 acciones pendientes"
- Boton aprobar/rechazar con motivo opcional
- Log de auditoria: quien, cuando, que accion, que decision
- Notificacion al responsable cuando su accion fue aprobada

**Prerequisitos:** Ninguno. Roles y usuarios ya existen.
**Dificultad:** Baja
**Estimacion:** 1-2 sesiones
**Impacto:** Alto

---

### F1.5 — Workflow de Aprobación de Markdown (Fase 2 del ticket "Carga de markdown por SKU")

**Que es:** Sub-caso especifico de F1 aplicado solo al markdown manual cargado en `/precios`. El solicitante (gerencia / brand manager) carga un descuento; el Gte Comercial recibe email + bandeja de aprobacion en la app; aprueba o rechaza con comentario; al aprobar el markdown se aplica al precio efectivo.

**Estado:** Fase 1 entregada (PR #55, 04/05/2026) — markdown manual ya se aplica directo. Fase 2 **bloqueada por definiciones de proceso del cliente** (ver `docs/PENDING_CLIENT.md` → "Workflow de aprobación de markdown"):
1. Quien solicita / quien aprueba / backups / SLA
2. Vigencia obligatoria o configurable
3. ¿Aplica también a PVM mayorista?
4. ¿Conexión con recomendaciones de markdown del lifecycle (`/acciones`)?

**Implementación (cuando se desbloquee):**
- Status `pending_approval` antes de `is_active=true` (ya reservado en columna `status` de `sku_markdowns`)
- Edge Function existente `send-email` (Resend) → notificación al Gte Comercial
- Bandeja de aprobación: nueva ruta o tab dentro de `/precios` con lista de pendientes + botones aprobar/rechazar + comentario
- Auto-expiración por `valid_until` vencido (cron Supabase o trigger)
- Métricas: tiempos de respuesta, % aprobados, markdown promedio aprobado

**Prerequisitos:** Definiciones del cliente (4 preguntas en `PENDING_CLIENT.md`).
**Dificultad:** Baja (infra ya está)
**Estimación:** 1 sprint (5 días)
**Impacto:** Alto — cierra el ciclo de control de precios

---

### F2 — Dashboard de Resultados (RECOMENDADO SEGUNDO)

**Que es:** Panel que mide si las recomendaciones del motor realmente mejoran el negocio. Compara el estado del inventario antes y despues de ejecutar acciones.

**Por que importa:** Sin medicion, no sabemos si el motor funciona. Es la diferencia entre "creemos que funciona" y "los numeros muestran que funciona".

**5 metricas clave:**

| # | Metrica | Que mide | Target |
|---|---------|----------|--------|
| 1 | Tasa de ejecucion | % de acciones recomendadas que se hicieron | >80% |
| 2 | Dias promedio de inventario | Edad promedio del stock en tiendas | Bajar mes a mes |
| 3 | SKUs en 90d+ sin accion | Productos viejos sin intervencion | Tender a 0 |
| 4 | Cobertura promedio (WOI) | Semanas de stock vs target 13 sem | Acercarse al target |
| 5 | Ventas post-movimiento | El SKU movido de A a B, vendio mejor en B? | >50% mejora |

**Implementacion:**
- Snapshot semanal del estado del inventario (tabla `inventory_snapshots`)
- Comparacion antes/despues por SKU movido
- Cards de tendencia mes a mes
- Drill-down por tienda/marca/tipo

**Prerequisitos:** F1 (para saber que se ejecuto)
**Dificultad:** Media
**Estimacion:** 2-3 sesiones
**Impacto:** Alto

---

### F3 — Simulacion What-If

**Que es:** Antes de aprobar acciones, el gerente ve una proyeccion: "si ejecuto estas 50 acciones, asi queda el inventario en 30 dias". Preview del impacto sin mover nada.

**Por que importa:** Reduce el riesgo de decisiones incorrectas. El gerente puede ver si una transferencia masiva deja una tienda sin stock o si un markdown agresivo impacta el margen.

**Implementacion:**
- Tomar inventario actual + acciones seleccionadas
- Simular el estado futuro: restar de origen, sumar a destino
- Proyectar ventas esperadas con historial
- Mostrar metricas proyectadas vs actuales (WOI, cobertura, valor)
- Comparador visual: "Hoy" vs "Post-acciones"

**Prerequisitos:** F1 (necesita saber que acciones se seleccionan)
**Dificultad:** Media
**Estimacion:** 1-2 sesiones
**Impacto:** Medio

---

### F4 — ML Demand Forecasting

**Que es:** Reemplazar el promedio de 6 meses por un modelo de prediccion de demanda que considere estacionalidad, tendencia, y eventos.

**Por que importa:** El promedio de 6 meses no captura estacionalidad. Un producto de invierno tiene demanda alta en mayo-agosto y baja en diciembre-febrero. El promedio los mezcla y genera targets incorrectos.

**Implementacion:**
- Descomposicion estacional con datos de `mv_ventas_12m_por_tienda_sku` (12 meses disponibles)
- Modelo minimo: Holt-Winters o STL decomposition
- Calculo en Edge Function (Python/Deno) o pre-computado en MV
- El waterfall recibe `expectedDemand[month]` en vez de `avgSalesPerMonth`
- Permite targets dinamicos: "en julio este SKU necesita 20u, en enero solo 5u"

**Datos disponibles:** `mv_ventas_12m_por_tienda_sku` tiene 12 meses de ventas por tienda x SKU. Suficiente para estacionalidad basica.

**Prerequisitos:** F2 (para medir si el forecasting mejora vs el promedio)
**Dificultad:** Alta
**Estimacion:** 3-5 sesiones
**Impacto:** Alto (mejora calidad de TODAS las recomendaciones)

---

### F5 — Integracion Real-Time con ERP

**Que es:** Reducir el delay entre un movimiento en el ERP y su reflejo en el dashboard de 30 minutos a near-real-time.

**Por que importa:** Con 30 minutos de cache, alguien puede mover stock que el sistema ya recomendo mover. Genera acciones duplicadas o sobre inventario que ya no existe.

**Implementacion:**
- Depende de las capacidades del ERP de Fenix (JDE)
- Opcion A: Webhook del ERP cuando hay movimiento -> Supabase Edge Function actualiza MVs
- Opcion B: Polling cada 5 minutos en vez de 30
- Opcion C: Supabase Realtime sobre las tablas raw

**Prerequisitos:** Cooperacion de Fenix IT para exponer datos o webhooks
**Dificultad:** Alta (depende del ERP, no solo de nosotros)
**Estimacion:** Variable
**Impacto:** Medio

---

### F6 — Optimizacion Multi-Objetivo

**Que es:** En vez de "mover stock de A a B porque B tiene espacio", optimizar considerando multiples variables simultaneamente: costo logistico, potencial de venta, capacidad, margen, prioridad de marca.

**Por que importa:** Actualmente el motor toma decisiones locales (SKU por SKU). Un optimizador global podria decir "es mejor mover estos 10 SKUs juntos a la misma tienda porque se reduce el costo de transporte".

**Implementacion:**
- Formulacion como problema de programacion lineal (LP) o mixta (MIP)
- Funcion objetivo: maximizar ventas esperadas - costo logistico
- Restricciones: capacidad de tiendas, presupuesto logistico, minimos por marca
- Solver: or-tools (Google), HiGHS, o servicio cloud
- Reemplaza el waterfall iterativo por una solucion optima global

**Prerequisitos:** F4 (demand forecast), F2 (medicion), datos de costos logisticos
**Dificultad:** Muy alta (investigacion operativa)
**Estimacion:** 5+ sesiones + expertise OR
**Impacto:** Alto pero requiere escala para justificar la complejidad

---

## Orden recomendado de implementacion

```
F1 (Workflow) ──→ F2 (Dashboard Resultados) ──→ F3 (What-If)
                                                      │
                                                      ▼
                                              F4 (ML Forecast)
                                                      │
                                                      ▼
                                    F5 (Real-Time) + F6 (Multi-Objetivo)
```

F1 y F2 son foundation — sin ellos no podemos medir ni controlar nada.
F3 y F4 son intelligence — mejoran la calidad de las decisiones.
F5 y F6 son enterprise-grade — justifican si el negocio crece.

---

## Que medir para evaluar resultados (2-3 meses post-produccion)

### Si los resultados son buenos

| Metrica | Que buscar mejorar |
|---------|-------------------|
| Stock muerto bajo 30% | Subir target a 50%. Ajustar thresholds de linealidad. |
| Stockouts bajaron | Mejorar prediccion de demanda (F4). |
| Rotacion mejoro | Optimizar curva de tallas mas agresivamente. |
| Ejecucion alta (>80%) | El equipo confia — momento de agregar what-if (F3). |

### Si los resultados son malos

| Metrica | Que investigar |
|---------|----------------|
| Acciones no se ejecutan (<30%) | Demasiadas? Mal priorizadas? Falta workflow (F1)? |
| Stock sigue envejeciendo | Recomendaciones correctas pero nadie las hace? O incorrectas? |
| Tiendas desbordadas | Capacidades mal relevadas? Check de Derlys incompleto (15 tiendas faltan). |
| Transferencias generan caos | Acciones circulares? Demasiadas para logistica? Falta batch/agrupacion. |
| Markdown no impacta ventas | Descuentos insuficientes? Timing incorrecto? Falta F4 (estacionalidad). |

### La prueba definitiva

**Ventas post-movimiento:** Si movemos un SKU de tienda A a tienda B y vende mejor en B, el motor funciona. Si no vende, estamos moviendo cajas sin impacto. Esta metrica requiere F2 para medirla.
