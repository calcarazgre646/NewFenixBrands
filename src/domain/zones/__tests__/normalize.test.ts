import { describe, it, expect } from "vitest";
import { normalizeZone } from "../normalize";

describe("normalizeZone", () => {
  describe("nullish/empty input", () => {
    it("null → null", () => expect(normalizeZone(null)).toBeNull());
    it("undefined → null", () => expect(normalizeZone(undefined)).toBeNull());
    it("empty string → null", () => expect(normalizeZone("")).toBeNull());
    it("only spaces → null", () => expect(normalizeZone("   ")).toBeNull());
    it("only newlines → null", () => expect(normalizeZone("\n\n")).toBeNull());
    it("mixed whitespace → null", () => expect(normalizeZone(" \n \t ")).toBeNull());
  });

  describe("master fixtures (maestro_clientes_mayoristas.zona)", () => {
    it.each([
      ["CAPITAL", "CAPITAL"],
      ["Capital", "CAPITAL"],
      ["CENTRAL", "CENTRAL"],
      ["NORTE", "NORTE"],
      ["SUR", "SUR"],
      ["Sur", "SUR"],
      ["sUR", "SUR"],
      ["ESTE", "ESTE"],
      ["Este", "ESTE"],
    ])("%s → %s", (raw, expected) => {
      expect(normalizeZone(raw)).toBe(expected);
    });

    it("collapses numbered variants to base zone (SUR 2 → SUR)", () => {
      expect(normalizeZone("SUR 2")).toBe("SUR");
    });
  });

  describe("metas fixtures (comisiones_metas_vendedor.zona)", () => {
    it("preserves combined zones (SUR+CAPITAL)", () => {
      expect(normalizeZone("SUR+CAPITAL")).toBe("SUR+CAPITAL");
    });

    it.each([
      ["UTP \n  COMPLETO",      "UTP COMPLETO"],
      ["UTP  \n  COMPLETO",     "UTP COMPLETO"],
      ["UTP\n   COMPLETO",      "UTP COMPLETO"],
      ["UTP \n  TERRITORIO 1",  "UTP TERRITORIO 1"],
      ["UTP\n   TERRITORIO 1",  "UTP TERRITORIO 1"],
      ["UTP TERRITORIO 1",      "UTP TERRITORIO 1"],
      ["UTP \n  TERRITORIO 2",  "UTP TERRITORIO 2"],
      ["UTP\n   TERRITORIO 2",  "UTP TERRITORIO 2"],
    ])("%s → %s", (raw, expected) => {
      expect(normalizeZone(raw)).toBe(expected);
    });

    it("preserves UTP TERRITORIO N (number is meaningful, not a variant)", () => {
      expect(normalizeZone("UTP TERRITORIO 1")).toBe("UTP TERRITORIO 1");
      expect(normalizeZone("UTP TERRITORIO 2")).toBe("UTP TERRITORIO 2");
    });
  });

  describe("idempotency", () => {
    it.each([
      "CAPITAL",
      "SUR",
      "UTP TERRITORIO 1",
      "SUR+CAPITAL",
    ])("normalize(normalize(%s)) === normalize(%s)", (raw) => {
      const once = normalizeZone(raw);
      expect(normalizeZone(once)).toBe(once);
    });
  });

  describe("real BD count consistency", () => {
    // Los strings observados al 2026-04-28 en
    // maestro_clientes_mayoristas (444 filas) deben colapsar a 5 zonas.
    it("collapses master raw values to canonical 5-zone set", () => {
      const masterRaw = [
        "CAPITAL", "Capital", "CAPITAL",
        "CENTRAL",
        "SUR", "Sur", "sUR", "SUR 2",
        "NORTE",
        "ESTE", "Este",
      ];
      const canonical = new Set(masterRaw.map(normalizeZone));
      expect([...canonical].sort()).toEqual(
        ["CAPITAL", "CENTRAL", "ESTE", "NORTE", "SUR"].sort(),
      );
    });
  });
});
