# Tickets pendientes (Rodrigo · marketing session 27/03/2026)

## 🟡 Sentry DSN — infra lista, falta configuración manual

**Estado:** Código 100% listo. Solo requiere setup en Sentry + Vercel.

**Código ya deployado:**
- `src/lib/sentry.ts` — `initSentry()` con `enabled: import.meta.env.PROD`
- `src/main.tsx:17` — invocado antes del render
- `package.json` — `@sentry/react` instalado
- `.env.example` — `VITE_SENTRY_DSN=` documentada

**Pasos manuales (Carlos):**

1. **Crear proyecto en Sentry** → https://sentry.io → New Project → React → nombre `newfenixbrands` → copiar DSN (formato `https://xxxxxxx@oXXX.ingest.sentry.io/YYYYYY`)

2. **Agregar env var en Vercel:**
   - Dashboard → proyecto `fenix-brands` → Settings → Environment Variables
   - Name: `VITE_SENTRY_DSN`
   - Value: DSN copiado en paso 1
   - Environments: marcar solo **Production**

3. **Redeploy:** `vercel --prod` desde `/Users/prueba/Downloads/NewFenixBrands`

4. **Verificar:** DevTools → Console → `throw new Error("test-sentry")`. Aparece en Sentry dashboard en ~30s.

---

## 🟡 Ticket 4 (scope extendido) — filtros consistentes para Customers/Triggers

**Estado:** v1 desplegada (PR #22) — Inventario y Productos filtran por canal/marca/período. Customers y Triggers son cross-channel.

**Si Rodrigo quiere que triggers y customers también filtren por canal:**

1. Agregar columna `primary_channel` en `sam_customers` (cruzando RUCs con `maestro_clientes_mayoristas` → B2B si existe, B2C si no)
2. Migration SQL: `023_sam_primary_channel.sql` (ALTER TABLE + UPDATE + idx)
3. Actualizar ETL (`useCustomerETL.ts`) para setear el campo al sincronizar
4. Propagar filter en `fetchSamCustomers`, `fetchSamCustomerCount`, `fetchMarketingDashboardMetrics`, `fetchTriggerInsights`
5. `useMarketingDashboard` y `useTriggerDryRun` leen `filters.channel`

Estimado: 1-2h después de decisión de Rodrigo.

---

## 🟡 Ticket 3 — Inteligencia comercial en cada tarjeta (en progreso)

**Pedido Rodrigo:** "Te recomiendo XX producto a XX clientes. Sugerencias automáticas dentro de cada acción CRM. Depende de CRM + PIM."

**v1 planificada:** función pura `recommendForTrigger(trigger, inventory, products)` con reglas por categoría de trigger. UI integrada en TriggerList como card de recomendación.
