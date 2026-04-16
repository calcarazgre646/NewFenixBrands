import { describe, it, expect } from "vitest";
import {
  rankTransferCandidates,
  nextClusterCascade,
  isTransferAllowed,
} from "../clusterRouting";
import type { TransferCandidate } from "../clusterRouting";

// ─── rankTransferCandidates ─────────────────────────────────────────────────

describe("rankTransferCandidates", () => {
  const mkCandidate = (store: string, cluster: "A" | "B" | "OUT", units: number): TransferCandidate =>
    ({ store, cluster, availableUnits: units });

  it("A deficit: prefers A sources over B", () => {
    const candidates = [
      mkCandidate("B_STORE", "B", 50),
      mkCandidate("A_STORE", "A", 30),
    ];
    const ranked = rankTransferCandidates("A", candidates);
    expect(ranked[0].store).toBe("A_STORE");
  });

  it("A deficit: excludes OUT from ranking (pushed to end)", () => {
    const candidates = [
      mkCandidate("OUT_STORE", "OUT", 100),
      mkCandidate("B_STORE", "B", 20),
    ];
    const ranked = rankTransferCandidates("A", candidates);
    expect(ranked[0].store).toBe("B_STORE");
    expect(ranked[1].store).toBe("OUT_STORE");
  });

  it("B deficit: A first, then B, then OUT", () => {
    const candidates = [
      mkCandidate("OUT_S", "OUT", 50),
      mkCandidate("B_S", "B", 50),
      mkCandidate("A_S", "A", 50),
    ];
    const ranked = rankTransferCandidates("B", candidates);
    expect(ranked.map(c => c.cluster)).toEqual(["A", "B", "OUT"]);
  });

  it("OUT deficit: accepts from any cluster, A first", () => {
    const candidates = [
      mkCandidate("B_S", "B", 50),
      mkCandidate("A_S", "A", 50),
      mkCandidate("OUT_S", "OUT", 50),
    ];
    const ranked = rankTransferCandidates("OUT", candidates);
    expect(ranked[0].cluster).toBe("A");
  });

  it("same cluster rank: prefers more available units", () => {
    const candidates = [
      mkCandidate("A1", "A", 10),
      mkCandidate("A2", "A", 50),
    ];
    const ranked = rankTransferCandidates("A", candidates);
    expect(ranked[0].store).toBe("A2");
  });

  it("null deficit cluster: returns unchanged", () => {
    const candidates = [mkCandidate("A", "A", 10), mkCandidate("B", "B", 20)];
    const ranked = rankTransferCandidates(null, candidates);
    expect(ranked).toEqual(candidates);
  });

  it("single candidate: returns as-is", () => {
    const candidates = [mkCandidate("A", "A", 10)];
    expect(rankTransferCandidates("B", candidates)).toEqual(candidates);
  });
});

// ─── nextClusterCascade ─────────────────────────────────────────────────────

describe("nextClusterCascade", () => {
  it("A → B", () => expect(nextClusterCascade("A")).toBe("B"));
  it("B → OUT", () => expect(nextClusterCascade("B")).toBe("OUT"));
  it("OUT → null (terminal)", () => expect(nextClusterCascade("OUT")).toBeNull());
});

// ─── isTransferAllowed ──────────────────────────────────────────────────────

describe("isTransferAllowed", () => {
  it("A → B allowed", () => expect(isTransferAllowed("A", "B")).toBe(true));
  it("A → OUT allowed", () => expect(isTransferAllowed("A", "OUT")).toBe(true));
  it("B → OUT allowed", () => expect(isTransferAllowed("B", "OUT")).toBe(true));
  it("B → A allowed", () => expect(isTransferAllowed("B", "A")).toBe(true));
  it("OUT → A NOT allowed", () => expect(isTransferAllowed("OUT", "A")).toBe(false));
  it("OUT → B NOT allowed", () => expect(isTransferAllowed("OUT", "B")).toBe(false));
  it("OUT → OUT allowed", () => expect(isTransferAllowed("OUT", "OUT")).toBe(true));
  it("null clusters allowed", () => expect(isTransferAllowed(null, null)).toBe(true));
});
