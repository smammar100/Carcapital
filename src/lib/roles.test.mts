/**
 * Unit tests for the role helpers — runs on Node's built-in test runner with
 * zero extra dependencies (Node 24 strips TypeScript types natively).
 * Run with `pnpm test` (see package.json) or directly:
 *   node --test src/lib/roles.test.mts
 *
 * Focused on `legacyRoleForRoles`, which underpins the invite/accept profile
 * provisioning fix (a1e3aef): `users.role` is NOT NULL and several UI filters
 * (salesperson / inspector pickers) still key off it, so the mapping from the
 * capability `roles[]` to the coarse legacy value must stay correct.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyRoleForRoles } from "./roles.ts";

test("owner maps to the owner legacy role", () => {
  assert.equal(legacyRoleForRoles(["owner"]), "owner");
});

test("administrator and iam_admin map to admin", () => {
  assert.equal(legacyRoleForRoles(["administrator"]), "admin");
  assert.equal(legacyRoleForRoles(["iam_admin"]), "admin");
});

test("operations roles keep their specific legacy value", () => {
  assert.equal(legacyRoleForRoles(["inventory_manager"]), "inventory_manager");
  assert.equal(legacyRoleForRoles(["inspector"]), "inspector");
  assert.equal(legacyRoleForRoles(["driver"]), "driver");
});

test("sales / specialist / view-only roles fall back to the sales catch-all", () => {
  for (const r of [
    "sales_specialist",
    "sales_manager",
    "finance_admin",
    "aftercare_specialist",
    "workshop_lead",
    "view_only",
  ] as const) {
    assert.equal(legacyRoleForRoles([r]), "sales", `${r} should map to sales`);
  }
});

test("priority order: the most privileged role wins in a multi-role set", () => {
  assert.equal(legacyRoleForRoles(["view_only", "owner"]), "owner");
  assert.equal(legacyRoleForRoles(["sales_specialist", "administrator"]), "admin");
  assert.equal(legacyRoleForRoles(["inspector", "driver"]), "inspector");
});

test("empty role set defaults to sales (never null — users.role is NOT NULL)", () => {
  assert.equal(legacyRoleForRoles([]), "sales");
});
