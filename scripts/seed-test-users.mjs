/**
 * Seed one test account per role for UAT (all 12 roles), with a shared
 * password so a tester can log in as each role from one credentials table.
 *
 *   node scripts/seed-test-users.mjs
 *
 * Idempotent: upserts by email. Existing seed users keep their identity; the
 * 6 missing roles are created. Every account: @carcapital.uk, is_demo=true,
 * password_reset_required=false, active=true. Uses the service-role key, so
 * run it yourself (the agent is blocked from prod-auth writes).
 *
 * Clean up afterwards with: node scripts/delete-test-users.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SHARED_PASSWORD = "CarCapUAT!2026";
const COMPANY_ID = "892d30bf-3599-4043-8f8c-ffc1642ab6f9"; // Car Capital UK

// role → { email, name, legacyRole }. The roles[] array drives all authority.
const ACCOUNTS = [
  { roles: ["owner"], email: "abbas@carcapital.uk", name: "Abbas Bhai", legacy: "owner", super: true },
  { roles: ["administrator"], email: "administrator@carcapital.uk", name: "Test Administrator", legacy: "admin" },
  { roles: ["iam_admin"], email: "iam.admin@carcapital.uk", name: "Test IAM Admin", legacy: "admin" },
  { roles: ["inventory_manager"], email: "amjad@carcapital.uk", name: "Amjad Bhai", legacy: "inventory_manager" },
  { roles: ["workshop_lead"], email: "shan@carcapital.uk", name: "Shan Bhai", legacy: "sales" },
  { roles: ["inspector"], email: "kami@carcapital.uk", name: "Kami", legacy: "inspector" },
  { roles: ["driver"], email: "raza@carcapital.uk", name: "Raza", legacy: "driver" },
  { roles: ["sales_specialist"], email: "sales.specialist@carcapital.uk", name: "Test Sales Specialist", legacy: "sales" },
  { roles: ["sales_manager"], email: "sikander@carcapital.uk", name: "Sikander", legacy: "sales" },
  { roles: ["finance_admin"], email: "finance.admin@carcapital.uk", name: "Test Finance Admin", legacy: "sales" },
  { roles: ["aftercare_specialist"], email: "aftercare@carcapital.uk", name: "Test Aftercare", legacy: "sales" },
  { roles: ["view_only"], email: "viewonly@carcapital.uk", name: "Test View Only", legacy: "sales" },
];

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Build an email → auth user id map (paginate through all auth users).
async function authUsersByEmail() {
  const map = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
    page++;
  }
  return map;
}

async function run() {
  const existing = await authUsersByEmail();
  const now = new Date().toISOString();
  const results = [];

  for (const acc of ACCOUNTS) {
    const email = acc.email.toLowerCase();
    let authId = existing.get(email);

    if (authId) {
      // Reset password so every test account shares one.
      const { error } = await admin.auth.admin.updateUserById(authId, {
        password: SHARED_PASSWORD,
        email_confirm: true,
      });
      if (error) { results.push([acc.roles[0], email, "AUTH UPDATE FAILED: " + error.message]); continue; }
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: SHARED_PASSWORD,
        email_confirm: true,
        user_metadata: { company_id: COMPANY_ID, name: acc.name, role: acc.legacy },
      });
      if (error || !data?.user) { results.push([acc.roles[0], email, "AUTH CREATE FAILED: " + (error?.message ?? "?")]); continue; }
      authId = data.user.id;
    }

    // Upsert the public.users profile (a trigger may have created a base row).
    const profile = {
      id: authId,
      company_id: COMPANY_ID,
      name: acc.name,
      email,
      role: acc.legacy,
      is_super_user: acc.super === true,
      roles: acc.roles,
      active: true,
      invited_at: null,
      accepted_at: now,
      two_step_enabled: false,
      creation_mode: "direct",
      password_reset_required: false,
      activated_at: now,
      is_demo: true,
    };
    const { error: upErr } = await admin.from("users").upsert(profile, { onConflict: "id" });
    if (upErr) { results.push([acc.roles[0], email, "PROFILE FAILED: " + upErr.message]); continue; }

    results.push([acc.roles[0], email, "ok"]);
  }

  console.log("\n=== Test accounts (shared password: " + SHARED_PASSWORD + ") ===\n");
  console.log("ROLE".padEnd(22), "EMAIL".padEnd(36), "STATUS");
  for (const [role, email, status] of results) {
    console.log(role.padEnd(22), email.padEnd(36), status);
  }
  console.log("\nLog in at /login. Each lands on its role's home page.\n");
}

run().catch((e) => { console.error(e); process.exit(1); });
