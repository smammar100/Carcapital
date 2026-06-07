/**
 * Username-based (no-email) login helpers — shared by the login page (client)
 * AND the team API routes (server). MUST stay client-safe: do NOT add
 * `server-only` and do not import server-only modules here.
 *
 * Staff at no-email dealerships log in with a username + password. Under the
 * hood each account carries an internal SYNTHETIC email that is never shown to
 * anyone:
 *     <username>@<dealership-slug>.<INTERNAL_EMAIL_DOMAIN>
 * created with `email_confirm: true` so Supabase never sends mail. The login
 * page derives the same address by pure string concat (no DB lookup → works
 * while unauthenticated, scales to any number of dealerships), and the create
 * route derives it from the signed-in admin's company slug — so the two always
 * agree.
 */

/** Internal, non-deliverable domain for synthetic addresses. Override per env. */
export const INTERNAL_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN ?? "staff.carcapital.uk";

/** Dealership slug assumed at /login when no `?org=` is present (single-tenant
 *  today; each dealership later gets its own `/login?org=<slug>` link). */
export const DEFAULT_ORG_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? "car-capital-uk";

// Mirrors the DB CHECK on users.username (migration 0026): lower-case, made of
// [a-z0-9._-], 3..32 chars, must start AND end alphanumeric.
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/;

/** Lower-case + trim an entered username / login identifier. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** True when `input` is a valid username per the DB constraint. */
export function isValidUsername(input: string): boolean {
  return USERNAME_RE.test(normalizeUsername(input));
}

/** A login identifier is treated as an email iff it contains "@". */
export function looksLikeEmail(input: string): boolean {
  return input.includes("@");
}

/**
 * Deterministic internal synthetic email for a (dealership slug, username) pair.
 * Used identically by the login page and the create route. Never shown to users.
 */
export function syntheticEmail(orgSlug: string, username: string): string {
  return `${normalizeUsername(username)}@${orgSlug}.${INTERNAL_EMAIL_DOMAIN}`;
}

/**
 * Suggest a username from a person's name: "Ahmed Khan" -> "ahmed.khan".
 * Best-effort only — the caller still validates with `isValidUsername`.
 */
export function suggestUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".") // runs of non-alphanumeric -> single dot
    .replace(/^\.+|\.+$/g, "") // trim leading/trailing dots
    .replace(/\.{2,}/g, ".") // collapse repeats
    .slice(0, 32);
}
