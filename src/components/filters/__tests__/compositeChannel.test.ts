/**
 * Tests del helper compositeChannel: round-trip entre el value del select de
 * Canal (con sub-canal B2B nesteado) y el shape (channel, sub) del Context.
 */
import { describe, it, expect } from "vitest";
import { toComposite, fromComposite } from "@/components/filters/compositeChannel";
import type { B2bSubchannel, ChannelFilter } from "@/domain/filters/types";

describe("compositeChannel", () => {
  describe("toComposite", () => {
    it("total → 'total' (ignora el sub)", () => {
      expect(toComposite("total", "all")).toBe("total");
      expect(toComposite("total", "mayorista")).toBe("total");
      expect(toComposite("total", "utp")).toBe("total");
    });

    it("b2c → 'b2c' (ignora el sub)", () => {
      expect(toComposite("b2c", "all")).toBe("b2c");
      expect(toComposite("b2c", "mayorista")).toBe("b2c");
    });

    it("b2b → 'b2b:{sub}'", () => {
      expect(toComposite("b2b", "all")).toBe("b2b:all");
      expect(toComposite("b2b", "mayorista")).toBe("b2b:mayorista");
      expect(toComposite("b2b", "utp")).toBe("b2b:utp");
    });
  });

  describe("fromComposite", () => {
    it("'total' → total + sub:'all' (reset implícito)", () => {
      expect(fromComposite("total")).toEqual({ channel: "total", sub: "all" });
    });

    it("'b2c' → b2c + sub:'all' (reset implícito)", () => {
      expect(fromComposite("b2c")).toEqual({ channel: "b2c", sub: "all" });
    });

    it("'b2b:{sub}' → b2b + sub correspondiente", () => {
      expect(fromComposite("b2b:all")).toEqual({ channel: "b2b", sub: "all" });
      expect(fromComposite("b2b:mayorista")).toEqual({ channel: "b2b", sub: "mayorista" });
      expect(fromComposite("b2b:utp")).toEqual({ channel: "b2b", sub: "utp" });
    });
  });

  describe("round-trip", () => {
    const cases: Array<[ChannelFilter, B2bSubchannel]> = [
      ["total", "all"],
      ["b2c", "all"],
      ["b2b", "all"],
      ["b2b", "mayorista"],
      ["b2b", "utp"],
    ];
    it.each(cases)("preserva (%s, %s)", (channel, sub) => {
      const composite = toComposite(channel, sub);
      const parsed = fromComposite(composite);
      // Para canales no-b2b, el sub se resetea a 'all' (es la semántica esperada)
      const expectedSub = channel === "b2b" ? sub : "all";
      expect(parsed).toEqual({ channel, sub: expectedSub });
    });
  });
});
