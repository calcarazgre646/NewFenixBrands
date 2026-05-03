/**
 * Tests del helper scopeToChannel: mapea channel_scope del perfil al ChannelFilter.
 */
import { describe, it, expect } from "vitest";
import { scopeToChannel } from "@/domain/filters/scopeMapping";

describe("scopeToChannel", () => {
  it("null → 'total'", () => {
    expect(scopeToChannel(null)).toBe("total");
  });

  it("'total' → 'total'", () => {
    expect(scopeToChannel("total")).toBe("total");
  });

  it("'b2c' → 'b2c'", () => {
    expect(scopeToChannel("b2c")).toBe("b2c");
  });

  it("'b2b' → 'b2b'", () => {
    expect(scopeToChannel("b2b")).toBe("b2b");
  });

  it("'b2b_mayoristas' → 'b2b' (sub-canales agrupados)", () => {
    expect(scopeToChannel("b2b_mayoristas")).toBe("b2b");
  });

  it("'b2b_utp' → 'b2b' (sub-canales agrupados)", () => {
    expect(scopeToChannel("b2b_utp")).toBe("b2b");
  });

  it("scope desconocido → 'total' (fallback seguro)", () => {
    expect(scopeToChannel("desconocido")).toBe("total");
    expect(scopeToChannel("")).toBe("total");
  });
});
