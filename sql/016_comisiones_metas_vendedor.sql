-- Migration 016: Tabla de metas individuales por vendedor
-- Resuelve el bloqueo de comisiones Mayorista/UTP (meta=0 → "Pendiente")
--
-- Vendedores Mayorista: códigos confirmados en fjdhstvta1
-- Vendedores UTP: códigos PENDIENTES (Marta/Jorge/Cintia no aparecen en BD aún)
--   Se usan placeholders 9001/9002/9003 hasta confirmar con Rodrigo.

CREATE TABLE IF NOT EXISTS comisiones_metas_vendedor (
  id BIGSERIAL PRIMARY KEY,
  vendedor_codigo INT NOT NULL,
  vendedor_nombre TEXT NOT NULL,
  rol_comision TEXT NOT NULL CHECK (rol_comision IN (
    'vendedor_mayorista', 'vendedor_utp', 'backoffice_utp',
    'gerencia_mayorista', 'gerencia_utp',
    'vendedor_tienda', 'supervisor_tienda', 'gerencia_retail'
  )),
  canal TEXT NOT NULL CHECK (canal IN ('mayorista', 'utp', 'retail')),
  año INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  trimestre INT NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  meta_ventas NUMERIC NOT NULL DEFAULT 0,
  meta_cobranza NUMERIC DEFAULT 0,
  sucursal_codigo TEXT,
  zona TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (vendedor_codigo, año, mes)
);

-- RLS: lectura pública (datos no sensibles, app interna)
ALTER TABLE comisiones_metas_vendedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON comisiones_metas_vendedor FOR SELECT TO anon USING (true);
CREATE POLICY "auth_read" ON comisiones_metas_vendedor FOR SELECT TO authenticated USING (true);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_cmv_año_mes ON comisiones_metas_vendedor (año, mes);
CREATE INDEX IF NOT EXISTS idx_cmv_canal ON comisiones_metas_vendedor (canal);
