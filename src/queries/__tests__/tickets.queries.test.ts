import { describe, it, expect } from "vitest";
import { filterTicketsByChannel, type TicketRow } from "../tickets.queries";

const t = (storeCode: string): TicketRow => ({
  storeCode,
  year:       2026,
  month:      4,
  day:        15,
  tickets:    10,
  totalSales: 1_000_000,
});

// cosupc → cosujd
const storeMap = new Map([
  ["S1", "ESTRELLA"],     // B2C
  ["S2", "TOLUQ"],        // B2C
  ["M1", "MAYORISTA"],    // B2B Mayorista
  ["U1", "UTP"],          // B2B UTP
  ["U2", "UNIFORMES"],    // B2B UTP (alias)
]);

describe("filterTicketsByChannel — sub-canal B2B", () => {
  const all = [t("S1"), t("S2"), t("M1"), t("U1"), t("U2")];

  it("channel=total + sub=all → no filtra", () => {
    expect(filterTicketsByChannel(all, storeMap, "total", null, "all")).toHaveLength(5);
  });

  it("channel=b2b + sub=all → ambos UTP y Mayorista", () => {
    const r = filterTicketsByChannel(all, storeMap, "b2b", null, "all");
    expect(r.map(x => x.storeCode).sort()).toEqual(["M1", "U1", "U2"]);
  });

  it("channel=b2b + sub=mayorista → sólo MAYORISTA", () => {
    const r = filterTicketsByChannel(all, storeMap, "b2b", null, "mayorista");
    expect(r.map(x => x.storeCode)).toEqual(["M1"]);
  });

  it("channel=b2b + sub=utp → UTP + UNIFORMES", () => {
    const r = filterTicketsByChannel(all, storeMap, "b2b", null, "utp");
    expect(r.map(x => x.storeCode).sort()).toEqual(["U1", "U2"]);
  });

  it("channel=b2c → ignora b2bSub aunque venga 'utp'", () => {
    const r = filterTicketsByChannel(all, storeMap, "b2c", null, "utp");
    expect(r.map(x => x.storeCode).sort()).toEqual(["S1", "S2"]);
  });

  it("default sub=all es backward compatible (firma sin 5to arg)", () => {
    const r = filterTicketsByChannel(all, storeMap, "b2b", null);
    expect(r.map(x => x.storeCode).sort()).toEqual(["M1", "U1", "U2"]);
  });

  it("filtro de tienda específica gana sobre sub-filtro", () => {
    const r = filterTicketsByChannel(all, storeMap, "b2b", "MAYORISTA", "utp");
    // sub=utp pediría UTP/UNIFORMES, pero store=MAYORISTA exige MAYORISTA → vacío
    expect(r).toEqual([]);
  });
});
