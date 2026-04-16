/**
 * domain/commissions/scales.ts
 *
 * Escalas de comisión para los 8 roles.
 * Fuente: especificación de Rodrigo (Fenix Brands).
 *
 * REGLA: Solo constantes. Sin lógica de cálculo.
 */
import type { CommissionScale, CommissionRole } from "./types";

// ─── Canal Mayorista / UTP ──────────────────────────────────────────────────

export const VENDEDOR_MAYORISTA: CommissionScale = {
  role: "vendedor_mayorista",
  channel: "mayorista",
  type: "percentage",
  label: "Vendedor Mayorista",
  tiers: [
    { minPct: 0,   maxPct: 70,  value: 0 },
    { minPct: 70,  maxPct: 80,  value: 0.85 },
    { minPct: 80,  maxPct: 90,  value: 0.95 },
    { minPct: 90,  maxPct: 100, value: 1.05 },
    { minPct: 100, maxPct: 110, value: 1.15 },
    { minPct: 110, maxPct: 120, value: 1.25 },
    { minPct: 120, maxPct: Infinity, value: 1.35 },
  ],
};

export const VENDEDOR_UTP: CommissionScale = {
  role: "vendedor_utp",
  channel: "utp",
  type: "percentage",
  label: "Vendedor UTP",
  tiers: [
    { minPct: 0,   maxPct: 80,  value: 0 },
    { minPct: 80,  maxPct: 90,  value: 0.12 },
    { minPct: 90,  maxPct: 100, value: 0.15 },
    { minPct: 100, maxPct: 110, value: 0.17 },
    { minPct: 110, maxPct: 120, value: 0.20 },
    { minPct: 120, maxPct: Infinity, value: 0.23 },
  ],
};

export const BACKOFFICE_UTP: CommissionScale = {
  role: "backoffice_utp",
  channel: "utp",
  type: "percentage",
  label: "Back Office UTP",
  tiers: [
    { minPct: 0,   maxPct: 80,  value: 0 },
    { minPct: 80,  maxPct: 90,  value: 0.24 },
    { minPct: 90,  maxPct: 100, value: 0.30 },
    { minPct: 100, maxPct: 110, value: 0.34 },
    { minPct: 110, maxPct: 120, value: 0.40 },
    { minPct: 120, maxPct: Infinity, value: 0.46 },
  ],
};

export const GERENCIA_MAYORISTA: CommissionScale = {
  role: "gerencia_mayorista",
  channel: "mayorista",
  type: "percentage",
  label: "Gerencia Mayorista",
  tiers: [
    { minPct: 0,   maxPct: 80,  value: 0 },
    { minPct: 80,  maxPct: 90,  value: 0.17 },
    { minPct: 90,  maxPct: 100, value: 0.20 },
    { minPct: 100, maxPct: 110, value: 0.23 },
    { minPct: 110, maxPct: 120, value: 0.26 },
    { minPct: 120, maxPct: Infinity, value: 0.29 },
  ],
};

export const GERENCIA_UTP: CommissionScale = {
  role: "gerencia_utp",
  channel: "utp",
  type: "percentage",
  label: "Líder UTP",
  tiers: [
    { minPct: 0,   maxPct: 80,  value: 0 },
    { minPct: 80,  maxPct: 90,  value: 1.00 },
    { minPct: 90,  maxPct: 100, value: 1.30 },
    { minPct: 100, maxPct: 110, value: 1.60 },
    { minPct: 110, maxPct: 120, value: 1.90 },
    { minPct: 120, maxPct: Infinity, value: 2.20 },
  ],
};

// ─── Canal Retail ───────────────────────────────────────────────────────────

export const VENDEDOR_TIENDA: CommissionScale = {
  role: "vendedor_tienda",
  channel: "retail",
  type: "percentage",
  label: "Vendedor Tienda",
  tiers: [
    { minPct: 0,   maxPct: 70,  value: 0 },
    { minPct: 70,  maxPct: 80,  value: 0.85 },
    { minPct: 80,  maxPct: 90,  value: 0.95 },
    { minPct: 90,  maxPct: 100, value: 1.05 },
    { minPct: 100, maxPct: 110, value: 1.15 },
    { minPct: 110, maxPct: 120, value: 1.25 },
    { minPct: 120, maxPct: Infinity, value: 1.35 },
  ],
};

export const SUPERVISOR_TIENDA: CommissionScale = {
  role: "supervisor_tienda",
  channel: "retail",
  type: "fixed",
  label: "Supervisor Tienda",
  tiers: [
    { minPct: 0,   maxPct: 100, value: 0 },
    { minPct: 100, maxPct: 110, value: 600_000 },
    { minPct: 110, maxPct: 120, value: 700_000 },
    { minPct: 120, maxPct: Infinity, value: 800_000 },
  ],
};

export const GERENCIA_RETAIL: CommissionScale = {
  role: "gerencia_retail",
  channel: "retail",
  type: "percentage",
  label: "Gerencia Retail",
  tiers: [
    { minPct: 0,   maxPct: 80,  value: 0 },
    { minPct: 80,  maxPct: 90,  value: 0.17 },
    { minPct: 90,  maxPct: 100, value: 0.20 },
    { minPct: 100, maxPct: 110, value: 0.23 },
    { minPct: 110, maxPct: 120, value: 0.26 },
    { minPct: 120, maxPct: Infinity, value: 0.29 },
  ],
};

// ─── Registry ──────────────────────────────────────────────────────────────

export const ALL_SCALES: CommissionScale[] = [
  VENDEDOR_MAYORISTA,
  VENDEDOR_UTP,
  BACKOFFICE_UTP,
  GERENCIA_MAYORISTA,
  GERENCIA_UTP,
  VENDEDOR_TIENDA,
  SUPERVISOR_TIENDA,
  GERENCIA_RETAIL,
];

export const SCALE_BY_ROLE: Record<CommissionRole, CommissionScale> = Object.fromEntries(
  ALL_SCALES.map(s => [s.role, s])
) as Record<CommissionRole, CommissionScale>;

export const ROLE_LABELS: Record<CommissionRole, string> = Object.fromEntries(
  ALL_SCALES.map(s => [s.role, s.label])
) as Record<CommissionRole, string>;

export const CHANNEL_LABELS: Record<string, string> = {
  mayorista: "Mayorista",
  utp: "UTP",
  retail: "Retail",
};
