/**
 * Tests para domain/users/validation.ts
 */
import { describe, it, expect } from "vitest";
import type { UserProfile } from "@/domain/auth/types";
import {
  canEditProfile,
  canDeleteUser,
  validateEmail,
  validateCreateUser,
  validatePassword,
  getChannelScopeLabel,
  getRoleBadgeStyle,
  getStatusBadgeStyle,
} from "../validation";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "target-uuid",
    role: "gerencia",
    channelScope: null,
    fullName: "Target User",
    cargo: "Gerente",
    isActive: true,
    mustChangePassword: false,
    ...overrides,
  };
}

// ─── canEditProfile ─────────────────────────────────────────────────────────

describe("canEditProfile", () => {
  it("blocks self-edit (both false)", () => {
    const result = canEditProfile("user-1", makeProfile({ id: "user-1" }));
    expect(result.canChangeRole).toBe(false);
    expect(result.canToggleActive).toBe(false);
  });

  it("allows editing another user (both true)", () => {
    const result = canEditProfile("user-1", makeProfile({ id: "user-2" }));
    expect(result.canChangeRole).toBe(true);
    expect(result.canToggleActive).toBe(true);
  });

  it("self-edit check is based on exact ID match", () => {
    const result = canEditProfile("user-1", makeProfile({ id: "user-10" }));
    expect(result.canChangeRole).toBe(true);
    expect(result.canToggleActive).toBe(true);
  });
});

// ─── canDeleteUser ──────────────────────────────────────────────────────────

describe("canDeleteUser", () => {
  it("blocks self-deletion", () => {
    expect(canDeleteUser("user-1", "user-1")).toBe(false);
  });

  it("allows deleting another user", () => {
    expect(canDeleteUser("user-1", "user-2")).toBe(true);
  });

  it("self-check is exact ID match (no substring)", () => {
    expect(canDeleteUser("user-1", "user-10")).toBe(true);
  });

  it("handles empty IDs", () => {
    expect(canDeleteUser("", "")).toBe(false);
    expect(canDeleteUser("", "user-1")).toBe(true);
    expect(canDeleteUser("user-1", "")).toBe(true);
  });
});

// ─── validateEmail ──────────────────────────────────────────────────────────

describe("validateEmail", () => {
  it.each([
    ["user@example.com", true],
    ["admin@fenixbrands.com.py", true],
    ["name+tag@domain.co", true],
    ["a@b.c", true],
  ])("valid: %s → %s", (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
  });

  it.each([
    ["", false],
    ["   ", false],
    ["not-an-email", false],
    ["@domain.com", false],
    ["user@", false],
    ["user@.com", false],
    ["user domain.com", false],
  ])("invalid: '%s' → %s", (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
  });

  it("trims whitespace before validating", () => {
    expect(validateEmail("  user@example.com  ")).toBe(true);
  });
});

// ─── validatePassword ───────────────────────────────────────────────────────

describe("validatePassword", () => {
  it("accepts 6+ character password", () => {
    const result = validatePassword("abc123");
    expect(result.valid).toBe(true);
  });

  it("accepts long password", () => {
    const result = validatePassword("mySecurePassword123!");
    expect(result.valid).toBe(true);
  });

  it("rejects empty password", () => {
    const result = validatePassword("");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects password shorter than 6 characters", () => {
    const result = validatePassword("abc12");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("6");
  });

  it("rejects whitespace-only password", () => {
    const result = validatePassword("      ");
    expect(result.valid).toBe(false);
  });
});

// ─── validateCreateUser ─────────────────────────────────────────────────────

describe("validateCreateUser", () => {
  const validInput = {
    email: "nuevo@fenix.com",
    fullName: "Nuevo Usuario",
    role: "negocio" as const,
    channelScope: null,
    cargo: null,
  };

  it("accepts valid input", () => {
    const result = validateCreateUser(validInput);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects empty email", () => {
    const result = validateCreateUser({ ...validInput, email: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("email");
  });

  it("rejects whitespace-only email", () => {
    const result = validateCreateUser({ ...validInput, email: "   " });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = validateCreateUser({ ...validInput, email: "not-email" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("email");
  });

  it("rejects empty fullName", () => {
    const result = validateCreateUser({ ...validInput, fullName: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("nombre");
  });

  it("rejects whitespace-only fullName", () => {
    const result = validateCreateUser({ ...validInput, fullName: "   " });
    expect(result.valid).toBe(false);
  });

  it("accepts all valid roles", () => {
    for (const role of ["super_user", "gerencia", "negocio"] as const) {
      const result = validateCreateUser({ ...validInput, role });
      expect(result.valid).toBe(true);
    }
  });

  it("accepts negocio with valid channel scopes", () => {
    for (const scope of ["b2c", "b2b", "b2b_mayoristas", "b2b_utp", "total"] as const) {
      const result = validateCreateUser({
        ...validInput,
        role: "negocio",
        channelScope: scope,
      });
      expect(result.valid).toBe(true);
    }
  });

  it("accepts negocio with null channel scope", () => {
    const result = validateCreateUser({
      ...validInput,
      role: "negocio",
      channelScope: null,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts non-negocio roles with null channel scope", () => {
    const result = validateCreateUser({
      ...validInput,
      role: "gerencia",
      channelScope: null,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts null cargo", () => {
    const result = validateCreateUser({ ...validInput, cargo: null });
    expect(result.valid).toBe(true);
  });

  it("accepts string cargo", () => {
    const result = validateCreateUser({ ...validInput, cargo: "Director" });
    expect(result.valid).toBe(true);
  });
});

// ─── getChannelScopeLabel ───────────────────────────────────────────────────

describe("getChannelScopeLabel", () => {
  it.each([
    ["b2c", "B2C"],
    ["b2b", "B2B (Mayoristas + UTP)"],
    ["b2b_mayoristas", "B2B Mayoristas"],
    ["b2b_utp", "B2B UTP"],
    ["total", "Total"],
    [null, "—"],
  ] as const)("scope %s → %s", (scope, expected) => {
    expect(getChannelScopeLabel(scope)).toBe(expected);
  });
});

// ─── getRoleBadgeStyle ──────────────────────────────────────────────────────

describe("getRoleBadgeStyle", () => {
  it("super_user returns purple classes", () => {
    expect(getRoleBadgeStyle("super_user")).toContain("purple");
  });

  it("gerencia returns blue classes", () => {
    expect(getRoleBadgeStyle("gerencia")).toContain("blue");
  });

  it("negocio returns emerald classes", () => {
    expect(getRoleBadgeStyle("negocio")).toContain("emerald");
  });

  it("all roles return non-empty strings", () => {
    for (const role of ["super_user", "gerencia", "negocio"] as const) {
      expect(getRoleBadgeStyle(role).length).toBeGreaterThan(0);
    }
  });
});

// ─── getStatusBadgeStyle ────────────────────────────────────────────────────

describe("getStatusBadgeStyle", () => {
  it("active returns green classes with 'Activo' text", () => {
    const result = getStatusBadgeStyle(true);
    expect(result.text).toBe("Activo");
    expect(result.className).toContain("green");
  });

  it("inactive returns red classes with 'Inactivo' text", () => {
    const result = getStatusBadgeStyle(false);
    expect(result.text).toBe("Inactivo");
    expect(result.className).toContain("red");
  });
});
