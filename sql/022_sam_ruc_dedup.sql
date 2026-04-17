-- ============================================================================
-- 010_sam_ruc_dedup.sql
--
-- Cambia la clave de dedup de sam_customers de erp_code a ruc.
--
-- ANTES: cada fila de CLIM100 (Codigo) = un "cliente" → 82K inflados
-- DESPUES: cada RUC unico = un cliente real → ~20-30K reales
--
-- Pasos:
-- 1. Agregar columna code_count
-- 2. Limpiar filas existentes (truncar, re-import via ETL)
-- 3. Quitar UNIQUE de erp_code
-- 4. Agregar UNIQUE a ruc (NOT NULL)
-- 5. Indice en ruc
-- ============================================================================

-- 1. Nueva columna: cuantos codigos ERP tiene este RUC
ALTER TABLE sam_customers ADD COLUMN IF NOT EXISTS code_count INTEGER NOT NULL DEFAULT 1;

-- 2. Truncar datos existentes (estaban mal keyed, el ETL los va a reimportar)
TRUNCATE sam_customers CASCADE;

-- 3. Quitar constraint UNIQUE en erp_code
ALTER TABLE sam_customers DROP CONSTRAINT IF EXISTS sam_customers_erp_code_key;
DROP INDEX IF EXISTS idx_sam_customers_erp_code;

-- 4. ruc pasa a ser NOT NULL + UNIQUE (la clave real del cliente)
ALTER TABLE sam_customers ALTER COLUMN ruc SET NOT NULL;
ALTER TABLE sam_customers ADD CONSTRAINT sam_customers_ruc_key UNIQUE (ruc);

-- 5. Indice en ruc para queries
CREATE INDEX IF NOT EXISTS idx_sam_customers_ruc ON sam_customers (ruc);

-- erp_code queda como TEXT nullable (referencia, ya no es PK)
ALTER TABLE sam_customers ALTER COLUMN erp_code DROP NOT NULL;
