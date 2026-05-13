import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { Customer, UUID } from "@/lib/types";

const NS = "customers:";

const SELECT = `
  id,
  companyId:company_id,
  title,
  firstName:first_name,
  lastName:last_name,
  companyName:company_name,
  email,
  homePhone:home_phone,
  mobilePhone:mobile_phone,
  postcode,
  addressLines:address_lines,
  marketingConsent:marketing_consent,
  notes,
  sourceOrigin:source_origin,
  createdAt:created_at,
  updatedAt:updated_at
`;

/** Match precedence — higher score = better match. */
export type CustomerMatchType = "phone" | "email" | "postcode" | "name";

export interface CustomerSearchResult {
  customer: Customer;
  matchType: CustomerMatchType;
  score: number;
}

interface CreateCustomerInput {
  companyId: UUID;
  title?: string | null;
  firstName: string;
  lastName: string;
  companyName?: string | null;
  email?: string | null;
  homePhone?: string | null;
  mobilePhone?: string | null;
  postcode?: string | null;
  addressLines?: string[];
  marketingConsent?: boolean;
  notes?: string | null;
  sourceOrigin?: string | null;
}

interface CannedAddress {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
}

/** Stub address book for the postcode lookup. Real integration is a follow-up. */
const POSTCODE_STUB: Record<string, CannedAddress> = {
  "UB1 3DZ": {
    line1: "220 Uxbridge Road",
    line2: "Southall",
    line3: "Greater London",
    line4: "UB1 3DZ",
  },
  "SW1A 1AA": {
    line1: "Buckingham Palace",
    line2: "",
    line3: "London",
    line4: "SW1A 1AA",
  },
  "NW10 6RS": {
    line1: "Wembley Distribution Centre",
    line2: "Mountbatten Way",
    line3: "London",
    line4: "NW10 6RS",
  },
};

function digitsOnly(s: string): string {
  return s.replace(/\D+/g, "");
}

function normPostcode(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

export const customerService = {
  async getAll(companyId: UUID): Promise<Customer[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Customer[];
    });
  },

  async getById(id: UUID): Promise<Customer | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Customer | null;
    });
  },

  /**
   * Best-effort dedup search. v1 fetches the full customer list and matches
   * client-side; for ~10k+ customers we'll swap in a Postgres FTS RPC. The
   * cache layer keeps the underlying `getAll` to one round-trip per 30s
   * regardless of how often the user types.
   */
  async searchCustomers(
    companyId: UUID,
    query: string,
    limit: number = 10,
  ): Promise<CustomerSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const all = await customerService.getAll(companyId);
    const qLower = q.toLowerCase();
    const qDigits = digitsOnly(q);
    const qPostcode = normPostcode(q);
    const results: CustomerSearchResult[] = [];

    for (const c of all) {
      // 1. Phone — digits-only contains query digits (when query has ≥3 digits).
      if (qDigits.length >= 3) {
        const mobileDigits = c.mobilePhone ? digitsOnly(c.mobilePhone) : "";
        const homeDigits = c.homePhone ? digitsOnly(c.homePhone) : "";
        if (
          mobileDigits.includes(qDigits) ||
          homeDigits.includes(qDigits)
        ) {
          results.push({ customer: c, matchType: "phone", score: 1.0 });
          continue;
        }
      }
      // 2. Email substring.
      if (c.email && c.email.toLowerCase().includes(qLower)) {
        results.push({ customer: c, matchType: "email", score: 0.95 });
        continue;
      }
      // 3. Postcode exact (whitespace-tolerant).
      if (c.postcode && normPostcode(c.postcode) === qPostcode) {
        results.push({ customer: c, matchType: "postcode", score: 0.85 });
        continue;
      }
      // 4. Name substring.
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const companyName = c.companyName?.toLowerCase() ?? "";
      if (fullName.includes(qLower) || companyName.includes(qLower)) {
        results.push({ customer: c, matchType: "name", score: 0.6 });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  /**
   * Insert a customer, unless a duplicate exists on `mobile_phone` OR `email`
   * within the company. Returns `wasExisting` so callers can show the right
   * toast ("created new customer" vs "added enquiry to existing customer").
   */
  async findOrCreateCustomer(
    companyId: UUID,
    input: CreateCustomerInput,
  ): Promise<{ customer: Customer; wasExisting: boolean }> {
    const supabase = createClient();

    // Try to find an existing match.
    if (input.email || input.mobilePhone) {
      const orFilters: string[] = [];
      if (input.email) orFilters.push(`email.eq.${input.email.toLowerCase()}`);
      if (input.mobilePhone) {
        const digits = digitsOnly(input.mobilePhone);
        if (digits.length >= 9) {
          orFilters.push(`mobile_phone.eq.${input.mobilePhone}`);
        }
      }
      if (orFilters.length > 0) {
        const { data: existing } = await supabase
          .from("customers")
          .select(SELECT)
          .eq("company_id", companyId)
          .or(orFilters.join(","))
          .limit(1)
          .maybeSingle();
        if (existing) {
          return {
            customer: existing as unknown as Customer,
            wasExisting: true,
          };
        }
      }
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        company_id: companyId,
        title: input.title ?? null,
        first_name: input.firstName,
        last_name: input.lastName,
        company_name: input.companyName ?? null,
        email: input.email?.toLowerCase() ?? null,
        home_phone: input.homePhone ?? null,
        mobile_phone: input.mobilePhone ?? null,
        postcode: input.postcode ?? null,
        address_lines: input.addressLines ?? [],
        marketing_consent: input.marketingConsent ?? true,
        notes: input.notes ?? null,
        source_origin: input.sourceOrigin ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return { customer: data as unknown as Customer, wasExisting: false };
  },

  async update(
    id: UUID,
    patch: Partial<
      Pick<
        Customer,
        | "title"
        | "firstName"
        | "lastName"
        | "companyName"
        | "email"
        | "homePhone"
        | "mobilePhone"
        | "postcode"
        | "addressLines"
        | "marketingConsent"
        | "notes"
      >
    >,
  ): Promise<Customer> {
    const supabase = createClient();
    const updates: TableUpdate<"customers"> = {};
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.firstName !== undefined) updates.first_name = patch.firstName;
    if (patch.lastName !== undefined) updates.last_name = patch.lastName;
    if (patch.companyName !== undefined) updates.company_name = patch.companyName;
    if (patch.email !== undefined) updates.email = patch.email?.toLowerCase() ?? null;
    if (patch.homePhone !== undefined) updates.home_phone = patch.homePhone;
    if (patch.mobilePhone !== undefined) updates.mobile_phone = patch.mobilePhone;
    if (patch.postcode !== undefined) updates.postcode = patch.postcode;
    if (patch.addressLines !== undefined) updates.address_lines = patch.addressLines;
    if (patch.marketingConsent !== undefined)
      updates.marketing_consent = patch.marketingConsent;
    if (patch.notes !== undefined) updates.notes = patch.notes;

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as Customer;
  },

  /**
   * Stub UK postcode lookup. Returns canned addresses for the three demo
   * postcodes; null otherwise. Swap in postcodes.io or getAddress.io later.
   */
  async lookupAddressByPostcode(
    postcode: string,
  ): Promise<CannedAddress | null> {
    const key = normPostcode(postcode);
    // simulate a 200ms network call so the spinner has time to render
    await new Promise((r) => setTimeout(r, 200));
    // Try exact + spaced variants.
    return (
      POSTCODE_STUB[postcode.trim().toUpperCase()] ??
      POSTCODE_STUB[key] ??
      Object.entries(POSTCODE_STUB).find(
        ([k]) => normPostcode(k) === key,
      )?.[1] ??
      null
    );
  },
};
