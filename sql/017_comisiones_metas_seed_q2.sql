-- Seed 017: Metas Q2 2026 — Mayorista (por zona) + UTP (por vendedor)
-- Fuente: correos de Rodrigo Aguayo (06/04/2026 y anteriores)
--
-- MAYORISTA: códigos confirmados en fjdhstvta1
--   9  = EDGAR LOPEZ      → Zona Central
--   21 = JUAN SCEBBA      → Zona Este
--   25 = AGUSTIN MENDOZA  → Zona Norte
--   27 = CARLOS GAMARRA   → Zona Sur + Capital (metas sumadas)
--
-- UTP: códigos PENDIENTES — Marta/Jorge/Cintia no están en fjdhstvta1 aún
--   9001 = MARTA VELILLA     (placeholder — confirmar con Rodrigo)
--   9002 = JORGE MANCUELLO   (placeholder — confirmar con Rodrigo)
--   9003 = CINTIA OCAMPOS    (placeholder — confirmar con Rodrigo)
--
-- Cuando se confirmen los códigos reales:
--   UPDATE comisiones_metas_vendedor SET vendedor_codigo = <real> WHERE vendedor_codigo = 900X;

-- ═══════════════════════════════════════════════════════════════════════
-- MAYORISTA Q2 2026
-- ═══════════════════════════════════════════════════════════════════════

-- AGUSTIN MENDOZA — Zona Norte
INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (25, 'AGUSTIN MENDOZA', 'vendedor_mayorista', 'mayorista', 2026, 4, 2, 332150811, 'NORTE'),
  (25, 'AGUSTIN MENDOZA', 'vendedor_mayorista', 'mayorista', 2026, 5, 2, 280779585, 'NORTE'),
  (25, 'AGUSTIN MENDOZA', 'vendedor_mayorista', 'mayorista', 2026, 6, 2, 213510054, 'NORTE')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();

-- EDGAR LOPEZ — Zona Central
INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (9, 'EDGAR LOPEZ', 'vendedor_mayorista', 'mayorista', 2026, 4, 2, 229155696, 'CENTRAL'),
  (9, 'EDGAR LOPEZ', 'vendedor_mayorista', 'mayorista', 2026, 5, 2, 450190587, 'CENTRAL'),
  (9, 'EDGAR LOPEZ', 'vendedor_mayorista', 'mayorista', 2026, 6, 2, 296498464, 'CENTRAL')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();

-- JUAN SCEBBA — Zona Este
INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (21, 'JUAN SCEBBA', 'vendedor_mayorista', 'mayorista', 2026, 4, 2, 462804631, 'ESTE'),
  (21, 'JUAN SCEBBA', 'vendedor_mayorista', 'mayorista', 2026, 5, 2, 440978099, 'ESTE'),
  (21, 'JUAN SCEBBA', 'vendedor_mayorista', 'mayorista', 2026, 6, 2, 321017524, 'ESTE')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();

-- CARLOS GAMARRA — Zona Sur + Capital (metas sumadas)
INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (27, 'CARLOS GAMARRA', 'vendedor_mayorista', 'mayorista', 2026, 4, 2, 418695700, 'SUR+CAPITAL'),
  (27, 'CARLOS GAMARRA', 'vendedor_mayorista', 'mayorista', 2026, 5, 2, 327371918, 'SUR+CAPITAL'),
  (27, 'CARLOS GAMARRA', 'vendedor_mayorista', 'mayorista', 2026, 6, 2, 411132484, 'SUR+CAPITAL')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════
-- UTP Q2 2026
-- ═══════════════════════════════════════════════════════════════════════

-- MARTA VELILLA — Líder Negocio Uniformes Corporativos (escala: vendedor_utp)
INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 4, 2, 166743129, 'UTP COMPLETO'),
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 5, 2, 120986607, 'UTP COMPLETO'),
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 6, 2, 161469735, 'UTP COMPLETO')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();

-- JORGE MANCUELLO — Vendedor B2B Uniformes Corporativos
INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 4, 2, 125057347, 'UTP TERRITORIO 1'),
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 5, 2, 90739955, 'UTP TERRITORIO 1'),
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 6, 2, 121102301, 'UTP TERRITORIO 1')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();

-- CINTIA OCAMPOS — Vendedor B2B Uniformes Corporativos
INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 4, 2, 125057347, 'UTP TERRITORIO 2'),
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 5, 2, 90739955, 'UTP TERRITORIO 2'),
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 6, 2, 121102301, 'UTP TERRITORIO 2')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════
-- UTP Q3 2026
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 7, 3, 212238747, 'UTP COMPLETO'),
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 8, 3, 273219156, 'UTP COMPLETO'),
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 9, 3, 198113496, 'UTP COMPLETO'),
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 7, 3, 159179060, 'UTP TERRITORIO 1'),
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 8, 3, 204914367, 'UTP TERRITORIO 1'),
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 9, 3, 148585122, 'UTP TERRITORIO 1'),
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 7, 3, 159179060, 'UTP TERRITORIO 2'),
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 8, 3, 204914367, 'UTP TERRITORIO 2'),
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 9, 3, 148585122, 'UTP TERRITORIO 2')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════
-- UTP Q4 2026
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO comisiones_metas_vendedor (vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, zona)
VALUES
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 10, 4, 312818728, 'UTP COMPLETO'),
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 11, 4, 265247868, 'UTP COMPLETO'),
  (9001, 'MARTA VELILLA', 'gerencia_utp', 'utp', 2026, 12, 4, 240727171, 'UTP COMPLETO'),
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 10, 4, 234614046, 'UTP TERRITORIO 1'),
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 11, 4, 198935901, 'UTP TERRITORIO 1'),
  (9002, 'JORGE MANCUELLO', 'vendedor_utp', 'utp', 2026, 12, 4, 180545378, 'UTP TERRITORIO 1'),
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 10, 4, 234614046, 'UTP TERRITORIO 2'),
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 11, 4, 198935901, 'UTP TERRITORIO 2'),
  (9003, 'CINTIA OCAMPOS', 'vendedor_utp', 'utp', 2026, 12, 4, 180545378, 'UTP TERRITORIO 2')
ON CONFLICT (vendedor_codigo, año, mes) DO UPDATE SET
  meta_ventas = EXCLUDED.meta_ventas,
  zona = EXCLUDED.zona,
  updated_at = NOW();
