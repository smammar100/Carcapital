/**
 * Characterization tests — server-side permission helpers.
 * `requireUser()` is exercised through mocked supabase server/admin clients
 * (no Next request context needed once those modules are stubbed).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall } from "@/test/supabase-mock";

// --- Mutable per-test auth state ------------------------------------------
const state = {
  user: null as { id: string } | null,
  sessionUser: null as { id: string } | null,
  profile: null as Record<string, unknown> | null,
  grants: [] as Array<{ capability: string }>,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error("invalid JWT"),
      }),
      getSession: async () => ({
        data: {
          session: state.sessionUser ? { user: state.sessionUser } : null,
        },
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () =>
    createSupabaseMock((call: QueryCall) => {
      if (call.table === "users") return { data: state.profile, error: null };
      if (call.table === "user_permissions")
        return { data: state.grants, error: null };
      return undefined;
    }).client,
}));

import {
  AuthError,
  authErrorResponse,
  requireAnyCapability,
  requireCapability,
  requireUser,
  type AuthedActor,
} from "./require-user";

function actor(overrides: Partial<AuthedActor> = {}): AuthedActor {
  return {
    id: "user-1",
    companyId: "co-1",
    roles: [],
    isSuperUser: false,
    capabilities: new Set(),
    ...overrides,
  };
}

beforeEach(() => {
  state.user = { id: "user-1" };
  state.sessionUser = null;
  state.profile = {
    id: "user-1",
    company_id: "co-1",
    roles: ["driver"],
    is_super_user: false,
    active: true,
  };
  state.grants = [];
});

describe("requireCapability", () => {
  it("passes when the actor holds the capability", () => {
    const a = actor({ capabilities: new Set(["inventory:add"]) });
    expect(() => requireCapability(a, "inventory:add")).not.toThrow();
  });

  it("throws AuthError 403 with the capability named when missing", () => {
    try {
      requireCapability(actor(), "invoice:send");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).status).toBe(403);
      expect((e as AuthError).message).toBe(
        "Missing required permission: invoice:send",
      );
    }
  });

  it("super-user bypasses every check, even with zero capabilities", () => {
    const su = actor({ isSuperUser: true });
    expect(() => requireCapability(su, "admin:manage_users")).not.toThrow();
  });
});

describe("requireAnyCapability", () => {
  it("passes when ANY listed capability is held", () => {
    const a = actor({ capabilities: new Set(["warranty:edit"]) });
    expect(() =>
      requireAnyCapability(a, ["warranty:create", "warranty:edit"]),
    ).not.toThrow();
  });

  it("throws 403 listing all candidates when none held", () => {
    try {
      requireAnyCapability(actor(), ["warranty:create", "warranty:edit"]);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as AuthError).status).toBe(403);
      expect((e as AuthError).message).toBe(
        "Missing required permission: one of warranty:create, warranty:edit",
      );
    }
  });

  it("super-user bypasses", () => {
    expect(() =>
      requireAnyCapability(actor({ isSuperUser: true }), ["returns:create"]),
    ).not.toThrow();
  });
});

describe("authErrorResponse", () => {
  it("maps an AuthError to a JSON response with its status", async () => {
    const res = authErrorResponse(new AuthError(403, "nope"));
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: "nope" });
  });

  it("returns null for non-auth errors so callers rethrow", () => {
    expect(authErrorResponse(new Error("boom"))).toBeNull();
  });
});

describe("requireUser (mocked supabase)", () => {
  it("resolves roles into capabilities and merges explicit grants", async () => {
    state.grants = [{ capability: "invoice:send" }];
    const a = await requireUser();
    expect(a.id).toBe("user-1");
    expect(a.companyId).toBe("co-1");
    expect(a.roles).toEqual(["driver"]);
    expect(a.isSuperUser).toBe(false);
    expect([...a.capabilities].sort()).toEqual([
      "inventory:add", // from the driver role
      "invoice:send", // explicit user_permissions grant
    ]);
  });

  it("401s when neither getUser nor getSession yields a user", async () => {
    state.user = null;
    state.sessionUser = null;
    await expect(requireUser()).rejects.toMatchObject({
      name: "AuthError",
      status: 401,
    });
  });

  it("falls back to getSession when getUser fails (expired access token)", async () => {
    state.user = null;
    state.sessionUser = { id: "user-1" };
    const a = await requireUser();
    expect(a.id).toBe("user-1");
  });

  it("403s when there is no profile row", async () => {
    state.profile = null;
    await expect(requireUser()).rejects.toMatchObject({ status: 403 });
  });

  it("403s for a deactivated account", async () => {
    state.profile = { ...state.profile, active: false };
    await expect(requireUser()).rejects.toMatchObject({
      status: 403,
      message: "Account is deactivated",
    });
  });

  it("surfaces the super-user flag from the profile", async () => {
    state.profile = { ...state.profile, is_super_user: true, roles: [] };
    const a = await requireUser();
    expect(a.isSuperUser).toBe(true);
    expect(a.capabilities.size).toBe(0);
  });
});
