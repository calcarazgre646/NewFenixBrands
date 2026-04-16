# Prompt para sesión 2026-04-16

Copiar y pegar al iniciar Claude Code en `/Users/prueba/Downloads/NewFenixBrands`:

---

Hay un bug abierto de margen bruto. Leé `docs/BUG_MARGEN_BRUTO_2026-04-15.md` para contexto completo. Resumen: `v_valor` en `fjdhstvta1` viene en 0 desde el ERP (JDE) para ~97% de las filas, lo que hace que el margen bruto muestre ~95% en vez de ~40-55%. Derlys confirmó que es problema de la fuente y avisó a Benicio.

Tu primera tarea: corré `node scripts/diagnose-margin.mjs` para verificar si Benicio ya corrigió los datos. Si `v_valor` sigue en 0, avisame y evaluamos implementar el fallback con costos de inventario. Si ya tiene datos, hacé el REFRESH de las vistas materializadas y verificá que el margen sea razonable (~40-55%).
