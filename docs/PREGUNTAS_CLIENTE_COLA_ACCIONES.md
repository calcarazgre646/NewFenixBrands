# Preguntas para Rodrigo/Derlys — Cola de Acciones

Hola! Estamos mejorando la Cola de Acciones para que sea más útil y operativa. Necesitamos confirmar algunos puntos antes de avanzar:

---

**1. Tiendas sin clasificar**

Tenemos 8 tiendas en el sistema que NO aparecen en la tabla de clusterización que nos pasaron. Necesitamos saber su cluster (A/B/OUT) y capacidad en unidades:

- PASEOLAMB
- TOLAMB
- SHOPSANLO
- LARURAL
- MVMORRA
- SHOPFUENTE
- FERIA
- LUQ-OUTLET

¿Están activas? ¿Qué cluster les corresponde? ¿Cuántas unidades de assortment tienen?

---

**2. Umbral mínimo de impacto**

El sistema genera acciones para CUALQUIER desbalance, incluso mover 1-2 unidades de algo barato. Queremos filtrar acciones de muy bajo impacto. ¿Les parece bien un mínimo de Gs. 500,000 (~$70 USD) para que una acción aparezca?

---

**3. Vista principal**

Vamos a agregar vista agrupada. ¿Cuál prefieren como vista por defecto?
- A) Por Tienda (cada tienda con sus acciones)
- B) Por Marca (Wrangler, Martel, Lee)
- C) Por Categoría (Camisas, Vaqueros, etc.)

---

**4. Modelo SISO del Excel**

El Excel SISO tiene proyecciones mensuales de stock por marca/canal. ¿Quieren que el sistema use esos targets para priorizar acciones? ¿O el SISO es solo un ejercicio de planificación?

---

**5. Envío de acciones por tienda**

¿Quieren poder seleccionar acciones y enviar un listado a cada encargado de tienda? Si sí, ¿por email o WhatsApp?

---

Mientras tanto ya estamos avanzando con:
- Filtrar ruido (acciones de bajo impacto)
- Mostrar solo Pareto por defecto (las acciones que suman 80% del impacto)
- Corregir datos de tiendas/horarios

---

## Preguntas adicionales (post-auditoría 08/03/2026 17:11)

**6. Carry-over (temporada anterior)**

Los items de temporada anterior (`carry_over = "SI"` en la BD) se tratan exactamente igual que items de temporada nueva en el algoritmo. ¿Deberían tener umbrales de liquidación más agresivos? ¿Markdown automático? ¿Menor cobertura objetivo?

---

**7. Precio mayorista en modo B2B**

El cálculo de impacto financiero en B2B usa precio retail (`price`), no precio mayorista (`price_may`). Esto puede distorsionar la priorización de acciones B2B. ¿Debería usarse `price_may` para calcular el impacto en modo B2B?

---

**8. Tipo 1/2 por campo BD vs por marca**

Actualmente determinamos "tipo 1 (nacional, 12 sem)" o "tipo 2 (importado, 24 sem)" basándonos en la marca: Martel = nacional, Wrangler/Lee = importado. Si algún producto de Martel fuera importado, tendría cobertura incorrecta (12 sem en vez de 24). ¿Existe o debería existir un campo `tipo_producto` a nivel de SKU en la base de datos para clasificación más granular?

---

**9. Mínimo de unidades por transferencia**

Cuando una tienda necesita stock, el sistema busca en todas las tiendas con excedente (priorizando las que más tienen). Actualmente descarta fuentes que aportan menos de 2 unidades para evitar ruido logístico. ¿2 unidades es un mínimo razonable? ¿O prefieren que incluso 1 unidad se sugiera si es un producto caro/crítico?

---

## Notas técnicas para Derlys (post-auditoría 08/03/2026 18:54)

**10. Refresh de materialized views**

El dashboard lee de materialized views (`mv_stock_tienda`, `mv_ventas_12m_por_tienda_sku`, `mv_ventas_mensual`). Estas NO se actualizan automáticamente cuando cambian las tablas raw del ERP (`fjdexisemp`, `fjdhstvta1`). Necesitamos confirmar:

- ¿Tienen un cron o proceso que ejecute `REFRESH MATERIALIZED VIEW` periódicamente?
- ¿Con qué frecuencia se actualizan? ¿Diaria? ¿Manual?
- Si es manual, ¿quién lo hace y cuándo?

Sin refresh periódico, el dashboard muestra datos desactualizados aunque el ERP ya tenga datos nuevos.

---

**11. Tiendas con 0 unidades en BD**

Las siguientes tiendas aparecen en la tabla de clusterización pero tienen **0 unidades** en `mv_stock_tienda`:

- MARTELSSL (capacidad: 3,300)
- WRMULTIPLAZA (capacidad: 2,000)
- WRPINEDO (capacidad: 3,500)
- WRSSL (capacidad: 3,000)
- FERIA, LARURAL, LUQ-OUTLET, MVMORRA, SHOPFUENTE (sin capacidad definida)

¿Están cerradas? ¿Usan códigos diferentes en el ERP? ¿O la materialized view no las incluye? Necesitamos saber para no mostrar datos incorrectos.

---

**12. Tiendas con sobrestock extremo**

Detectamos tiendas con stock muy por encima de su capacidad de assortment:

- TOLUQ: 9,320 u. vs capacidad 5,500 (170%)
- TOSUR: 7,859 u. vs capacidad 5,500 (143%)
- ESTRELLA: 3,646 u. vs capacidad 3,000 (122%)
- MARTELMCAL: 6,291 u. vs capacidad 5,500 (114%)

¿Las capacidades que nos pasaron están actualizadas? ¿O estas tiendas realmente están sobre-cargadas y necesitan redistribución?
