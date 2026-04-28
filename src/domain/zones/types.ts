/**
 * domain/zones/types.ts
 *
 * Zonas comerciales B2B (Mayorista + UTP).
 *
 * Las zonas viven en dos tablas con valores no normalizados:
 *   - maestro_clientes_mayoristas.zona (data project)
 *   - comisiones_metas_vendedor.zona  (auth project)
 *
 * Esos strings llegan con casing inconsistente, newlines, y variantes
 * numeradas. `normalizeZone()` (en ./normalize.ts) los proyecta a este set.
 *
 * Set canónico observado en BD al 2026-04-28:
 *   Mayorista geográficas: CAPITAL, CENTRAL, NORTE, SUR, ESTE
 *   Mayorista combinada:   SUR+CAPITAL  (sólo en metas)
 *   UTP:                   UTP TERRITORIO 1, UTP TERRITORIO 2, UTP COMPLETO
 *
 * Se mantiene el tipo como `string` (no union literal) porque el set
 * puede crecer cuando Rodrigo/Derlys carguen más metas.
 */

export type Zone = string;
