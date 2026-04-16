-- ============================================================================
-- 014_config_seed_etapa5.sql
--
-- Seed de waterfall thresholds + config_store con valores actuales.
-- Complementa 013_config_seed.sql (comisiones + márgenes + depots + executive + freshness).
--
-- Ejecutar en Supabase SQL Editor (BD de la app, no la operacional).
--
-- Rollback:
--   DELETE FROM app_params WHERE domain = 'waterfall';
--   DELETE FROM config_store;
-- ============================================================================

-- ─── Waterfall thresholds (12 parámetros) ─────────────────────────────────

INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.low_stock_ratio', '0.40', 'waterfall', 'Ratio stock/avg < X = stock bajo');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.high_stock_ratio', '2.50', 'waterfall', 'Ratio stock/avg > X = sobrestock');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.min_stock_abs', '3', 'waterfall', 'Stock minimo absoluto (unidades)');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.min_avg_for_ratio', '5', 'waterfall', 'Avg minimo para usar ratio (unidades)');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.min_transfer_units', '2', 'waterfall', 'Unidades minimas por transferencia');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.pareto_target', '0.80', 'waterfall', 'Target Pareto 80/20');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.surplus_liquidate_ratio', '0.60', 'waterfall', 'Ratio de liquidacion de excedentes');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.b2c_cover_weeks', '13', 'waterfall', 'Semanas de cobertura objetivo tiendas B2C');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.min_impact_gs', '500000', 'waterfall', 'Impacto minimo en Gs. para incluir accion');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.imported_brands', '["wrangler","lee"]', 'waterfall', 'Marcas importadas (lead time largo)');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.cover_weeks_imported', '24', 'waterfall', 'Semanas cobertura marcas importadas');
INSERT INTO app_params (key, value, domain, description) VALUES ('waterfall.cover_weeks_national', '12', 'waterfall', 'Semanas cobertura marcas nacionales');

-- ─── Config store (20 tiendas retail + 21 excluidas + 3 B2B) ─────────────

-- Cluster A — tiendas premium
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('GALERIAWRLEE', 'A', 3000, 'Lun–Vie antes de las 10am', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('MARTELMCAL', 'A', 5500, 'Sin restricción (optimizar ruta)', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('SHOPMCAL', 'A', NULL, 'Lun–Vie antes 9am; luego 15–17hs', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('SHOPPINEDO', 'A', 4000, 'Lun–Vie antes 9am; luego 12–17hs', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('WRSSL', 'A', 3000, 'Lun–Vie antes 9am; luego 12–17hs', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('WRPINEDO', 'A', 3500, NULL, false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('WRMULTIPLAZA', 'A', 2000, 'Lun–Vie antes de las 9am', false, false);

-- Cluster B — tiendas standard
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('CERROALTO', 'B', 3000, 'Antes de las 10am (optimizar ruta)', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('ESTRELLA', 'B', 3000, 'Sin restricción (optimizar ruta)', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('MARTELSSL', 'B', 3300, 'Lun–Vie antes 9am; luego 12–17hs', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('SHOPMARIANO', 'B', 2500, 'Lun–Vie antes 9am; luego 12–17hs', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('TOLUQ', 'B', 5500, 'Sin restricción (optimizar ruta)', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('PASEOLAMB', 'B', NULL, NULL, false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('TOLAMB', 'B', NULL, NULL, false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('LARURAL', 'B', NULL, NULL, false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('MVMORRA', 'B', NULL, NULL, false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('SHOPFUENTE', 'B', NULL, NULL, false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('MARTELLUQUE', 'B', NULL, NULL, false, false);

-- Cluster OUT — outlets
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('TOSUR', 'OUT', 5500, 'Sin restricción (optimizar ruta)', false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('FERIA', 'OUT', NULL, NULL, false, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('LUQ-OUTLET', 'OUT', NULL, NULL, false, false);

-- B2B stores (no son parte de la red retail)
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('MAYORISTA', 'B', NULL, NULL, true, true);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('UTP', 'B', NULL, NULL, true, true);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('UNIFORMES', 'B', NULL, NULL, true, true);

-- Excluidas (depositos, fabricas, etc.)
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('STOCK', 'A', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('RETAILS', 'A', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('ALM-BATAS', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('FABRICA', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('LAMBARE', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('LAVADO', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('LUQ-DEP-OUT', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('MP', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('E-COMMERCE', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('PRODUCTO', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('SHOPSANLO', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('M-AGUSTIN', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('M-EDGAR', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('M-EMILIO', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('M-GAMARRA', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('M-JUAN', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('M-SALABERRY', 'B', NULL, NULL, true, false);
INSERT INTO config_store (store_code, cluster, assortment, time_restriction, is_excluded, is_b2b) VALUES ('M-SILVIO', 'B', NULL, NULL, true, false);
