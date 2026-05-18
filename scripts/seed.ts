/**
 * One-shot seed for the Supabase database. Idempotent: bails if `companies`
 * is non-empty. Run via:
 *   pnpm dlx tsx --env-file=.env.local scripts/seed.ts
 *
 * Strategy:
 *   1. Generate fresh UUIDs for every mock record (mock IDs aren't UUIDs).
 *   2. Build oldId → newId maps so FKs can be rewritten on the fly.
 *   3. Insert in dependency order using the service-role client (bypasses RLS).
 *   4. For users, create auth.users via the admin API first and reuse that id
 *      as the public.users id (1:1 relationship per the schema).
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  mockCompanies,
  mockUsers,
  mockUserPermissions,
  mockVendors,
  mockVehicles,
  mockTodos,
  mockMaintenanceJobs,
  mockWorkshopJobs,
  mockListings,
  mockLeads,
  mockAppointments,
  mockSalesDeals,
  mockWarranties,
  mockClaims,
  mockInvoices,
  mockReturns,
  mockActivityLog,
  mockNotifications,
  mockCustomers,
  mockEnquiries,
} from "../src/lib/mock-data";

const SHARED_PASSWORD = "CarCap!demo1";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check .env.local.",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Maps from the mock string id ("company-1", "user-3", "vehicle-12", …) to the
// freshly minted Postgres UUID. Populated as we insert each entity.
const idMap = {
  company: new Map<string, string>(),
  user: new Map<string, string>(),
  vendor: new Map<string, string>(),
  vehicle: new Map<string, string>(),
  lead: new Map<string, string>(),
  appointment: new Map<string, string>(),
  deal: new Map<string, string>(),
  maint: new Map<string, string>(),
  workshopJob: new Map<string, string>(),
  listing: new Map<string, string>(),
  invoice: new Map<string, string>(),
  warranty: new Map<string, string>(),
  claim: new Map<string, string>(),
  vehicleReturn: new Map<string, string>(),
  todo: new Map<string, string>(),
  activity: new Map<string, string>(),
  notification: new Map<string, string>(),
  permission: new Map<string, string>(),
  customer: new Map<string, string>(),
  enquiry: new Map<string, string>(),
};

const lookup = (map: Map<string, string>, id: string | null | undefined): string | null => {
  if (id == null) return null;
  const v = map.get(id);
  if (!v) throw new Error(`Missing mapping for id: ${id}`);
  return v;
};

async function alreadySeeded(): Promise<boolean> {
  const { count, error } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error("Failed to query companies:", error);
    process.exit(1);
  }
  return (count ?? 0) > 0;
}

/**
 * Idempotent delta seed for warranties + claims, used when the main seed has
 * already run but new mock rows have been added since. Skips any row whose
 * `customer_name + start_date` already exists in the DB.
 */
async function seedWarrantyDelta(): Promise<void> {
  console.log("ℹ️  Main seed already ran. Running warranty/claim delta pass…");

  // Need a company + vehicle id lookup table. We pivot via registration.
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .limit(1)
    .single();
  if (!companies) {
    console.error("No company found — run a fresh seed first.");
    process.exit(1);
  }
  const companyId = (companies as { id: string }).id;

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, registration")
    .eq("company_id", companyId);
  const vehicleByReg = new Map<string, string>();
  for (const v of (vehicles ?? []) as { id: string; registration: string }[]) {
    vehicleByReg.set(v.registration, v.id);
  }

  // Map mock vehicleId → real DB UUID via mockVehicles.registration.
  function resolveVehicleId(mockId: string): string | null {
    const mv = mockVehicles.find((v) => v.id === mockId);
    if (!mv) return null;
    return vehicleByReg.get(mv.registration) ?? null;
  }

  // Existing warranties keyed by customer_name|start_date for idempotency.
  const { data: existingWarranties } = await supabase
    .from("warranties")
    .select("id, customer_name, start_date")
    .eq("company_id", companyId);
  const existingWarrantyKey = new Set(
    (existingWarranties ?? []).map(
      (w: { customer_name: string; start_date: string }) =>
        `${w.customer_name}|${w.start_date}`,
    ),
  );

  let addedWarranties = 0;
  const newWarrantyIdByMockId = new Map<string, string>();

  for (const w of mockWarranties) {
    const key = `${w.customerName}|${w.startDate}`;
    if (existingWarrantyKey.has(key)) continue;
    const vehicleId = resolveVehicleId(w.vehicleId);
    if (!vehicleId) {
      console.warn(`  ⚠ Skipping warranty for ${w.customerName} — vehicle ${w.vehicleId} not in DB`);
      continue;
    }
    const newId = randomUUID();
    const { error } = await supabase.from("warranties").insert({
      id: newId,
      company_id: companyId,
      vehicle_id: vehicleId,
      sale_deal_id: null,
      customer_name: w.customerName,
      customer_phone: w.customerPhone,
      customer_email: w.customerEmail,
      type: w.type,
      provider: w.provider,
      coverage_details: w.coverageDetails,
      start_date: w.startDate,
      end_date: w.endDate,
      cost_to_dealership: w.costToDealership,
      cost_to_customer: w.costToCustomer,
      status: w.status,
      purchase_status: w.purchaseStatus,
      purchased_at: w.purchasedAt,
      // purchased_by left null — purchased rows in seed reference mock user IDs
      // that don't exist in this delta pass; UI will show "—" until backfilled.
      purchased_by: null,
      provider_reference: w.providerReference,
      certificate_generated: w.certificateGenerated,
      created_at: w.createdAt,
    });
    if (error) {
      console.warn(`  ✗ ${w.customerName}: ${error.message}`);
      continue;
    }
    newWarrantyIdByMockId.set(w.id, newId);
    addedWarranties += 1;
    console.log(`  ✓ Warranty: ${w.customerName} (${w.type}, ${w.startDate})`);
  }

  // Claims delta — match by issue_description prefix.
  const { data: existingClaims } = await supabase
    .from("warranty_claims")
    .select("issue_description")
    .eq("company_id", companyId);
  const existingClaimSet = new Set(
    (existingClaims ?? []).map(
      (c: { issue_description: string }) => c.issue_description,
    ),
  );

  let addedClaims = 0;
  for (const c of mockClaims) {
    if (existingClaimSet.has(c.issueDescription)) continue;
    // The claim's parent warranty may be one we just inserted, or already in DB.
    let warrantyId = newWarrantyIdByMockId.get(c.warrantyId);
    if (!warrantyId) {
      const mw = mockWarranties.find((x) => x.id === c.warrantyId);
      if (mw) {
        const { data: row } = await supabase
          .from("warranties")
          .select("id")
          .eq("company_id", companyId)
          .eq("customer_name", mw.customerName)
          .eq("start_date", mw.startDate)
          .maybeSingle();
        warrantyId = (row as { id: string } | null)?.id;
      }
    }
    if (!warrantyId) {
      console.warn(`  ⚠ Skipping claim — parent warranty not found`);
      continue;
    }
    const vehicleId = resolveVehicleId(c.vehicleId);
    if (!vehicleId) continue;
    const { error } = await supabase.from("warranty_claims").insert({
      id: randomUUID(),
      warranty_id: warrantyId,
      vehicle_id: vehicleId,
      company_id: companyId,
      customer_name: c.customerName,
      issue_description: c.issueDescription,
      is_complaint: c.isComplaint,
      estimated_cost: c.estimatedCost,
      actual_cost: c.actualCost,
      status: c.status,
      resolution: c.resolution,
      created_at: c.createdAt,
      resolved_at: c.resolvedAt,
    });
    if (error) {
      console.warn(`  ✗ Claim "${c.issueDescription.slice(0, 40)}…": ${error.message}`);
      continue;
    }
    addedClaims += 1;
    console.log(`  ✓ Claim: ${c.customerName} — ${c.issueDescription.slice(0, 40)}…`);
  }

  console.log(`\n✅ Delta complete: +${addedWarranties} warranties, +${addedClaims} claims.`);
}

/**
 * Idempotent delta seed for customers + enquiries — runs when the main seed
 * has already happened and we've added new mock rows since.
 *
 * Skip rules:
 *   - Customer skipped if a row with the same (company_id, email) OR
 *     (company_id, mobile_phone) already exists.
 *   - Enquiry skipped if a row with the same customer_id + created_at +
 *     source already exists (close-enough fingerprint for seed data).
 */
async function seedCustomerEnquiryDelta(): Promise<void> {
  console.log("ℹ️  Running customer/enquiry delta pass…");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .limit(1)
    .single();
  if (!companies) {
    console.error("No company found — run a fresh seed first.");
    process.exit(1);
  }
  const companyId = (companies as { id: string }).id;

  // Vehicle id resolution via registration (same trick as warranty delta).
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, registration")
    .eq("company_id", companyId);
  const vehicleByReg = new Map<string, string>();
  for (const v of (vehicles ?? []) as { id: string; registration: string }[]) {
    vehicleByReg.set(v.registration, v.id);
  }
  function resolveVehicleId(mockId: string | null): string | null {
    if (!mockId) return null;
    const mv = mockVehicles.find((v) => v.id === mockId);
    if (!mv) return null;
    return vehicleByReg.get(mv.registration) ?? null;
  }

  // User id resolution via email.
  const { data: dbUsers } = await supabase
    .from("users")
    .select("id, email")
    .eq("company_id", companyId);
  const userByEmail = new Map<string, string>();
  for (const u of (dbUsers ?? []) as { id: string; email: string }[]) {
    userByEmail.set(u.email, u.id);
  }
  function resolveUserId(mockId: string): string | null {
    const mu = mockUsers.find((u) => u.id === mockId);
    if (!mu) return null;
    return userByEmail.get(mu.email) ?? null;
  }

  // Customers — idempotency via email + mobile_phone.
  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("id, email, mobile_phone")
    .eq("company_id", companyId);
  const existingEmails = new Set(
    (existingCustomers ?? [])
      .map((c: { email: string | null }) => c.email?.toLowerCase())
      .filter(Boolean),
  );
  const existingMobiles = new Set(
    (existingCustomers ?? [])
      .map((c: { mobile_phone: string | null }) => c.mobile_phone)
      .filter(Boolean),
  );

  // Local mock-id → DB-uuid map for the rows we insert during this run.
  const customerIdByMockId = new Map<string, string>();

  // Also resolve already-present customers so enquiries can reference them.
  const { data: allCustomers } = await supabase
    .from("customers")
    .select("id, email, mobile_phone")
    .eq("company_id", companyId);
  function resolveCustomerId(mockCustomerId: string): string | null {
    if (customerIdByMockId.has(mockCustomerId)) {
      return customerIdByMockId.get(mockCustomerId)!;
    }
    const mc = mockCustomers.find((c) => c.id === mockCustomerId);
    if (!mc) return null;
    const hit = (allCustomers ?? []).find(
      (row: { email: string | null; mobile_phone: string | null }) =>
        (mc.email && row.email?.toLowerCase() === mc.email.toLowerCase()) ||
        (mc.mobilePhone && row.mobile_phone === mc.mobilePhone),
    );
    return (hit as { id: string } | undefined)?.id ?? null;
  }

  let addedCustomers = 0;
  for (const c of mockCustomers) {
    const emailHit = c.email && existingEmails.has(c.email.toLowerCase());
    const mobileHit = c.mobilePhone && existingMobiles.has(c.mobilePhone);
    if (emailHit || mobileHit) continue;
    const newId = randomUUID();
    const { error } = await supabase.from("customers").insert({
      id: newId,
      company_id: companyId,
      title: c.title,
      first_name: c.firstName,
      last_name: c.lastName,
      company_name: c.companyName,
      email: c.email?.toLowerCase() ?? null,
      home_phone: c.homePhone,
      mobile_phone: c.mobilePhone,
      postcode: c.postcode,
      address_lines: c.addressLines,
      marketing_consent: c.marketingConsent,
      notes: c.notes,
      source_origin: c.sourceOrigin,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    });
    if (error) {
      console.warn(`  ✗ Customer ${c.firstName} ${c.lastName}: ${error.message}`);
      continue;
    }
    customerIdByMockId.set(c.id, newId);
    if (c.email) existingEmails.add(c.email.toLowerCase());
    if (c.mobilePhone) existingMobiles.add(c.mobilePhone);
    addedCustomers += 1;
    console.log(`  ✓ Customer: ${c.firstName} ${c.lastName}`);
  }

  // Enquiries — idempotency via (customer_id, source, type, notes). The
  // (customer_id, created_at) pair would be cleaner but timezone-shifted
  // timestamps round-trip with microsecond fuzz against the original ISO
  // strings, so we use a content fingerprint instead.
  const { data: existingEnquiries } = await supabase
    .from("enquiries")
    .select("customer_id, source, type, notes")
    .eq("company_id", companyId);
  const enquiryKey = new Set(
    (existingEnquiries ?? []).map(
      (e: { customer_id: string; source: string; type: string; notes: string | null }) =>
        `${e.customer_id}|${e.source}|${e.type}|${e.notes ?? ""}`,
    ),
  );

  let addedEnquiries = 0;
  for (const e of mockEnquiries) {
    const customerId = resolveCustomerId(e.customerId);
    if (!customerId) {
      console.warn(`  ⚠ Skipping enquiry — customer ${e.customerId} not in DB`);
      continue;
    }
    const key = `${customerId}|${e.source}|${e.type}|${e.notes ?? ""}`;
    if (enquiryKey.has(key)) continue;
    const vehicleId = resolveVehicleId(e.vehicleId);
    const salespersonId = resolveUserId(e.salespersonId);
    if (!salespersonId) {
      console.warn(`  ⚠ Skipping enquiry — salesperson ${e.salespersonId} not in DB`);
      continue;
    }
    const { error } = await supabase.from("enquiries").insert({
      id: randomUUID(),
      company_id: companyId,
      customer_id: customerId,
      vehicle_id: vehicleId,
      source: e.source,
      type: e.type,
      status: e.status,
      lost_reason: e.lostReason,
      salesperson_id: salespersonId,
      finance_interest: e.financeInterest,
      next_action_due_at: e.nextActionDueAt,
      notes: e.notes,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
    });
    if (error) {
      console.warn(`  ✗ Enquiry ${e.id}: ${error.message}`);
      continue;
    }
    addedEnquiries += 1;
    console.log(`  ✓ Enquiry: ${e.source} / ${e.type} for customer ${e.customerId}`);
  }

  console.log(
    `\n✅ Delta complete: +${addedCustomers} customers, +${addedEnquiries} enquiries.`,
  );
}

/**
 * SPEC_Invoicing_Module §9 — the reference DL68 Mercedes + CC-INV-0001
 * sales invoice (matches Car_Capital_Sales_Invoice.pdf). Idempotent:
 * upserts by registration / invoice_number so re-runs are no-ops.
 */
async function seedInvoiceDl68Delta(): Promise<void> {
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .single();
  if (!company) return;
  const companyId = (company as { id: string }).id;

  const { data: owner } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_super_user", true)
    .limit(1)
    .single();
  const ownerId = (owner as { id: string } | null)?.id ?? null;

  // Upsert the DL68 vehicle by registration.
  let vehicleId: string;
  const { data: existingVeh } = await supabase
    .from("vehicles")
    .select("id")
    .eq("company_id", companyId)
    .eq("registration", "DL68 FUT")
    .maybeSingle();
  if (existingVeh) {
    vehicleId = (existingVeh as { id: string }).id;
  } else {
    vehicleId = randomUUID();
    const { error } = await supabase.from("vehicles").insert({
      id: vehicleId,
      company_id: companyId,
      registration: "DL68 FUT",
      stock_id: "CC-DL68",
      make: "MERCEDES-BENZ",
      model: "A-CLASS",
      variant_code: "1.3 A200 Sport (Executive)",
      year: 2019,
      colour: "Grey",
      mileage: 45505,
      vehicle_type: "car",
      body_type: "hatchback",
      fuel_type: "petrol",
      transmission: "automatic",
      received_date: "2026-04-20",
      received_by: ownerId,
      seller_name: "BCA Auction",
      seller_phone: "01234567890",
      source_type: "auction",
      local_or_import: "local",
      service_history: "partial",
      finance_provider: "close_brothers",
      status: "sold",
      vin: "WDD1770872J077062",
      first_registered_date: "2019-02-20",
      lock_nut: true,
      num_keys: 2,
      v5_received: true,
      selling_price: 13850,
      date_sold: "2026-05-04",
      listing_price: 14990,
    } as never);
    if (error) {
      console.warn(`  ⚠ DL68 vehicle insert skipped: ${error.message}`);
      return;
    }
  }

  const { data: existingInv } = await supabase
    .from("invoices")
    .select("id")
    .eq("company_id", companyId)
    .eq("invoice_number", "CC-INV-0001")
    .maybeSingle();
  if (existingInv) {
    console.log("  ✓ CC-INV-0001 already present.");
    return;
  }

  const invoiceId = randomUUID();
  const warranty = {
    provider: "Car Capital Ltd",
    providerPhone: "02088434878",
    providerEmail: "info@thecarcapital.co.uk",
    coverType: "Premier",
    claimLimit: 2000,
    diagnosticsCover: 60,
    duration: "3 Months",
    excessPercent: 10,
    wearTearCovered: false,
  };
  const pdc = {
    engineStarts: true, engineNoise: true, transmission: true,
    noiseNormal: true, clutch: true, steering: true, bodyCondition: true,
    bodySuspension: true, brakes: true, gauges: true, warningLights: true,
    exhaust: true, exteriorLights: true, serviceLight: true,
    lockNut: true, numKeys: 2, serviceHistoryStatus: "Full - Provided",
    engineServiceDoneDate: "2026-04-27", engineServiceDoneMileage: 45505,
    v5Status: "V5C-2 Green Slip", hpiCheckResult: "Clear",
  };
  const { error: invErr } = await supabase.from("invoices").insert({
    id: invoiceId,
    company_id: companyId,
    type: "sale",
    vehicle_id: vehicleId,
    party_name: "MR GURSIMRAN SINGH",
    party_phone: "7748365859",
    party_email: "gursimransinghguruwali@gmail.com",
    buyer_name: "MR GURSIMRAN SINGH",
    buyer_phone: "7748365859",
    buyer_email: "gursimransinghguruwali@gmail.com",
    buyer_address: "38 WARLEY ROAD, HAYES",
    buyer_postcode: "UB4 0QH",
    invoice_number: "CC-INV-0001",
    invoice_date: "2026-05-04",
    vat_scheme: "margin_used",
    subtotal: 13850,
    addons_total: 0,
    discount_total: -440,
    vat_amount: 0,
    total: 13850,
    present_mileage: 45505,
    dor_date: "2019-02-20",
    sales_price: 14290,
    discount: 440,
    paid_addons_total: 0,
    grand_total_incl_addons: 13850,
    deposit_amount: 4000,
    deposit_received_date: "2025-05-04",
    deposit_method: "bank_transfer",
    finance_amount: 9850,
    finance_provider: "Close Brothers",
    balance_due: 0,
    warranty,
    non_warranty_disclaimer_accepted: false,
    pre_delivery_check: pdc,
    include_unit_stocking_note: true,
    include_id_requirement_note: true,
    include_service_history_note: true,
    status: "issued",
    created_by: ownerId,
    issued_at: new Date().toISOString(),
  } as never);
  if (invErr) {
    console.warn(`  ⚠ CC-INV-0001 insert skipped: ${invErr.message}`);
    return;
  }

  await supabase.from("invoice_line_items").insert([
    { invoice_id: invoiceId, line_type: "vehicle", item_type: "vehicle_price", description: "SALES PRICE", quantity: 1, unit_price: 14290, vat_rate: 0, subtotal: 14290, vat_amount: 0, sort_order: 0 },
    { invoice_id: invoiceId, line_type: "discount", item_type: "discount", description: "DISCOUNT", quantity: 1, unit_price: 440, vat_rate: 0, subtotal: 440, vat_amount: 0, sort_order: 1 },
    { invoice_id: invoiceId, line_type: "addon", addon_type: "warranty", item_type: "addon_free", addon_category: "warranty", description: "3 MONTH COMPREHENSIVE WARRANTY - BACK TO BASE", quantity: 1, unit_price: 0, vat_rate: 0, subtotal: 0, vat_amount: 0, sort_order: 2 },
    { invoice_id: invoiceId, line_type: "addon", addon_type: "service_pack", item_type: "addon_free", addon_category: "service_pack", description: "FRESH OIL SERVICE", quantity: 1, unit_price: 0, vat_rate: 0, subtotal: 0, vat_amount: 0, sort_order: 3 },
    { invoice_id: invoiceId, line_type: "addon", addon_type: "custom", item_type: "addon_free", addon_category: "custom", description: "LONG MOT", quantity: 1, unit_price: 0, vat_rate: 0, subtotal: 0, vat_amount: 0, sort_order: 4 },
  ] as never);
  await supabase.from("invoice_payments").insert({
    invoice_id: invoiceId,
    deposit_amount: 4000,
    deposit_method: "bank_transfer",
    finance_amount: 9850,
    finance_provider: "Close Brothers",
    balance_due: 0,
    balance_due_by: null,
  } as never);
  await supabase
    .from("companies")
    .update({ next_cc_inv_seq: 2 } as never)
    .eq("id", companyId);
  console.log("  ✓ Seeded DL68 Mercedes + CC-INV-0001.");
}

async function main() {
  if (await alreadySeeded()) {
    await seedWarrantyDelta();
    await seedCustomerEnquiryDelta();
    await seedInvoiceDl68Delta();
    return;
  }

  console.log("→ Seeding companies…");
  for (const c of mockCompanies) {
    const newId = randomUUID();
    idMap.company.set(c.id, newId);
    const highestStockSeq = Math.max(
      c.nextStockSeq,
      ...mockVehicles
        .filter((v) => v.companyId === c.id)
        .map((v) => parseInt(v.stockId.split("-")[1] ?? "0", 10)),
    );
    const purchaseInvoices = mockInvoices.filter(
      (i) => i.companyId === c.id && i.type === "purchase",
    ).length;
    const saleInvoices = mockInvoices.filter(
      (i) => i.companyId === c.id && i.type === "sale",
    ).length;
    const { error } = await supabase.from("companies").insert({
      id: newId,
      name: c.name,
      address: c.address,
      vat_number: c.vatNumber,
      logo_url: c.logoUrl,
      stock_id_prefix: c.stockIdPrefix,
      next_stock_seq: highestStockSeq + 1,
      next_purchase_invoice_seq: purchaseInvoices + 1,
      next_sale_invoice_seq: saleInvoices + 1,
    });
    if (error) throw error;
  }

  console.log("→ Seeding users (auth + public.users)…");
  for (const u of mockUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: SHARED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    if (error || !data.user) {
      throw error ?? new Error(`createUser returned no user for ${u.email}`);
    }
    idMap.user.set(u.id, data.user.id);
    const { error: insErr } = await supabase.from("users").insert({
      id: data.user.id,
      company_id: lookup(idMap.company, u.companyId)!,
      name: u.name,
      email: u.email,
      role: u.role,
      is_super_user: u.isSuperUser,
      roles: u.roles,
      avatar_url: u.avatarUrl,
      active: u.active,
      invited_at: u.invitedAt,
      accepted_at: u.acceptedAt,
      last_login_at: u.lastLoginAt,
      two_step_enabled: u.twoStepEnabled,
      created_at: u.createdAt,
    });
    if (insErr) throw insErr;
  }

  console.log("→ Seeding vendors…");
  for (const v of mockVendors) {
    const newId = randomUUID();
    idMap.vendor.set(v.id, newId);
    const { error } = await supabase.from("vendors").insert({
      id: newId,
      company_id: lookup(idMap.company, v.companyId)!,
      name: v.name,
      phone: v.phone,
      speciality: v.speciality,
      active: v.active,
    });
    if (error) throw error;
  }

  console.log(`→ Seeding ${mockVehicles.length} vehicles…`);
  for (const v of mockVehicles) {
    const newId = randomUUID();
    idMap.vehicle.set(v.id, newId);
    const { error } = await supabase.from("vehicles").insert({
      id: newId,
      company_id: lookup(idMap.company, v.companyId)!,
      registration: v.registration,
      stock_id: v.stockId,
      tag_number: v.tagNumber,
      make: v.make,
      model: v.model,
      variant_name: v.variantName,
      variant_code: v.variantCode,
      year: v.year,
      colour: v.colour,
      mileage: v.mileage,
      vehicle_type: v.vehicleType,
      body_type: v.bodyType,
      fuel_type: v.fuelType,
      transmission: v.transmission,
      engine_size_cc: v.engineSizeCC,
      received_date: v.receivedDate,
      received_by: lookup(idMap.user, v.receivedBy)!,
      seller_name: v.sellerName,
      seller_phone: v.sellerPhone,
      source_type: v.sourceType,
      purchase_channel: v.purchaseChannel,
      local_or_import: v.localOrImport,
      auction_house: v.auctionHouse,
      owned_by: v.ownedBy,
      managed_by: v.managedBy ? lookup(idMap.user, v.managedBy) : null,
      invoice_date: v.invoiceDate,
      v5_received: v.v5Received,
      service_history: v.serviceHistory,
      num_keys: v.numKeys,
      lock_nut: v.lockNut,
      mot_expiry: v.motExpiry,
      buying_price: v.buyingPrice,
      vat_on_buying_price: v.vatOnBuyingPrice,
      buyers_fee: v.buyersFee,
      inspection_charge: v.inspectionCharge,
      collection_fee: v.collectionFee,
      delivery_fee: v.deliveryFee,
      late_storage_fee: v.lateStorageFee,
      other_charges: v.otherCharges,
      total_buying_price: v.totalBuyingPrice,
      finance_provider: v.financeProvider,
      loading_fee: v.loadingFee,
      daily_charge_rate: v.dailyChargeRate,
      unloading_fee: v.unloadingFee,
      stocking_charges: v.stockingCharges,
      value_addition: v.valueAddition,
      warranty_cost: v.warrantyCost,
      landed_cost: v.landedCost,
      base_cost: v.baseCost,
      minimum_sale_price: v.minimumSalePrice,
      listing_price: v.listingPrice,
      selling_price: v.sellingPrice,
      date_sold: v.dateSold,
      selling_agent: v.sellingAgent,
      gross_earning: v.grossEarning,
      status: v.status,
      removed_from_website_at: v.removedFromWebsiteAt,
      days_in_stock: v.daysInStock,
      images_count: v.imagesCount,
      hero_image_url: v.heroImageUrl,
      created_at: v.createdAt,
      updated_at: v.updatedAt,
    });
    if (error) {
      console.error(`Failed to insert vehicle ${v.stockId}:`, error);
      throw error;
    }
  }

  console.log("→ Seeding todos…");
  for (const t of mockTodos) {
    const newId = randomUUID();
    idMap.todo.set(t.id, newId);
    const { error } = await supabase.from("todo_items").insert({
      id: newId,
      vehicle_id: lookup(idMap.vehicle, t.vehicleId)!,
      serial_number: t.serialNumber,
      description: t.description,
      vendor_id: t.vendorId ? lookup(idMap.vendor, t.vendorId) : null,
      status: t.status,
      cost: t.cost,
      source: t.source,
      created_by: lookup(idMap.user, t.createdBy)!,
      completed_by: t.completedBy ? lookup(idMap.user, t.completedBy) : null,
      completed_at: t.completedAt,
      created_at: t.createdAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding maintenance jobs…");
  for (const m of mockMaintenanceJobs) {
    const newId = randomUUID();
    idMap.maint.set(m.id, newId);
    const { error } = await supabase.from("maintenance_jobs").insert({
      id: newId,
      company_id: lookup(idMap.company, m.companyId)!,
      vehicle_id: lookup(idMap.vehicle, m.vehicleId)!,
      description: m.description,
      assigned_to: m.assignedTo ? lookup(idMap.user, m.assignedTo) : null,
      vendor_id: m.vendorId ? lookup(idMap.vendor, m.vendorId) : null,
      estimated_cost: m.estimatedCost,
      actual_cost: m.actualCost,
      estimated_duration_hours: m.estimatedDurationHours,
      start_date: m.startDate,
      due_date: m.dueDate,
      completed_date: m.completedDate,
      status: m.status,
      notes: m.notes,
      created_at: m.createdAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding workshop jobs…");
  for (const w of mockWorkshopJobs) {
    const newId = randomUUID();
    idMap.workshopJob.set(w.id, newId);
    const { error } = await supabase.from("workshop_jobs").insert({
      id: newId,
      company_id: lookup(idMap.company, w.companyId)!,
      customer_name: w.customerName,
      customer_phone: w.customerPhone,
      vehicle_reg: w.vehicleReg,
      vehicle_description: w.vehicleDescription,
      description: w.description,
      assigned_to: w.assignedTo ? lookup(idMap.user, w.assignedTo) : null,
      estimated_cost: w.estimatedCost,
      actual_cost: w.actualCost,
      scheduled_date: w.scheduledDate,
      scheduled_time: w.scheduledTime,
      completed_date: w.completedDate,
      status: w.status,
      notes: w.notes,
      created_at: w.createdAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding listings…");
  for (const l of mockListings) {
    const newId = randomUUID();
    idMap.listing.set(l.id, newId);
    const { error } = await supabase.from("listings").insert({
      id: newId,
      company_id: lookup(idMap.company, l.companyId)!,
      vehicle_id: lookup(idMap.vehicle, l.vehicleId)!,
      title: l.title,
      description: l.description,
      price: l.price,
      special_features: l.specialFeatures,
      channels: l.channels,
      at_price_indicator: l.atPriceIndicator,
      status: l.status,
      published_at: l.publishedAt,
      enquiries_count: l.enquiriesCount,
      created_at: l.createdAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding leads (without appointment_id; updated later)…");
  for (const l of mockLeads) {
    const newId = randomUUID();
    idMap.lead.set(l.id, newId);
    const { error } = await supabase.from("leads").insert({
      id: newId,
      company_id: lookup(idMap.company, l.companyId)!,
      customer_name: l.customerName,
      customer_phone: l.customerPhone,
      customer_email: l.customerEmail,
      vehicle_interest: l.vehicleInterest,
      vehicle_id: l.vehicleId ? lookup(idMap.vehicle, l.vehicleId) : null,
      source: l.source,
      status: l.status,
      assigned_to: lookup(idMap.user, l.assignedTo)!,
      notes: l.notes,
      appointment_id: null,
      created_at: l.createdAt,
      updated_at: l.updatedAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding appointments…");
  for (const a of mockAppointments) {
    const newId = randomUUID();
    idMap.appointment.set(a.id, newId);
    const { error } = await supabase.from("appointments").insert({
      id: newId,
      company_id: lookup(idMap.company, a.companyId)!,
      vehicle_id: lookup(idMap.vehicle, a.vehicleId)!,
      lead_id: a.leadId ? lookup(idMap.lead, a.leadId) : null,
      customer_name: a.customerName,
      customer_phone: a.customerPhone,
      customer_email: a.customerEmail,
      date: a.date,
      time: a.time,
      special_requirements: a.specialRequirements,
      status: a.status,
      outcome: a.outcome,
      notifications_sent: a.notificationsSent,
      created_by: lookup(idMap.user, a.createdBy)!,
      created_at: a.createdAt,
    });
    if (error) throw error;
  }

  console.log("→ Backfilling lead.appointment_id…");
  for (const l of mockLeads) {
    if (!l.appointmentId) continue;
    const leadUuid = lookup(idMap.lead, l.id)!;
    const apptUuid = lookup(idMap.appointment, l.appointmentId)!;
    const { error } = await supabase
      .from("leads")
      .update({ appointment_id: apptUuid })
      .eq("id", leadUuid);
    if (error) throw error;
  }

  console.log("→ Seeding sales deals…");
  for (const d of mockSalesDeals) {
    const newId = randomUUID();
    idMap.deal.set(d.id, newId);
    const { error } = await supabase.from("sales_deals").insert({
      id: newId,
      company_id: lookup(idMap.company, d.companyId)!,
      vehicle_id: lookup(idMap.vehicle, d.vehicleId)!,
      lead_id: d.leadId ? lookup(idMap.lead, d.leadId) : null,
      customer_name: d.customerName,
      customer_phone: d.customerPhone,
      customer_email: d.customerEmail,
      stage: d.stage,
      offer_price: d.offerPrice,
      agreed_price: d.agreedPrice,
      deposit_amount: d.depositAmount,
      deposit_date: d.depositDate,
      collection_date: d.collectionDate,
      completion_date: d.completionDate,
      selling_agent: lookup(idMap.user, d.sellingAgent)!,
      notes: d.notes,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding warranties…");
  for (const w of mockWarranties) {
    const newId = randomUUID();
    idMap.warranty.set(w.id, newId);
    const { error } = await supabase.from("warranties").insert({
      id: newId,
      company_id: lookup(idMap.company, w.companyId)!,
      vehicle_id: lookup(idMap.vehicle, w.vehicleId)!,
      sale_deal_id: w.saleDealId ? lookup(idMap.deal, w.saleDealId) : null,
      customer_name: w.customerName,
      customer_phone: w.customerPhone,
      customer_email: w.customerEmail,
      type: w.type,
      provider: w.provider,
      coverage_details: w.coverageDetails,
      start_date: w.startDate,
      end_date: w.endDate,
      cost_to_dealership: w.costToDealership,
      cost_to_customer: w.costToCustomer,
      status: w.status,
      purchase_status: w.purchaseStatus,
      purchased_at: w.purchasedAt,
      purchased_by: w.purchasedBy ? lookup(idMap.user, w.purchasedBy) : null,
      provider_reference: w.providerReference,
      certificate_generated: w.certificateGenerated,
      created_at: w.createdAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding warranty claims…");
  for (const c of mockClaims) {
    const newId = randomUUID();
    idMap.claim.set(c.id, newId);
    const { error } = await supabase.from("warranty_claims").insert({
      id: newId,
      warranty_id: lookup(idMap.warranty, c.warrantyId)!,
      vehicle_id: lookup(idMap.vehicle, c.vehicleId)!,
      company_id: lookup(idMap.company, c.companyId)!,
      customer_name: c.customerName,
      issue_description: c.issueDescription,
      is_complaint: c.isComplaint,
      estimated_cost: c.estimatedCost,
      actual_cost: c.actualCost,
      status: c.status,
      resolution: c.resolution,
      created_at: c.createdAt,
      resolved_at: c.resolvedAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding invoices + line items + payments…");
  for (const inv of mockInvoices) {
    const newId = randomUUID();
    idMap.invoice.set(inv.id, newId);
    const { error: invErr } = await supabase.from("invoices").insert({
      id: newId,
      company_id: lookup(idMap.company, inv.companyId)!,
      type: inv.type,
      vehicle_id: inv.vehicleId ? lookup(idMap.vehicle, inv.vehicleId) : null,
      party_name: inv.partyName,
      party_phone: inv.partyPhone,
      party_email: inv.partyEmail,
      buyer_name: inv.buyerName,
      buyer_phone: inv.buyerPhone,
      buyer_email: inv.buyerEmail,
      buyer_address: inv.buyerAddress,
      invoice_number: inv.invoiceNumber,
      invoice_date: inv.invoiceDate,
      due_date: inv.dueDate,
      vat_scheme: inv.vatScheme,
      subtotal: inv.subtotal,
      addons_total: inv.addonsTotal,
      discount_total: inv.discountTotal,
      vat_amount: inv.vatAmount,
      total: inv.total,
      status: inv.status,
      notes: inv.notes,
      attachment_url: inv.attachmentUrl,
      created_at: inv.createdAt,
    });
    if (invErr) throw invErr;

    if (inv.lineItems.length > 0) {
      const rows = inv.lineItems.map((li, i) => ({
        id: randomUUID(),
        invoice_id: newId,
        line_type: li.lineType,
        addon_type: li.addonType,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unitPrice,
        vat_rate: li.vatRate,
        subtotal: li.subtotal,
        vat_amount: li.vatAmount,
        sort_order: i,
      }));
      const { error } = await supabase.from("invoice_line_items").insert(rows);
      if (error) throw error;
    }

    if (inv.payment) {
      const { error } = await supabase.from("invoice_payments").insert({
        id: randomUUID(),
        invoice_id: newId,
        deposit_amount: inv.payment.depositAmount,
        deposit_method: inv.payment.depositMethod,
        finance_amount: inv.payment.financeAmount,
        finance_provider: inv.payment.financeProvider,
        balance_due: inv.payment.balanceDue,
        balance_due_by: inv.payment.balanceDueBy,
      });
      if (error) throw error;
    }
  }

  console.log("→ Seeding vehicle returns…");
  for (const r of mockReturns) {
    const newId = randomUUID();
    idMap.vehicleReturn.set(r.id, newId);
    const { error } = await supabase.from("vehicle_returns").insert({
      id: newId,
      company_id: lookup(idMap.company, r.companyId)!,
      vehicle_id: lookup(idMap.vehicle, r.vehicleId)!,
      sale_deal_id: r.saleDealId ? lookup(idMap.deal, r.saleDealId) : null,
      customer_name: r.customerName,
      customer_phone: r.customerPhone,
      return_date: r.returnDate,
      reason: r.reason,
      resolution_path: r.resolutionPath,
      resolution_notes: r.resolutionNotes,
      refund_amount: r.refundAmount,
      status: r.status,
      created_at: r.createdAt,
      resolved_at: r.resolvedAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding activity log…");
  for (const a of mockActivityLog) {
    const newId = randomUUID();
    idMap.activity.set(a.id, newId);
    const { error } = await supabase.from("activity_log").insert({
      id: newId,
      company_id: lookup(idMap.company, a.companyId)!,
      user_id: lookup(idMap.user, a.userId)!,
      vehicle_id: a.vehicleId ? lookup(idMap.vehicle, a.vehicleId) : null,
      action_type: a.actionType,
      description: a.description,
      metadata: a.metadata,
      created_at: a.createdAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding notifications…");
  for (const n of mockNotifications) {
    const newId = randomUUID();
    idMap.notification.set(n.id, newId);
    const { error } = await supabase.from("notifications").insert({
      id: newId,
      company_id: lookup(idMap.company, n.companyId)!,
      user_id: lookup(idMap.user, n.userId)!,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.read,
      created_at: n.createdAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding customers…");
  for (const c of mockCustomers) {
    const newId = randomUUID();
    idMap.customer.set(c.id, newId);
    const { error } = await supabase.from("customers").insert({
      id: newId,
      company_id: lookup(idMap.company, c.companyId)!,
      title: c.title,
      first_name: c.firstName,
      last_name: c.lastName,
      company_name: c.companyName,
      email: c.email?.toLowerCase() ?? null,
      home_phone: c.homePhone,
      mobile_phone: c.mobilePhone,
      postcode: c.postcode,
      address_lines: c.addressLines,
      marketing_consent: c.marketingConsent,
      notes: c.notes,
      source_origin: c.sourceOrigin,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding enquiries…");
  for (const e of mockEnquiries) {
    const newId = randomUUID();
    idMap.enquiry.set(e.id, newId);
    const { error } = await supabase.from("enquiries").insert({
      id: newId,
      company_id: lookup(idMap.company, e.companyId)!,
      customer_id: lookup(idMap.customer, e.customerId)!,
      vehicle_id: e.vehicleId ? lookup(idMap.vehicle, e.vehicleId) : null,
      source: e.source,
      type: e.type,
      status: e.status,
      lost_reason: e.lostReason,
      salesperson_id: lookup(idMap.user, e.salespersonId)!,
      finance_interest: e.financeInterest,
      next_action_due_at: e.nextActionDueAt,
      notes: e.notes,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
    });
    if (error) throw error;
  }

  console.log("→ Seeding user permissions…");
  for (const p of mockUserPermissions) {
    const newId = randomUUID();
    idMap.permission.set(p.id, newId);
    const { error } = await supabase.from("user_permissions").insert({
      id: newId,
      user_id: lookup(idMap.user, p.userId)!,
      capability: p.capability,
      granted_by: lookup(idMap.user, p.grantedBy)!,
      granted_at: p.grantedAt,
    });
    if (error) throw error;
  }

  await seedInvoiceDl68Delta();

  console.log("\n✅ Seed complete.\n");
  console.log("Sign-in credentials (shared password):");
  for (const u of mockUsers) {
    console.log(`   ${u.email}    \t${SHARED_PASSWORD}    \t(${u.name}, ${u.role})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Seed failed:", err);
    process.exit(1);
  });
