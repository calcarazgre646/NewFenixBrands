-- ============================================================================
-- 026_event_allocation_run_type.sql
--
-- Habilita el run_type 'event_allocation' en decision_runs para que las
-- propuestas de allocation aprobadas (Fase B Event Operational App) puedan
-- persistir sus líneas como decision_actions y cerrar el closed-loop
-- (Palantir-style decision-as-data).
--
-- Ejecutar en la instancia AUTH (uxtzzcjimvapjpkeruwb).
-- ============================================================================

ALTER TABLE public.decision_runs
  DROP CONSTRAINT IF EXISTS decision_runs_run_type_check;

ALTER TABLE public.decision_runs
  ADD CONSTRAINT decision_runs_run_type_check
  CHECK (run_type IN ('waterfall', 'purchase_planning', 'commissions', 'event_allocation'));

COMMENT ON COLUMN public.decision_runs.run_type IS
  'Tipo de corrida: waterfall (cola de acciones), purchase_planning (compra), commissions (cálculo de comisiones), event_allocation (allocation aprobada de un evento del calendario).';
