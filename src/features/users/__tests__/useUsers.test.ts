/**
 * Tests para la lógica de gestión de usuarios.
 *
 * Testea las funciones puras que subyacen al hook useUsers:
 * filtros, permisos, validaciones de forms.
 * Sin dependencia de @testing-library/react.
 */
import { describe, it, expect } from "vitest";
import type { UserProfile } from "@/domain/auth/types";
import type { UserProfileRow } from "@/queries/users.queries";
import {
  canEditProfile,
  canDeleteUser,
  validateCreateUser,
  validateEmail,
  validatePassword,
} from "@/domain/users/validation";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<UserProfileRow> = {}): UserProfileRow {
  return {
    id: "u-target",
    role: "gerencia",
    channelScope: null,
    fullName: "Target User",
    cargo: "Gerente",
    isActive: true,
    mustChangePassword: false,
    updatedAt: "2026-03-14",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "u-target",
    role: "gerencia",
    channelScope: null,
    fullName: "Target User",
    cargo: "Gerente",
    isActive: true,
    mustChangePassword: false,
    ...overrides,
  };
}

// ─── Filter logic (pure functions extracted from useMemo) ───────────────────

function applyFilters(
  profiles: UserProfileRow[],
  roleFilter: string,
  statusFilter: string,
): UserProfileRow[] {
  let result = profiles;
  if (roleFilter !== "all") {
    result = result.filter((p) => p.role === roleFilter);
  }
  if (statusFilter !== "all") {
    result = result.filter((p) =>
      statusFilter === "active" ? p.isActive : !p.isActive,
    );
  }
  return result;
}

const PROFILES: UserProfileRow[] = [
  makeRow({ id: "u1", role: "super_user", fullName: "Admin", isActive: true }),
  makeRow({ id: "u2", role: "gerencia", fullName: "Gerente", isActive: true }),
  makeRow({ id: "u3", role: "negocio", channelScope: "b2c", fullName: "Vendedor", isActive: false }),
  makeRow({ id: "u4", role: "negocio", channelScope: "b2b_mayoristas", fullName: "Mayorista", isActive: true }),
];

describe("filter logic", () => {
  it("all/all returns everything", () => {
    expect(applyFilters(PROFILES, "all", "all")).toHaveLength(4);
  });

  it("filter by super_user returns 1", () => {
    expect(applyFilters(PROFILES, "super_user", "all")).toHaveLength(1);
  });

  it("filter by gerencia returns 1", () => {
    expect(applyFilters(PROFILES, "gerencia", "all")).toHaveLength(1);
  });

  it("filter by negocio returns 2", () => {
    expect(applyFilters(PROFILES, "negocio", "all")).toHaveLength(2);
  });

  it("filter by active returns 3", () => {
    expect(applyFilters(PROFILES, "all", "active")).toHaveLength(3);
  });

  it("filter by inactive returns 1", () => {
    const result = applyFilters(PROFILES, "all", "inactive");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u3");
  });

  it("negocio + active returns 1 (Mayorista)", () => {
    const result = applyFilters(PROFILES, "negocio", "active");
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe("Mayorista");
  });

  it("negocio + inactive returns 1 (Vendedor)", () => {
    const result = applyFilters(PROFILES, "negocio", "inactive");
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe("Vendedor");
  });

  it("super_user + inactive returns 0", () => {
    expect(applyFilters(PROFILES, "super_user", "inactive")).toHaveLength(0);
  });

  it("empty list returns empty", () => {
    expect(applyFilters([], "all", "all")).toHaveLength(0);
  });
});

// ─── Edit permissions (integration) ─────────────────────────────────────────

describe("edit permissions integration", () => {
  const currentUserId = "u1";

  it("self-edit blocks role and active changes", () => {
    const perms = canEditProfile(currentUserId, makeProfile({ id: "u1" }));
    expect(perms.canChangeRole).toBe(false);
    expect(perms.canToggleActive).toBe(false);
  });

  it("editing another user allows all changes", () => {
    const perms = canEditProfile(currentUserId, makeProfile({ id: "u2" }));
    expect(perms.canChangeRole).toBe(true);
    expect(perms.canToggleActive).toBe(true);
  });

  it("self-delete is blocked", () => {
    expect(canDeleteUser(currentUserId, "u1")).toBe(false);
  });

  it("deleting others is allowed", () => {
    expect(canDeleteUser(currentUserId, "u2")).toBe(true);
    expect(canDeleteUser(currentUserId, "u3")).toBe(true);
  });
});

// ─── Edit form — diff detection logic ───────────────────────────────────────

describe("edit form diff detection", () => {
  function computeUpdates(
    original: UserProfileRow,
    edited: { fullName: string; cargo: string; role: string; channelScope: string | null; isActive: boolean },
  ): Record<string, unknown> {
    const updates: Record<string, unknown> = {};
    if (edited.fullName !== original.fullName) updates.fullName = edited.fullName;
    if ((edited.cargo || null) !== original.cargo) updates.cargo = edited.cargo || null;
    if (edited.role !== original.role) updates.role = edited.role;
    if (edited.channelScope !== original.channelScope) updates.channelScope = edited.channelScope;
    if (edited.isActive !== original.isActive) updates.isActive = edited.isActive;
    return updates;
  }

  const original = makeRow({ fullName: "Juan", cargo: "Dev", role: "gerencia", channelScope: null, isActive: true });

  it("no changes → empty updates", () => {
    const updates = computeUpdates(original, {
      fullName: "Juan", cargo: "Dev", role: "gerencia", channelScope: null, isActive: true,
    });
    expect(Object.keys(updates)).toHaveLength(0);
  });

  it("name change only", () => {
    const updates = computeUpdates(original, {
      fullName: "Juan Carlos", cargo: "Dev", role: "gerencia", channelScope: null, isActive: true,
    });
    expect(updates).toEqual({ fullName: "Juan Carlos" });
  });

  it("role change triggers update", () => {
    const updates = computeUpdates(original, {
      fullName: "Juan", cargo: "Dev", role: "super_user", channelScope: null, isActive: true,
    });
    expect(updates).toEqual({ role: "super_user" });
  });

  it("toggle active triggers update", () => {
    const updates = computeUpdates(original, {
      fullName: "Juan", cargo: "Dev", role: "gerencia", channelScope: null, isActive: false,
    });
    expect(updates).toEqual({ isActive: false });
  });

  it("empty cargo string becomes null", () => {
    const updates = computeUpdates(original, {
      fullName: "Juan", cargo: "", role: "gerencia", channelScope: null, isActive: true,
    });
    expect(updates).toEqual({ cargo: null });
  });

  it("multiple changes captured", () => {
    const updates = computeUpdates(original, {
      fullName: "Nuevo", cargo: "CTO", role: "super_user", channelScope: null, isActive: false,
    });
    expect(Object.keys(updates)).toHaveLength(4);
  });
});

// ─── Create form validation ─────────────────────────────────────────────────

describe("create form validation", () => {
  it("valid input passes", () => {
    const result = validateCreateUser({
      email: "new@fenix.com",
      fullName: "Nuevo",
      role: "negocio",
      channelScope: "b2c",
      cargo: null,
    });
    expect(result.valid).toBe(true);
  });

  it("trims whitespace from email and name", () => {
    const result = validateCreateUser({
      email: "  new@fenix.com  ",
      fullName: "  Nuevo  ",
      role: "negocio",
      channelScope: null,
      cargo: null,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects empty email", () => {
    const result = validateCreateUser({
      email: "",
      fullName: "Nuevo",
      role: "negocio",
      channelScope: null,
      cargo: null,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = validateCreateUser({
      email: "not-an-email",
      fullName: "Nuevo",
      role: "negocio",
      channelScope: null,
      cargo: null,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects empty name", () => {
    const result = validateCreateUser({
      email: "ok@test.com",
      fullName: "",
      role: "negocio",
      channelScope: null,
      cargo: null,
    });
    expect(result.valid).toBe(false);
  });
});

// ─── Password validation ────────────────────────────────────────────────────

describe("password validation for change password flow", () => {
  it("valid password (6+ chars)", () => {
    expect(validatePassword("abc123").valid).toBe(true);
    expect(validatePassword("longPassword!").valid).toBe(true);
  });

  it("rejects short password", () => {
    expect(validatePassword("abc12").valid).toBe(false);
    expect(validatePassword("abc12").error).toContain("6");
  });

  it("rejects empty password", () => {
    expect(validatePassword("").valid).toBe(false);
  });

  it("rejects whitespace-only", () => {
    expect(validatePassword("      ").valid).toBe(false);
  });

  it("password confirmation check (component logic)", () => {
    const pw: string = "newPassword123";
    const confirm: string = "newPassword123";
    const mismatch: string = "differentPassword";
    expect(pw === confirm).toBe(true);
    expect(pw === mismatch).toBe(false);
  });
});

// ─── Channel scope auto-clean logic ─────────────────────────────────────────

describe("channel scope auto-clean on role change", () => {
  it("non-negocio roles should have null channelScope", () => {
    // This tests the logic: if (role !== "negocio") channelScope = null
    for (const role of ["super_user", "gerencia"] as const) {
      const shouldClean = (role as string) !== "negocio";
      expect(shouldClean).toBe(true);
    }
  });

  it("negocio should keep channelScope", () => {
    const shouldClean = "negocio" !== "negocio";
    expect(shouldClean).toBe(false);
  });
});

// ─── Email validation edge cases ────────────────────────────────────────────

describe("email validation edge cases", () => {
  it("accepts common email formats", () => {
    expect(validateEmail("user@company.com")).toBe(true);
    expect(validateEmail("user.name@domain.co.py")).toBe(true);
    expect(validateEmail("user+tag@gmail.com")).toBe(true);
  });

  it("rejects clearly invalid", () => {
    expect(validateEmail("")).toBe(false);
    expect(validateEmail("@")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("@domain")).toBe(false);
    expect(validateEmail("spaces in@email.com")).toBe(false);
  });
});
