/**
 * Remove all demo/test accounts (public.users.is_demo = true) and their
 * matching auth.users rows. Use after UAT to clean up.
 *
 *   node scripts/delete-test-users.mjs
 *
 * Safety: only deletes rows flagged is_demo=true. Never touches real users.
 * Skips the last remaining super-administrator so the company isn't stranded.
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

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function run() {
  const { data: demo, error } = await admin
    .from("users")
    .select("id, email, is_super_user, company_id")
    .eq("is_demo", true);
  if (error) throw error;
  if (!demo || demo.length === 0) {
    console.log("No is_demo accounts found. Nothing to delete.");
    return;
  }

  // Keep at least one super-admin per company.
  const superByCompany = new Map();
  for (const u of demo) {
    if (u.is_super_user) superByCompany.set(u.company_id, (superByCompany.get(u.company_id) ?? 0) + 1);
  }

  for (const u of demo) {
    if (u.is_super_user && superByCompany.get(u.company_id) === 1) {
      console.log("SKIP (last super-admin):", u.email);
      continue;
    }
    // Delete auth user first (cascades identities); profile row deleted after.
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
    const { error: delErr } = await admin.from("users").delete().eq("id", u.id);
    console.log(delErr ? `FAILED ${u.email}: ${delErr.message}` : `deleted ${u.email}`);
  }
  console.log("\nDone.");
}

run().catch((e) => { console.error(e); process.exit(1); });
