/**
 * Tests para domain/auth/types.ts
 *
 * Verifica la derivación de permisos para los 3 roles y sus variantes.
 */
import { describe, it, expect } from "vitest";
import {
  derivePermissions,
  getDefaultRoute,
  getRoleLabel,
  type UserProfile,
} from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "test-uuid",
    role: "gerencia",
    channelScope: null,
    fullName: "Test User",
    cargo: "Tester",
    isActive: true,
    mustChangePassword: false,
    vendedorCodigo: null,
    ...overrides,
  };
}

// ─── derivePermissions ──────────────────────────────────────────────────────────

describe("derivePermissions", () => {
  describe("super_user", () => {
    const p = derivePermissions(makeProfile({ role: "super_user" }));

    it("can view all pages", () => {
      expect(p.canViewExecutive).toBe(true);
      expect(p.canViewKpis).toBe(true);
      expect(p.canViewSales).toBe(true);
      expect(p.canViewActions).toBe(true);
      expect(p.canViewLogistics).toBe(true);
      expect(p.canViewDepots).toBe(true);
      expect(p.canViewCalendar).toBe(true);
    });

    it("can manage users", () => {
      expect(p.canManageUsers).toBe(true);
    });

    it("channel is NOT locked", () => {
      expect(p.isChannelLocked).toBe(false);
      expect(p.lockedChannel).toBeNull();
    });
  });

  describe("gerencia", () => {
    const p = derivePermissions(makeProfile({ role: "gerencia" }));

    it("can view all pages", () => {
      expect(p.canViewExecutive).toBe(true);
      expect(p.canViewKpis).toBe(true);
      expect(p.canViewSales).toBe(true);
      expect(p.canViewActions).toBe(true);
      expect(p.canViewLogistics).toBe(true);
      expect(p.canViewDepots).toBe(true);
      expect(p.canViewCalendar).toBe(true);
    });

    it("cannot manage users", () => {
      expect(p.canManageUsers).toBe(false);
    });

    it("channel is NOT locked", () => {
      expect(p.isChannelLocked).toBe(false);
      expect(p.lockedChannel).toBeNull();
    });
  });

  describe("negocio — b2c scope", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: "b2c" }));

    it("can view ventas, acciones, logistica, calendario", () => {
      expect(p.canViewSales).toBe(true);
      expect(p.canViewActions).toBe(true);
      expect(p.canViewLogistics).toBe(true);
      expect(p.canViewCalendar).toBe(true);
    });

    it("cannot view executive, kpis, depositos", () => {
      expect(p.canViewExecutive).toBe(false);
      expect(p.canViewKpis).toBe(false);
      expect(p.canViewDepots).toBe(false);
    });

    it("cannot manage users", () => {
      expect(p.canManageUsers).toBe(false);
    });

    it("channel IS locked to b2c", () => {
      expect(p.isChannelLocked).toBe(true);
      expect(p.lockedChannel).toBe("b2c");
    });
  });

  describe("negocio — b2b_mayoristas scope", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: "b2b_mayoristas" }));

    it("channel IS locked to b2b_mayoristas", () => {
      expect(p.isChannelLocked).toBe(true);
      expect(p.lockedChannel).toBe("b2b_mayoristas");
    });
  });

  describe("negocio — b2b_utp scope", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: "b2b_utp" }));

    it("channel IS locked to b2b_utp", () => {
      expect(p.isChannelLocked).toBe(true);
      expect(p.lockedChannel).toBe("b2b_utp");
    });
  });

  describe("negocio — b2b scope (both Mayoristas + UTP)", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: "b2b" }));

    it("can view ventas, acciones, logistica, calendario", () => {
      expect(p.canViewSales).toBe(true);
      expect(p.canViewActions).toBe(true);
      expect(p.canViewLogistics).toBe(true);
      expect(p.canViewCalendar).toBe(true);
    });

    it("cannot view executive, kpis, depositos", () => {
      expect(p.canViewExecutive).toBe(false);
      expect(p.canViewKpis).toBe(false);
      expect(p.canViewDepots).toBe(false);
    });

    it("channel IS locked to b2b", () => {
      expect(p.isChannelLocked).toBe(true);
      expect(p.lockedChannel).toBe("b2b");
    });
  });

  describe("negocio — total scope (Edgar Carvallo case)", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: "total" }));

    it("can view ventas, acciones, logistica, calendario", () => {
      expect(p.canViewSales).toBe(true);
      expect(p.canViewActions).toBe(true);
      expect(p.canViewLogistics).toBe(true);
      expect(p.canViewCalendar).toBe(true);
    });

    it("cannot view executive, kpis, depositos", () => {
      expect(p.canViewExecutive).toBe(false);
      expect(p.canViewKpis).toBe(false);
      expect(p.canViewDepots).toBe(false);
    });

    it("channel is NOT locked (total scope = free filters)", () => {
      expect(p.isChannelLocked).toBe(false);
      expect(p.lockedChannel).toBe("total");
    });
  });

  describe("null profile (not loaded)", () => {
    const p = derivePermissions(null);

    it("has no permissions", () => {
      expect(p.canViewExecutive).toBe(false);
      expect(p.canViewKpis).toBe(false);
      expect(p.canViewSales).toBe(false);
      expect(p.canViewActions).toBe(false);
      expect(p.canViewLogistics).toBe(false);
      expect(p.canViewDepots).toBe(false);
      expect(p.canViewCalendar).toBe(false);
      expect(p.canManageUsers).toBe(false);
    });

    it("channel is locked", () => {
      expect(p.isChannelLocked).toBe(true);
    });
  });

  describe("inactive user", () => {
    const p = derivePermissions(makeProfile({ role: "super_user", isActive: false }));

    it("has no permissions even with super_user role", () => {
      expect(p.canViewExecutive).toBe(false);
      expect(p.canManageUsers).toBe(false);
    });
  });
});

// ─── getDefaultRoute ────────────────────────────────────────────────────────────

describe("getDefaultRoute", () => {
  it("super_user → /", () => {
    const p = derivePermissions(makeProfile({ role: "super_user" }));
    expect(getDefaultRoute(p)).toBe("/");
  });

  it("gerencia → /", () => {
    const p = derivePermissions(makeProfile({ role: "gerencia" }));
    expect(getDefaultRoute(p)).toBe("/");
  });

  it("negocio → /ventas", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: "b2c" }));
    expect(getDefaultRoute(p)).toBe("/ventas");
  });

  it("null profile → /signin", () => {
    const p = derivePermissions(null);
    expect(getDefaultRoute(p)).toBe("/signin");
  });
});

// ─── derivePermissions — edge cases ──────────────────────────────────────────

describe("derivePermissions — edge cases", () => {
  describe("negocio — null channelScope (DB sin channel_scope)", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: null }));

    it("can view ventas, acciones, logistica, calendario", () => {
      expect(p.canViewSales).toBe(true);
      expect(p.canViewActions).toBe(true);
      expect(p.canViewLogistics).toBe(true);
      expect(p.canViewCalendar).toBe(true);
    });

    it("cannot view executive, kpis, depositos", () => {
      expect(p.canViewExecutive).toBe(false);
      expect(p.canViewKpis).toBe(false);
      expect(p.canViewDepots).toBe(false);
    });

    it("channel is NOT locked (null scope = free like total)", () => {
      expect(p.isChannelLocked).toBe(false);
      expect(p.lockedChannel).toBeNull();
    });
  });

  describe("inactive gerencia", () => {
    const p = derivePermissions(makeProfile({ role: "gerencia", isActive: false }));

    it("has no permissions even with gerencia role", () => {
      expect(p.canViewExecutive).toBe(false);
      expect(p.canViewKpis).toBe(false);
      expect(p.canViewSales).toBe(false);
      expect(p.canViewActions).toBe(false);
      expect(p.canViewLogistics).toBe(false);
      expect(p.canViewDepots).toBe(false);
      expect(p.canViewCalendar).toBe(false);
      expect(p.canManageUsers).toBe(false);
    });
  });

  describe("inactive negocio", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: "b2c", isActive: false }));

    it("has no permissions", () => {
      expect(p.canViewSales).toBe(false);
      expect(p.canViewActions).toBe(false);
      expect(p.isChannelLocked).toBe(true);
    });
  });

  describe("EMPTY_PERMISSIONS consistency", () => {
    const pNull = derivePermissions(null);
    const pInactive = derivePermissions(makeProfile({ isActive: false }));

    it("null profile and inactive profile produce identical permissions", () => {
      expect(pNull).toEqual(pInactive);
    });
  });

  describe("all view permissions are false for unauthenticated", () => {
    const p = derivePermissions(null);
    const viewKeys = [
      "canViewExecutive", "canViewKpis", "canViewSales",
      "canViewActions", "canViewLogistics", "canViewDepots", "canViewCalendar",
    ] as const;

    it.each(viewKeys)("%s is false", (key) => {
      expect(p[key]).toBe(false);
    });
  });
});

// ─── derivePermissions — security invariants ────────────────────────────────

describe("derivePermissions — security invariants", () => {
  it("only super_user can manage users", () => {
    const roles = ["super_user", "gerencia", "negocio"] as const;
    for (const role of roles) {
      const p = derivePermissions(makeProfile({ role, channelScope: role === "negocio" ? "total" : null }));
      if (role === "super_user") {
        expect(p.canManageUsers).toBe(true);
      } else {
        expect(p.canManageUsers).toBe(false);
      }
    }
  });

  it("negocio can never see executive pages regardless of scope", () => {
    const scopes = ["b2c", "b2b", "b2b_mayoristas", "b2b_utp", "total"] as const;
    for (const scope of scopes) {
      const p = derivePermissions(makeProfile({ role: "negocio", channelScope: scope }));
      expect(p.canViewExecutive).toBe(false);
      expect(p.canViewKpis).toBe(false);
      expect(p.canViewDepots).toBe(false);
    }
  });

  it("super_user and gerencia see all pages", () => {
    for (const role of ["super_user", "gerencia"] as const) {
      const p = derivePermissions(makeProfile({ role }));
      expect(p.canViewExecutive).toBe(true);
      expect(p.canViewKpis).toBe(true);
      expect(p.canViewSales).toBe(true);
      expect(p.canViewActions).toBe(true);
      expect(p.canViewLogistics).toBe(true);
      expect(p.canViewDepots).toBe(true);
      expect(p.canViewCalendar).toBe(true);
    }
  });

  it("locked channel only applies to negocio with specific scope", () => {
    // super_user / gerencia: never locked
    expect(derivePermissions(makeProfile({ role: "super_user" })).isChannelLocked).toBe(false);
    expect(derivePermissions(makeProfile({ role: "gerencia" })).isChannelLocked).toBe(false);

    // negocio with specific scope: locked
    expect(derivePermissions(makeProfile({ role: "negocio", channelScope: "b2c" })).isChannelLocked).toBe(true);
    expect(derivePermissions(makeProfile({ role: "negocio", channelScope: "b2b_mayoristas" })).isChannelLocked).toBe(true);
    expect(derivePermissions(makeProfile({ role: "negocio", channelScope: "b2b_utp" })).isChannelLocked).toBe(true);
    expect(derivePermissions(makeProfile({ role: "negocio", channelScope: "b2b" })).isChannelLocked).toBe(true);

    // negocio with total: NOT locked
    expect(derivePermissions(makeProfile({ role: "negocio", channelScope: "total" })).isChannelLocked).toBe(false);
  });
});

// ─── getDefaultRoute — edge cases ────────────────────────────────────────────

describe("getDefaultRoute — edge cases", () => {
  it("inactive super_user → /signin (no permissions)", () => {
    const p = derivePermissions(makeProfile({ role: "super_user", isActive: false }));
    expect(getDefaultRoute(p)).toBe("/signin");
  });

  it("inactive negocio → /signin", () => {
    const p = derivePermissions(makeProfile({ role: "negocio", channelScope: "b2c", isActive: false }));
    expect(getDefaultRoute(p)).toBe("/signin");
  });

  it("negocio with all channel scopes → /ventas", () => {
    for (const scope of ["b2c", "b2b", "b2b_mayoristas", "b2b_utp", "total"] as const) {
      const p = derivePermissions(makeProfile({ role: "negocio", channelScope: scope }));
      expect(getDefaultRoute(p)).toBe("/ventas");
    }
  });
});

// ─── getRoleLabel ───────────────────────────────────────────────────────────────

describe("getRoleLabel", () => {
  it("returns readable labels", () => {
    expect(getRoleLabel("super_user")).toBe("Super User");
    expect(getRoleLabel("gerencia")).toBe("Gerencia");
    expect(getRoleLabel("negocio")).toBe("Negocio");
  });
});
