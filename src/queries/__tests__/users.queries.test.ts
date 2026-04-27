/**
 * Tests para queries/users.queries.ts
 *
 * Mock de Supabase client + fetch para testear fetch + update + create + delete.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAllProfiles,
  updateProfile,
  createUser,
  deleteUser,
} from "../users.queries";

// ─── Mock authClient ────────────────────────────────────────────────────────

let selectResult: { data: unknown[] | null; error: { message: string } | null } = { data: null, error: null };
let updateResult: { error: { message: string } | null } = { error: null };

const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/api/client", () => ({
  authClient: {
    from: vi.fn((table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table: ${table}`);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return { order: (...oArgs: unknown[]) => { mockOrder(...oArgs); return selectResult; } };
        },
        update: (...args: unknown[]) => {
          mockUpdate(...args);
          return { eq: (...eArgs: unknown[]) => { mockEq(...eArgs); return updateResult; } };
        },
      };
    }),
    auth: {
      getSession: () => Promise.resolve({
        data: { session: { access_token: "mock-token-123" } },
      }),
    },
  },
}));

// ─── Mock import.meta.env ───────────────────────────────────────────────────

vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "mock-anon-key");

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ────────────────────────────────────────────────────────────────

function setSelectResult(data: unknown[] | null, error: { message: string } | null = null) {
  selectResult = { data, error };
}

function setUpdateResult(error: { message: string } | null = null) {
  updateResult = { error };
}

function setFetchResult(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── fetchAllProfiles ───────────────────────────────────────────────────────

describe("fetchAllProfiles", () => {
  it("returns mapped profiles on success", async () => {
    setSelectResult([
      {
        id: "u1",
        role: "super_user",
        channel_scope: null,
        full_name: "Admin",
        cargo: "CTO",
        is_active: true,
        must_change_password: false,
        vendedor_codigo: null,
        updated_at: "2026-03-10T00:00:00Z",
      },
      {
        id: "u2",
        role: "negocio",
        channel_scope: "b2c",
        full_name: "Vendedor",
        cargo: null,
        is_active: false,
        must_change_password: true,
        vendedor_codigo: 7,
        updated_at: "2026-03-09T00:00:00Z",
      },
    ]);

    const result = await fetchAllProfiles();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "u1",
      role: "super_user",
      channelScope: null,
      fullName: "Admin",
      cargo: "CTO",
      isActive: true,
      mustChangePassword: false,
      vendedorCodigo: null,
      updatedAt: "2026-03-10T00:00:00Z",
    });
    expect(result[1]).toEqual({
      id: "u2",
      role: "negocio",
      channelScope: "b2c",
      fullName: "Vendedor",
      cargo: null,
      isActive: false,
      mustChangePassword: true,
      vendedorCodigo: 7,
      updatedAt: "2026-03-09T00:00:00Z",
    });
  });

  it("returns empty array when no data", async () => {
    setSelectResult(null);
    const result = await fetchAllProfiles();
    expect(result).toEqual([]);
  });

  it("throws on error", async () => {
    setSelectResult(null, { message: "RLS denied" });
    await expect(fetchAllProfiles()).rejects.toThrow("fetchAllProfiles: RLS denied");
  });

  it("handles missing optional fields with defaults", async () => {
    setSelectResult([
      {
        id: "u3",
        role: "gerencia",
        channel_scope: undefined,
        full_name: undefined,
        cargo: undefined,
        is_active: undefined,
        updated_at: undefined,
      },
    ]);

    const result = await fetchAllProfiles();
    expect(result[0].channelScope).toBeNull();
    expect(result[0].fullName).toBe("");
    expect(result[0].cargo).toBeNull();
    expect(result[0].isActive).toBe(true);
    expect(result[0].mustChangePassword).toBe(false);
    expect(result[0].updatedAt).toBe("");
  });
});

// ─── updateProfile ──────────────────────────────────────────────────────────

describe("updateProfile", () => {
  it("sends correct snake_case fields on full update", async () => {
    setUpdateResult(null);

    await updateProfile("u1", {
      fullName: "Nuevo Nombre",
      cargo: "Director",
      role: "gerencia",
      channelScope: null,
      isActive: false,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      full_name: "Nuevo Nombre",
      cargo: "Director",
      role: "gerencia",
      channel_scope: null,
      is_active: false,
    });
    expect(mockEq).toHaveBeenCalledWith("id", "u1");
  });

  it("sends only provided fields (partial update)", async () => {
    setUpdateResult(null);

    await updateProfile("u2", { role: "negocio" });

    expect(mockUpdate).toHaveBeenCalledWith({ role: "negocio" });
  });

  it("sends only isActive for toggle", async () => {
    setUpdateResult(null);

    await updateProfile("u3", { isActive: true });

    expect(mockUpdate).toHaveBeenCalledWith({ is_active: true });
  });

  it("throws on error", async () => {
    setUpdateResult({ message: "Permission denied" });

    await expect(
      updateProfile("u1", { role: "super_user" }),
    ).rejects.toThrow("updateProfile: Permission denied");
  });
});

// ─── createUser ─────────────────────────────────────────────────────────────

describe("createUser", () => {
  it("calls fetch with correct payload and headers", async () => {
    setFetchResult(200, { id: "new-uuid", email: "nuevo@fenix.com" });

    const result = await createUser({
      email: "nuevo@fenix.com",
      fullName: "Nuevo Usuario",
      role: "negocio",
      channelScope: "b2c",
      cargo: "Vendedor",
      vendedorCodigo: null,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.supabase.co/functions/v1/manage-user",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token-123",
        }),
      }),
    );

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      action: "create",
      email: "nuevo@fenix.com",
      fullName: "Nuevo Usuario",
      role: "negocio",
      channelScope: "b2c",
      cargo: "Vendedor",
      vendedorCodigo: null,
    });

    expect(result).toEqual({ id: "new-uuid", email: "nuevo@fenix.com" });
  });

  it("throws real error message on non-2xx (email already exists)", async () => {
    setFetchResult(400, { error: "El email ya está registrado" });

    await expect(
      createUser({
        email: "existing@fenix.com",
        fullName: "Duplicate",
        role: "gerencia",
        channelScope: null,
        cargo: null,
        vendedorCodigo: null,
      }),
    ).rejects.toThrow("El email ya está registrado");
  });

  it("throws real error message on 403 (permission denied)", async () => {
    setFetchResult(403, { error: "Sin permisos" });

    await expect(
      createUser({
        email: "test@test.com",
        fullName: "Test",
        role: "super_user",
        channelScope: null,
        cargo: null,
        vendedorCodigo: null,
      }),
    ).rejects.toThrow("Sin permisos");
  });

  it("throws real error message on 500 (server config)", async () => {
    setFetchResult(500, { error: "Configuración del servidor incompleta" });

    await expect(
      createUser({
        email: "test@test.com",
        fullName: "Test",
        role: "negocio",
        channelScope: null,
        cargo: null,
        vendedorCodigo: null,
      }),
    ).rejects.toThrow("Configuración del servidor incompleta");
  });

  it("throws on application error in body (2xx with error field)", async () => {
    setFetchResult(200, { error: "Profile update failed" });

    await expect(
      createUser({
        email: "test@test.com",
        fullName: "Test",
        role: "negocio",
        channelScope: null,
        cargo: null,
        vendedorCodigo: null,
      }),
    ).rejects.toThrow("Profile update failed");
  });

  it("sends null channelScope and cargo correctly", async () => {
    setFetchResult(200, { id: "uuid-2", email: "ger@test.com" });

    await createUser({
      email: "ger@test.com",
      fullName: "Gerente",
      role: "gerencia",
      channelScope: null,
      cargo: null,
      vendedorCodigo: null,
    });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.channelScope).toBeNull();
    expect(sentBody.cargo).toBeNull();
  });
});

// ─── deleteUser ─────────────────────────────────────────────────────────────

describe("deleteUser", () => {
  it("calls fetch with correct payload", async () => {
    setFetchResult(200, { success: true });

    await deleteUser("target-uuid");

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody).toEqual({ action: "delete", userId: "target-uuid" });
  });

  it("throws real error on user not found", async () => {
    setFetchResult(400, { error: "Usuario no encontrado" });

    await expect(deleteUser("nonexistent")).rejects.toThrow("Usuario no encontrado");
  });

  it("throws real error on permission denied", async () => {
    setFetchResult(403, { error: "Sin permisos" });

    await expect(deleteUser("uuid")).rejects.toThrow("Sin permisos");
  });

  it("falls back to status text when body has no error field", async () => {
    setFetchResult(502, {});

    await expect(deleteUser("uuid")).rejects.toThrow("Error 502");
  });
});
