import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  Customer,
  Enquiry,
  EnquiryStatus,
  EnquiryType,
  LostReason,
  UUID,
} from "@/lib/types";
import { lostReasonForType } from "@/lib/enquiry-constants";
import { customerService } from "./customer-service";
import { activityService } from "./activity-service";

const NS = "enquiries:";

const SELECT = `
  id,
  companyId:company_id,
  customerId:customer_id,
  vehicleId:vehicle_id,
  source,
  type,
  status,
  lostReason:lost_reason,
  salespersonId:salesperson_id,
  financeInterest:finance_interest,
  nextActionDueAt:next_action_due_at,
  notes,
  createdAt:created_at,
  updatedAt:updated_at
`;

interface EnquiryFieldsInput {
  vehicleId: UUID | null;
  source: string;
  type: EnquiryType;
  salespersonId: UUID;
  financeInterest?: boolean;
  nextActionDueAt?: string | null;
  notes?: string | null;
}

interface CreateEnquiryWithCustomerInput {
  companyId: UUID;
  /** Either an existing customer id, or fresh customer fields to insert. */
  customer:
    | { existingId: UUID }
    | {
        newData: {
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
        };
      };
  enquiry: EnquiryFieldsInput;
  actorId: UUID;
}

function deriveStatus(type: EnquiryType): {
  status: EnquiryStatus;
  lostReason: LostReason | null;
} {
  const reason = lostReasonForType(type);
  if (reason) return { status: "lost", lostReason: reason };
  return { status: "open", lostReason: null };
}

export const enquiryService = {
  async getAll(companyId: UUID): Promise<Enquiry[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("enquiries")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Enquiry[];
    });
  },

  async getForVehicle(vehicleId: UUID): Promise<Enquiry[]> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("enquiries")
        .select(SELECT)
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Enquiry[];
    });
  },

  async getForCustomer(customerId: UUID): Promise<Enquiry[]> {
    return withCache(`${NS}customer:${customerId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("enquiries")
        .select(SELECT)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Enquiry[];
    });
  },

  /**
   * Atomic-ish create: resolves the customer (existing or new), inserts the
   * enquiry, logs activity. Real DB-level atomicity would require a Postgres
   * function — fine for v1, the two writes are sequenced and any failure on
   * the second leaves a dangling customer (acceptable for a demo).
   */
  async createEnquiryWithCustomer(
    input: CreateEnquiryWithCustomerInput,
  ): Promise<{ enquiry: Enquiry; customer: Customer; wasNewCustomer: boolean }> {
    let customer: Customer;
    let wasNewCustomer = false;

    if ("existingId" in input.customer) {
      const existing = await customerService.getById(input.customer.existingId);
      if (!existing) throw new Error("Customer not found");
      customer = existing;
    } else {
      const result = await customerService.findOrCreateCustomer(
        input.companyId,
        {
          companyId: input.companyId,
          ...input.customer.newData,
          sourceOrigin: input.enquiry.source,
        },
      );
      customer = result.customer;
      wasNewCustomer = !result.wasExisting;
    }

    const { status, lostReason } = deriveStatus(input.enquiry.type);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("enquiries")
      .insert({
        company_id: input.companyId,
        customer_id: customer.id,
        vehicle_id: input.enquiry.vehicleId,
        source: input.enquiry.source,
        type: input.enquiry.type,
        status,
        lost_reason: lostReason,
        salesperson_id: input.enquiry.salespersonId,
        finance_interest: input.enquiry.financeInterest ?? false,
        next_action_due_at: input.enquiry.nextActionDueAt ?? null,
        notes: input.enquiry.notes ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const enquiry = data as unknown as Enquiry;
    invalidate(NS);

    // Activity log — reuse the existing `lead_created` action type so the
    // unified activity feed groups enquiries with the older leads cleanly.
    await activityService.log({
      companyId: input.companyId,
      userId: input.actorId,
      vehicleId: input.enquiry.vehicleId,
      actionType: "lead_created",
      description: `${input.enquiry.source.replace(/_/g, " ")} enquiry: ${customer.firstName} ${customer.lastName}`,
      metadata: {
        enquiryId: enquiry.id,
        customerId: customer.id,
        wasNewCustomer,
        source: input.enquiry.source,
        type: input.enquiry.type,
        status,
      },
    });

    return { enquiry, customer, wasNewCustomer };
  },

  async updateStatus(
    id: UUID,
    status: EnquiryStatus,
    lostReason: LostReason | null = null,
  ): Promise<Enquiry> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("enquiries")
      .update({ status, lost_reason: lostReason })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as Enquiry;
  },
};
