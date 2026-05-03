/**
 * Tests para el contrato viewSupportedFilters.
 */
import { describe, it, expect } from "vitest";
import {
  ALL_FILTERS_ENABLED,
  FILTER_REASONS,
  disabledReason,
  isEnabled,
} from "@/domain/filters/viewSupport";

describe("viewSupport", () => {
  describe("ALL_FILTERS_ENABLED", () => {
    it("habilita los 3 filtros", () => {
      expect(ALL_FILTERS_ENABLED).toEqual({ brand: true, channel: true, period: true });
    });
  });

  describe("isEnabled", () => {
    it("true cuando support === true", () => {
      expect(isEnabled(true)).toBe(true);
    });
    it("false cuando support === false", () => {
      expect(isEnabled(false)).toBe(false);
    });
    it("false cuando support es string (= razón de bloqueo)", () => {
      expect(isEnabled("razón")).toBe(false);
    });
  });

  describe("disabledReason", () => {
    it("null cuando el filtro está habilitado", () => {
      expect(disabledReason(true)).toBeNull();
    });
    it("mensaje genérico cuando es false sin razón explícita", () => {
      expect(disabledReason(false)).toMatch(/no aplica/i);
    });
    it("la string cuando se pasa razón custom", () => {
      expect(disabledReason("Razón custom")).toBe("Razón custom");
    });
    it("usa los reasons estándar correctamente", () => {
      expect(disabledReason(FILTER_REASONS.noChannelInventory)).toContain("canal");
      expect(disabledReason(FILTER_REASONS.noPeriodSnapshot)).toContain("período");
      expect(disabledReason(FILTER_REASONS.noChannelPricing)).toContain("canal");
      expect(disabledReason(FILTER_REASONS.noPeriodLogistics)).toContain("Logística");
      expect(disabledReason(FILTER_REASONS.noPeriodDepots)).toContain("stock");
    });
  });
});
