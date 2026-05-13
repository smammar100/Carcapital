import { createClient } from "@/lib/supabase/client";
import { INSPECTION_ITEMS, NEGATIVE_INSPECTION_STATUSES } from "@/lib/constants";
import type { InspectionCheck, UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";
import { todoService } from "./todo-service";
import { maintenanceService } from "./maintenance-service";

const SELECT = `
  id,
  vehicleId:vehicle_id,
  checkNumber:check_number,
  checkItem:check_item,
  status,
  actionRequired:action_required,
  carriedOutBy:carried_out_by,
  carriedOutDate:carried_out_date,
  createdAt:created_at
`;

interface SaveInput {
  vehicleId: UUID;
  checkNumber: number;
  status: string;
  actionRequired: string | null;
  carriedOutBy: UUID;
}

export const inspectionService = {
  async getForVehicle(vehicleId: UUID): Promise<InspectionCheck[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("inspection_checks")
      .select(SELECT)
      .eq("vehicle_id", vehicleId)
      .order("check_number", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as InspectionCheck[];
  },

  async start(vehicleId: UUID, actorId: UUID): Promise<InspectionCheck[]> {
    const supabase = createClient();
    const v = await vehicleService.getById(vehicleId);
    if (!v) throw new Error("Vehicle not found");
    // Clear any prior rows (re-start support) then bulk insert.
    await supabase.from("inspection_checks").delete().eq("vehicle_id", vehicleId);
    const today = new Date().toISOString().slice(0, 10);
    const rows = INSPECTION_ITEMS.map((item) => ({
      vehicle_id: vehicleId,
      check_number: item.number,
      check_item: item.item,
      status: "",
      action_required: null as string | null,
      carried_out_by: actorId,
      carried_out_date: today,
    }));
    const { error } = await supabase.from("inspection_checks").insert(rows);
    if (error) throw error;

    await activityService.log({
      companyId: v.companyId,
      userId: actorId,
      vehicleId,
      actionType: "inspection_started",
      description: `Inspection started for ${v.registration}`,
      metadata: {},
    });
    return inspectionService.getForVehicle(vehicleId);
  },

  async saveCheck(input: SaveInput): Promise<InspectionCheck> {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    // Try update first.
    const { data: updated } = await supabase
      .from("inspection_checks")
      .update({
        status: input.status,
        action_required: input.actionRequired,
        carried_out_by: input.carriedOutBy,
        carried_out_date: today,
      })
      .eq("vehicle_id", input.vehicleId)
      .eq("check_number", input.checkNumber)
      .select(SELECT)
      .maybeSingle();
    if (updated) return updated as unknown as InspectionCheck;

    // Otherwise insert.
    const item = INSPECTION_ITEMS.find((i) => i.number === input.checkNumber);
    const { data, error } = await supabase
      .from("inspection_checks")
      .insert({
        vehicle_id: input.vehicleId,
        check_number: input.checkNumber,
        check_item: item?.item ?? `Check ${input.checkNumber}`,
        status: input.status,
        action_required: input.actionRequired,
        carried_out_by: input.carriedOutBy,
        carried_out_date: today,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as InspectionCheck;
  },

  async complete(
    vehicleId: UUID,
    actorId: UUID,
  ): Promise<{ flagged: number }> {
    const supabase = createClient();
    const { data: checks } = await supabase
      .from("inspection_checks")
      .select(SELECT)
      .eq("vehicle_id", vehicleId);
    const failing = ((checks ?? []) as unknown as InspectionCheck[]).filter((c) =>
      NEGATIVE_INSPECTION_STATUSES.has(c.status),
    );
    const v = await vehicleService.getById(vehicleId);
    if (!v) throw new Error("Vehicle not found");

    for (const check of failing) {
      const description = check.actionRequired
        ? `${check.checkItem}: ${check.actionRequired}`
        : `${check.checkItem} — needs attention (${check.status})`;
      await todoService.add({
        vehicleId,
        description,
        vendorId: null,
        cost: null,
        source: "inspection",
        createdBy: actorId,
      });
      await maintenanceService.create(
        {
          companyId: v.companyId,
          vehicleId,
          description,
          assignedTo: null,
          vendorId: null,
          estimatedCost: null,
          estimatedDurationHours: null,
          startDate: null,
          dueDate: null,
          notes: `Auto-created from 20-point inspection (item #${check.checkNumber})`,
        },
        actorId,
      );
    }

    const targetStatus = failing.length > 0 ? "being_prepared" : "ready";
    if (v.status !== targetStatus) {
      await vehicleService.changeStatus(vehicleId, targetStatus, actorId);
    }

    await activityService.log({
      companyId: v.companyId,
      userId: actorId,
      vehicleId,
      actionType: "inspection_completed",
      description:
        failing.length > 0
          ? `Inspection completed for ${v.registration} — ${failing.length} items need attention`
          : `Inspection completed for ${v.registration} — all clear`,
      metadata: { flagged: failing.length },
    });
    return { flagged: failing.length };
  },
};
