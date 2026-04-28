import { describe, it, expect } from "vitest";
import {
  b2bSubchannelToSucursalFinal,
  b2bSubchannelToUniforme,
  b2bSubchannelLabel,
} from "../b2b";

describe("b2bSubchannelToSucursalFinal", () => {
  it("all → null (no aplica filtro extra)", () => {
    expect(b2bSubchannelToSucursalFinal("all")).toBeNull();
  });
  it("mayorista → MAYORISTA", () => {
    expect(b2bSubchannelToSucursalFinal("mayorista")).toBe("MAYORISTA");
  });
  it("utp → UTP", () => {
    expect(b2bSubchannelToSucursalFinal("utp")).toBe("UTP");
  });
});

describe("b2bSubchannelToUniforme", () => {
  it("all → null", () => {
    expect(b2bSubchannelToUniforme("all")).toBeNull();
  });
  it("mayorista → vtaxmayor", () => {
    expect(b2bSubchannelToUniforme("mayorista")).toBe("vtaxmayor");
  });
  it("utp → uniforme", () => {
    expect(b2bSubchannelToUniforme("utp")).toBe("uniforme");
  });
});

describe("b2bSubchannelLabel", () => {
  it.each([
    ["all", "Todos"],
    ["mayorista", "Mayorista"],
    ["utp", "UTP"],
  ] as const)("%s → %s", (sub, expected) => {
    expect(b2bSubchannelLabel(sub)).toBe(expected);
  });
});
