-- ============================================================================
-- 018_fix_lider_utp_label.sql
--
-- Renombra el label "Gerencia UTP" → "Líder UTP" en config_commission_scale.
-- El role key interno 'gerencia_utp' no cambia (es un identificador técnico).
--
-- Ejecutar en Supabase SQL Editor.
-- Rollback: UPDATE config_commission_scale SET label = 'Gerencia UTP' WHERE role = 'gerencia_utp';
-- ============================================================================

UPDATE config_commission_scale
SET label = 'Líder UTP'
WHERE role = 'gerencia_utp';
