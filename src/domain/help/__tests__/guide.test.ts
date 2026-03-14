/**
 * Tests para domain/help/guide.ts
 */
import { describe, it, expect } from "vitest";
import type { Permissions } from "@/domain/auth/types";
import { derivePermissions } from "@/domain/auth/types";
import type { UserProfile } from "@/domain/auth/types";
import {
  GUIDE_SECTIONS,
  getVisibleSections,
  findSection,
} from "../guide";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "test-uuid",
    role: "super_user",
    channelScope: null,
    fullName: "Test User",
    cargo: null,
    isActive: true,
    mustChangePassword: false,
    ...overrides,
  };
}

function permsFor(role: UserProfile["role"], channelScope: UserProfile["channelScope"] = null): Permissions {
  return derivePermissions(makeProfile({ role, channelScope }));
}

// ─── GUIDE_SECTIONS structure ────────────────────────────────────────────────

describe("GUIDE_SECTIONS", () => {
  it("has 8 sections", () => {
    expect(GUIDE_SECTIONS).toHaveLength(8);
  });

  it("each section has required fields", () => {
    for (const s of GUIDE_SECTIONS) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.path).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(s.summary).toBeTruthy();
      expect(s.features.length).toBeGreaterThan(0);
      expect(s.tips.length).toBeGreaterThan(0);
      expect(typeof s.allowed).toBe("function");
    }
  });

  it("each section has unique id", () => {
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each section has unique path", () => {
    const paths = GUIDE_SECTIONS.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("features have title and description", () => {
    for (const s of GUIDE_SECTIONS) {
      for (const f of s.features) {
        expect(f.title).toBeTruthy();
        expect(f.description).toBeTruthy();
      }
    }
  });

  it("tips are non-empty strings", () => {
    for (const s of GUIDE_SECTIONS) {
      for (const tip of s.tips) {
        expect(tip.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── getVisibleSections ──────────────────────────────────────────────────────

describe("getVisibleSections", () => {
  describe("super_user sees all 8 sections", () => {
    const sections = getVisibleSections(permsFor("super_user"));

    it("returns 8 sections", () => {
      expect(sections).toHaveLength(8);
    });

    it("includes usuarios section", () => {
      expect(sections.find((s) => s.id === "usuarios")).toBeDefined();
    });
  });

  describe("gerencia sees 7 sections (no usuarios)", () => {
    const sections = getVisibleSections(permsFor("gerencia"));

    it("returns 7 sections", () => {
      expect(sections).toHaveLength(7);
    });

    it("excludes usuarios", () => {
      expect(sections.find((s) => s.id === "usuarios")).toBeUndefined();
    });

    it("includes inicio, kpis, depositos", () => {
      const ids = sections.map((s) => s.id);
      expect(ids).toContain("inicio");
      expect(ids).toContain("kpis");
      expect(ids).toContain("depositos");
    });
  });

  describe("negocio sees 4 sections", () => {
    const sections = getVisibleSections(permsFor("negocio", "b2c"));

    it("returns 4 sections", () => {
      expect(sections).toHaveLength(4);
    });

    it("includes ventas, acciones, logistica, calendario", () => {
      const ids = sections.map((s) => s.id);
      expect(ids).toContain("ventas");
      expect(ids).toContain("acciones");
      expect(ids).toContain("logistica");
      expect(ids).toContain("calendario");
    });

    it("excludes inicio, kpis, depositos, usuarios", () => {
      const ids = sections.map((s) => s.id);
      expect(ids).not.toContain("inicio");
      expect(ids).not.toContain("kpis");
      expect(ids).not.toContain("depositos");
      expect(ids).not.toContain("usuarios");
    });
  });

  describe("negocio with total scope sees same 4 sections", () => {
    const sections = getVisibleSections(permsFor("negocio", "total"));

    it("returns 4 sections", () => {
      expect(sections).toHaveLength(4);
    });
  });

  describe("negocio with null scope sees same 4 sections", () => {
    const sections = getVisibleSections(permsFor("negocio", null));

    it("returns 4 sections", () => {
      expect(sections).toHaveLength(4);
    });
  });

  describe("inactive user sees 0 sections", () => {
    const perms = derivePermissions(makeProfile({ isActive: false }));
    const sections = getVisibleSections(perms);

    it("returns 0 sections", () => {
      expect(sections).toHaveLength(0);
    });
  });

  describe("null profile sees 0 sections", () => {
    const perms = derivePermissions(null);
    const sections = getVisibleSections(perms);

    it("returns 0 sections", () => {
      expect(sections).toHaveLength(0);
    });
  });

  it("preserves section order", () => {
    const sections = getVisibleSections(permsFor("super_user"));
    const ids = sections.map((s) => s.id);
    expect(ids).toEqual([
      "inicio",
      "ventas",
      "acciones",
      "logistica",
      "depositos",
      "kpis",
      "calendario",
      "usuarios",
    ]);
  });
});

// ─── findSection ─────────────────────────────────────────────────────────────

describe("findSection", () => {
  it("finds existing section by id", () => {
    const s = findSection("ventas");
    expect(s).toBeDefined();
    expect(s!.title).toBe("Ventas");
    expect(s!.path).toBe("/ventas");
  });

  it("returns undefined for non-existent id", () => {
    expect(findSection("nonexistent")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(findSection("")).toBeUndefined();
  });

  it("finds each section correctly", () => {
    for (const section of GUIDE_SECTIONS) {
      const found = findSection(section.id);
      expect(found).toBe(section);
    }
  });
});

// ─── Permission alignment ────────────────────────────────────────────────────

describe("permission alignment with routes", () => {
  it("inicio requires canViewExecutive", () => {
    const s = findSection("inicio")!;
    const negocio = permsFor("negocio", "b2c");
    const gerencia = permsFor("gerencia");
    expect(s.allowed(negocio)).toBe(false);
    expect(s.allowed(gerencia)).toBe(true);
  });

  it("ventas requires canViewSales", () => {
    const s = findSection("ventas")!;
    expect(s.allowed(permsFor("negocio", "b2c"))).toBe(true);
    expect(s.allowed(permsFor("super_user"))).toBe(true);
  });

  it("usuarios requires canManageUsers", () => {
    const s = findSection("usuarios")!;
    expect(s.allowed(permsFor("super_user"))).toBe(true);
    expect(s.allowed(permsFor("gerencia"))).toBe(false);
    expect(s.allowed(permsFor("negocio", "b2c"))).toBe(false);
  });

  it("depositos requires canViewDepots", () => {
    const s = findSection("depositos")!;
    expect(s.allowed(permsFor("super_user"))).toBe(true);
    expect(s.allowed(permsFor("gerencia"))).toBe(true);
    expect(s.allowed(permsFor("negocio", "b2c"))).toBe(false);
  });

  it("calendario requires canViewCalendar", () => {
    const s = findSection("calendario")!;
    expect(s.allowed(permsFor("negocio", "b2c"))).toBe(true);
    expect(s.allowed(permsFor("super_user"))).toBe(true);
  });
});
