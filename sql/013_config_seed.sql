-- ============================================================================
-- 013_config_seed.sql
--
-- Seed inicial de las tablas de configuración con los valores actuales.
-- Ejecutado en producción el 04/04/2026. Verificado OK.
--
-- IMPORTANTE: Cada INSERT en una sola línea — el SQL Editor de Supabase
-- introduce saltos de línea invisibles en strings multilínea que rompen JSON.
-- maxPct = null representa Infinity (último tramo de comisión).
--
-- Rollback: DELETE FROM config_commission_scale; DELETE FROM app_params;
-- ============================================================================

-- ─── Escalas de comisión (8 roles) ─────────────────────────────────────────

INSERT INTO config_commission_scale (role, channel, type, label, tiers) VALUES ('vendedor_mayorista', 'mayorista', 'percentage', 'Vendedor Mayorista', '[{"minPct":0,"maxPct":70,"value":0},{"minPct":70,"maxPct":80,"value":0.85},{"minPct":80,"maxPct":90,"value":0.95},{"minPct":90,"maxPct":100,"value":1.05},{"minPct":100,"maxPct":110,"value":1.15},{"minPct":110,"maxPct":120,"value":1.25},{"minPct":120,"maxPct":null,"value":1.35}]');
INSERT INTO config_commission_scale (role, channel, type, label, tiers) VALUES ('vendedor_utp', 'utp', 'percentage', 'Vendedor UTP', '[{"minPct":0,"maxPct":80,"value":0},{"minPct":80,"maxPct":90,"value":0.12},{"minPct":90,"maxPct":100,"value":0.15},{"minPct":100,"maxPct":110,"value":0.17},{"minPct":110,"maxPct":120,"value":0.20},{"minPct":120,"maxPct":null,"value":0.23}]');
INSERT INTO config_commission_scale (role, channel, type, label, tiers) VALUES ('backoffice_utp', 'utp', 'percentage', 'Back Office UTP', '[{"minPct":0,"maxPct":80,"value":0},{"minPct":80,"maxPct":90,"value":0.24},{"minPct":90,"maxPct":100,"value":0.30},{"minPct":100,"maxPct":110,"value":0.34},{"minPct":110,"maxPct":120,"value":0.40},{"minPct":120,"maxPct":null,"value":0.46}]');
INSERT INTO config_commission_scale (role, channel, type, label, tiers) VALUES ('gerencia_mayorista', 'mayorista', 'percentage', 'Gerencia Mayorista', '[{"minPct":0,"maxPct":80,"value":0},{"minPct":80,"maxPct":90,"value":0.17},{"minPct":90,"maxPct":100,"value":0.20},{"minPct":100,"maxPct":110,"value":0.23},{"minPct":110,"maxPct":120,"value":0.26},{"minPct":120,"maxPct":null,"value":0.29}]');
INSERT INTO config_commission_scale (role, channel, type, label, tiers) VALUES ('gerencia_utp', 'utp', 'percentage', 'Líder UTP', '[{"minPct":0,"maxPct":80,"value":0},{"minPct":80,"maxPct":90,"value":1.00},{"minPct":90,"maxPct":100,"value":1.30},{"minPct":100,"maxPct":110,"value":1.60},{"minPct":110,"maxPct":120,"value":1.90},{"minPct":120,"maxPct":null,"value":2.20}]');
INSERT INTO config_commission_scale (role, channel, type, label, tiers) VALUES ('vendedor_tienda', 'retail', 'percentage', 'Vendedor Tienda', '[{"minPct":0,"maxPct":70,"value":0},{"minPct":70,"maxPct":80,"value":0.85},{"minPct":80,"maxPct":90,"value":0.95},{"minPct":90,"maxPct":100,"value":1.05},{"minPct":100,"maxPct":110,"value":1.15},{"minPct":110,"maxPct":120,"value":1.25},{"minPct":120,"maxPct":null,"value":1.35}]');
INSERT INTO config_commission_scale (role, channel, type, label, tiers) VALUES ('supervisor_tienda', 'retail', 'fixed', 'Supervisor Tienda', '[{"minPct":0,"maxPct":100,"value":0},{"minPct":100,"maxPct":110,"value":600000},{"minPct":110,"maxPct":120,"value":700000},{"minPct":120,"maxPct":null,"value":800000}]');
INSERT INTO config_commission_scale (role, channel, type, label, tiers) VALUES ('gerencia_retail', 'retail', 'percentage', 'Gerencia Retail', '[{"minPct":0,"maxPct":80,"value":0},{"minPct":80,"maxPct":90,"value":0.17},{"minPct":90,"maxPct":100,"value":0.20},{"minPct":100,"maxPct":110,"value":0.23},{"minPct":110,"maxPct":120,"value":0.26},{"minPct":120,"maxPct":null,"value":0.29}]');

-- ─── App params ────────────────────────────────────────────────────────────

INSERT INTO app_params (key, value, domain, description) VALUES ('margin.b2c_healthy', '55', 'kpis', 'Margen bruto saludable B2C/Total (%)');
INSERT INTO app_params (key, value, domain, description) VALUES ('margin.b2c_moderate', '50', 'kpis', 'Margen bruto moderado B2C/Total (%)');
INSERT INTO app_params (key, value, domain, description) VALUES ('margin.b2b_healthy', '50', 'kpis', 'Margen bruto saludable B2B (%)');
INSERT INTO app_params (key, value, domain, description) VALUES ('margin.b2b_moderate', '40', 'kpis', 'Margen bruto moderado B2B (%)');
INSERT INTO app_params (key, value, domain, description) VALUES ('depots.critical_weeks', '4', 'depots', 'WOI < X semanas = riesgo critico');
INSERT INTO app_params (key, value, domain, description) VALUES ('depots.low_weeks', '8', 'depots', 'WOI < X semanas = riesgo bajo');
INSERT INTO app_params (key, value, domain, description) VALUES ('depots.high_weeks', '16', 'depots', 'WOI > X semanas = sobrestock');
INSERT INTO app_params (key, value, domain, description) VALUES ('depots.history_months', '6', 'depots', 'Meses de historial para promedios');
INSERT INTO app_params (key, value, domain, description) VALUES ('depots.novelty_coverage', '0.80', 'depots', 'Cobertura >= X = producto cargado en tiendas');
INSERT INTO app_params (key, value, domain, description) VALUES ('executive.annual_target_fallback', '70000000000', 'executive', 'Meta anual fallback si no hay datos (Gs.)');
INSERT INTO app_params (key, value, domain, description) VALUES ('executive.ly_budget_factor', '0.90', 'executive', 'Factor PY cuando falta dato real (90% del budget)');
INSERT INTO app_params (key, value, domain, description) VALUES ('freshness.config', '{"sourceThresholds":{"mv_ventas_mensual":{"staleMinutes":90,"riskMinutes":180},"mv_ventas_diarias":{"staleMinutes":90,"riskMinutes":180},"mv_ventas_12m_por_tienda_sku":{"staleMinutes":90,"riskMinutes":180},"mv_stock_tienda":{"staleMinutes":90,"riskMinutes":180},"mv_doi_edad":{"staleMinutes":120,"riskMinutes":360}},"defaultThresholds":{"staleMinutes":120,"riskMinutes":360}}', 'freshness', 'Umbrales de frescura de datos por MV');
