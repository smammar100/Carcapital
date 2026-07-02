import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { TeamJoinLink, UUID } from "@/lib/types";
import type { RoleValue } from "@/lib/roles";
import { activityService } from "./activity-service";

const NS = "join-link:";

const SELECT = `
  id,
  companyId:company_id,
  token,
  defaultRole:default_role,
  createdBy:created_by,
  createdAt:created_at,
  expiresAt:expires_at,
  maxUses:max_uses,
  usedCount:used_count,
  revokedAt:revoked_at
`;

/** Links live 72h from (re)creation — mirrors the DB default in 0033. */
const LINK_TTL_MS = 72 * 60 * 60 * 1000;

function freshExpiry(): string {
  return new Date(Date.now() + LINK_TTL_MS).toISOString();
}

/** Unguessable, readable slug — three base36 groups (~Glide style). */
function generateToken(): string {
  const rnd = new Uint32Array(3);
  crypto.getRandomValues(rnd);
  return [...rnd]
    .map((n) => n.toString(36).padStart(6, "0").slice(0, 6))
    .join("-");
}

export const joinLinkService = {
  async get(companyId: UUID): Promise<TeamJoinLink | null> {
    return withCache(`${NS}${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("team_join_links")
        .select(SELECT)
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as TeamJoinLink | null) ?? null;
    });
  },

  /** Return the company's link, creating one (View Only default) if absent. */
  async ensure(companyId: UUID, actorId: UUID): Promise<TeamJoinLink> {
    const existing = await joinLinkService.get(companyId);
    if (existing) return existing;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("team_join_links")
      .insert({
        company_id: companyId,
        token: generateToken(),
        default_role: "view_only" satisfies RoleValue,
        created_by: actorId,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as TeamJoinLink;
  },

  /** Rotate the token — the previous URL stops working immediately. */
  async reset(companyId: UUID, actorId: UUID): Promise<TeamJoinLink> {
    const supabase = createClient();
    const token = generateToken();
    // Upsert on the per-company unique constraint so reset also works when
    // no link exists yet. A reset is a fresh link: new 72h expiry, use
    // counter back to zero, any revocation cleared.
    const { data, error } = await supabase
      .from("team_join_links")
      .upsert(
        {
          company_id: companyId,
          token,
          default_role: "view_only" satisfies RoleValue,
          created_by: actorId,
          expires_at: freshExpiry(),
          used_count: 0,
          revoked_at: null,
        },
        { onConflict: "company_id" },
      )
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    await activityService.log({
      companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: "Reset the team join link",
      metadata: { joinLinkId: (data as unknown as TeamJoinLink).id },
    });
    return data as unknown as TeamJoinLink;
  },

  /** Kill the link without rotating — redemption stops until the next Reset. */
  async revoke(companyId: UUID, actorId: UUID): Promise<TeamJoinLink | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("team_join_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .select(SELECT)
      .maybeSingle();
    if (error) throw error;
    invalidate(NS);
    if (data) {
      await activityService.log({
        companyId,
        userId: actorId,
        vehicleId: null,
        actionType: "user_invited",
        description: "Revoked the team join link",
        metadata: { joinLinkId: (data as unknown as TeamJoinLink).id },
      });
    }
    return (data as unknown as TeamJoinLink | null) ?? null;
  },
};
