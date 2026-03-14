/**
 * Tests para queries/profile.queries.ts
 *
 * Verifica el fetch de perfil con todos los escenarios:
 *   - Fetch exitoso con mapeo correcto de campos
 *   - Error PGRST116 (sin perfil) → fallback seguro
 *   - Otros errores → throw (TanStack Query reintenta)
 *   - data null → fallback seguro
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock de authClient ─────────────────────────────────────────────────────
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }));

vi.mock("@/api/client", () => ({
  authClient: {
    from: (table: string) => mockFrom(table),
  },
}));

import { fetchProfile } from "../profile.queries";

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ single: mockSingle });
});

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const DB_ROW_SUPER_USER = {
  id: "uuid-super",
  role: "super_user",
  channel_scope: null,
  full_name: "Carlos Admin",
  cargo: "CEO",
  is_active: true,
};

const DB_ROW_NEGOCIO_B2C = {
  id: "uuid-negocio",
  role: "negocio",
  channel_scope: "b2c",
  full_name: "Ana Vendedora",
  cargo: "Ejecutiva",
  is_active: true,
};

const DB_ROW_GERENCIA = {
  id: "uuid-gerencia",
  role: "gerencia",
  channel_scope: null,
  full_name: "Roberto Gerente",
  cargo: "Director",
  is_active: true,
};

const DB_ROW_INACTIVE = {
  id: "uuid-inactive",
  role: "super_user",
  channel_scope: null,
  full_name: "Ex Empleado",
  cargo: "Ex-Dev",
  is_active: false,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("fetchProfile", () => {
  describe("successful fetch", () => {
    it("maps super_user profile correctly (snake_case → camelCase)", async () => {
      mockSingle.mockResolvedValue({ data: DB_ROW_SUPER_USER, error: null });
      const profile = await fetchProfile("uuid-super");

      expect(profile).toEqual({
        id: "uuid-super",
        role: "super_user",
        channelScope: null,
        fullName: "Carlos Admin",
        cargo: "CEO",
        isActive: true,
        mustChangePassword: false,
      });
    });

    it("maps negocio with b2c scope correctly", async () => {
      mockSingle.mockResolvedValue({ data: DB_ROW_NEGOCIO_B2C, error: null });
      const profile = await fetchProfile("uuid-negocio");

      expect(profile).toEqual({
        id: "uuid-negocio",
        role: "negocio",
        channelScope: "b2c",
        fullName: "Ana Vendedora",
        cargo: "Ejecutiva",
        isActive: true,
        mustChangePassword: false,
      });
    });

    it("maps gerencia profile correctly", async () => {
      mockSingle.mockResolvedValue({ data: DB_ROW_GERENCIA, error: null });
      const profile = await fetchProfile("uuid-gerencia");

      expect(profile).toEqual({
        id: "uuid-gerencia",
        role: "gerencia",
        channelScope: null,
        fullName: "Roberto Gerente",
        cargo: "Director",
        isActive: true,
        mustChangePassword: false,
      });
    });

    it("preserves isActive: false from DB", async () => {
      mockSingle.mockResolvedValue({ data: DB_ROW_INACTIVE, error: null });
      const profile = await fetchProfile("uuid-inactive");

      expect(profile.isActive).toBe(false);
      expect(profile.role).toBe("super_user");
    });
  });

  describe("queries the correct table and columns", () => {
    it("calls authClient.from('profiles') with correct select and eq", async () => {
      mockSingle.mockResolvedValue({ data: DB_ROW_SUPER_USER, error: null });
      await fetchProfile("uuid-super");

      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockSelect).toHaveBeenCalledWith("id, role, channel_scope, full_name, cargo, is_active, must_change_password");
      expect(mockEq).toHaveBeenCalledWith("id", "uuid-super");
    });
  });

  describe("PGRST116 — no profile row (legacy user)", () => {
    it("returns fallback with isActive: false (no access)", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
      });
      const profile = await fetchProfile("uuid-legacy");

      expect(profile.id).toBe("uuid-legacy");
      expect(profile.isActive).toBe(false);
      expect(profile.role).toBe("negocio");
      expect(profile.channelScope).toBeNull();
      expect(profile.fullName).toBe("");
      expect(profile.cargo).toBeNull();
    });

    it("does NOT throw (returns fallback gracefully)", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "no rows" },
      });

      await expect(fetchProfile("uuid-legacy")).resolves.toBeDefined();
    });
  });

  describe("other errors → throw (TanStack Query retries)", () => {
    it("throws on network/connection error", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "NETWORK", message: "Failed to fetch" },
      });

      await expect(fetchProfile("uuid-x")).rejects.toThrow("[fetchProfile] Failed to fetch (code: NETWORK)");
    });

    it("throws on RLS policy violation", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "42501", message: "new row violates row-level security policy" },
      });

      await expect(fetchProfile("uuid-x")).rejects.toThrow("42501");
    });

    it("throws on unknown error code", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "XXXXX", message: "Something unexpected" },
      });

      await expect(fetchProfile("uuid-x")).rejects.toThrow("Something unexpected");
    });

    it("throws on JWT expired error", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST301", message: "JWT expired" },
      });

      await expect(fetchProfile("uuid-x")).rejects.toThrow("JWT expired");
    });
  });

  describe("null data without error", () => {
    it("returns fallback with isActive: false", async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });
      const profile = await fetchProfile("uuid-null");

      expect(profile.id).toBe("uuid-null");
      expect(profile.isActive).toBe(false);
    });
  });

  describe("edge cases in DB data", () => {
    it("handles all channel_scope values", async () => {
      for (const scope of ["b2c", "b2b_mayoristas", "b2b_utp", "total", null]) {
        mockSingle.mockResolvedValue({
          data: { ...DB_ROW_NEGOCIO_B2C, id: "uuid-test", channel_scope: scope },
          error: null,
        });
        const profile = await fetchProfile("uuid-test");
        expect(profile.channelScope).toBe(scope);
      }
    });

    it("handles empty full_name", async () => {
      mockSingle.mockResolvedValue({
        data: { ...DB_ROW_SUPER_USER, full_name: "" },
        error: null,
      });
      const profile = await fetchProfile("uuid-super");
      expect(profile.fullName).toBe("");
    });

    it("handles null cargo", async () => {
      mockSingle.mockResolvedValue({
        data: { ...DB_ROW_SUPER_USER, cargo: null },
        error: null,
      });
      const profile = await fetchProfile("uuid-super");
      expect(profile.cargo).toBeNull();
    });

    it("maps must_change_password = true", async () => {
      mockSingle.mockResolvedValue({
        data: { ...DB_ROW_SUPER_USER, must_change_password: true },
        error: null,
      });
      const profile = await fetchProfile("uuid-super");
      expect(profile.mustChangePassword).toBe(true);
    });

    it("defaults mustChangePassword to false when missing", async () => {
      mockSingle.mockResolvedValue({
        data: { ...DB_ROW_SUPER_USER },
        error: null,
      });
      const profile = await fetchProfile("uuid-super");
      expect(profile.mustChangePassword).toBe(false);
    });
  });
});
