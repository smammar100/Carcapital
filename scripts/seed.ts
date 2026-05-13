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
};

const lookup = (map: Map<string, string>, id: string | null | undefined): string | null => {
  if (id == null) return null;
  const v = map.get(id);
  if (!v) throw new Error(`Missing mapping for id: ${id}`);
  return v;
};

async function bail() {
  const { count, error } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error("Failed to query companies:", error);
    process.exit(1);
  }
  if ((count ?? 0) > 0) {
    console.log("ℹ️  companies table is not empty — seed already ran. Skipping.");
    return true;
  }
  return false;
}

async function main() {
  if (await bail()) return;

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
