import { INSPECTION_ITEMS, NEGATIVE_INSPECTION_STATUSES } from "@/lib/constants";
import type { InspectionCheck, UUID } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";
import { todoService } from "./todo-service";
import { maintenanceService } from "./maintenance-service";

const inspections: InspectionCheck[] = [];

interface SaveInput {
  vehicleId: UUID;
  checkNumber: number;
  status: string;
  actionRequired: string | null;
  carriedOutBy: UUID;
}

export const inspectionService = {
  async getForVehicle(vehicleId: UUID): Promise<InspectionCheck[]> {
    // TODO: Supabase: from('inspection_checks').select('*').eq('vehicle_id', vehicleId).order('check_number')
    await delay();
    return inspections
      .filter((c) => c.vehicleId === vehicleId)
      .sort((a, b) => a.checkNumber - b.checkNumber);
  },

  async start(vehicleId: UUID, actorId: UUID): Promise<InspectionCheck[]> {
    // TODO: Supabase: bulk insert 20 empty rows
    await delay();
    const v = await vehicleService.getById(vehicleId);
    if (!v) throw new Error("Vehicle not found");
    // Remove any prior in-progress rows for this vehicle (re-start support)
    for (let i = inspections.length - 1; i >= 0; i--) {
      if (inspections[i].vehicleId === vehicleId) inspections.splice(i, 1);
    }
    const today = nowIso().slice(0, 10);
    for (const item of INSPECTION_ITEMS) {
      inspections.push({
        id: newId("insp"),
        vehicleId,
        checkNumber: item.number,
        checkItem: item.item,
        status: "",
        actionRequired: null,
        carriedOutBy: actorId,
        carriedOutDate: today,
        createdAt: nowIso(),
      });
    }
    await activityService.log({
      companyId: v.companyId,
      userId: actorId,
      vehicleId,
      actionType: "inspection_started",
      description: `Inspection started for ${v.registration}`,
      metadata: {},
    });
    return inspections
      .filter((c) => c.vehicleId === vehicleId)
      .sort((a, b) => a.checkNumber - b.checkNumber);
  },

  async saveCheck(input: SaveInput): Promise<InspectionCheck> {
    // TODO: Supabase: upsert
    await delay(150);
    const idx = inspections.findIndex(
      (c) =>
        c.vehicleId === input.vehicleId &&
        c.checkNumber === input.checkNumber,
    );
    if (idx === -1) {
      const item = INSPECTION_ITEMS.find((i) => i.number === input.checkNumber);
      const fresh: InspectionCheck = {
        id: newId("insp"),
        vehicleId: input.vehicleId,
        checkNumber: input.checkNumber,
        checkItem: item?.item ?? `Check ${input.checkNumber}`,
        status: input.status,
        actionRequired: input.actionRequired,
        carriedOutBy: input.carriedOutBy,
        carriedOutDate: nowIso().slice(0, 10),
        createdAt: nowIso(),
      };
      inspections.push(fresh);
      return fresh;
    }
    inspections[idx] = {
      ...inspections[idx],
      status: input.status,
      actionRequired: input.actionRequired,
      carriedOutBy: input.carriedOutBy,
      carriedOutDate: nowIso().slice(0, 10),
    };
    return inspections[idx];
  },

  async complete(vehicleId: UUID, actorId: UUID): Promise<{ flagged: number }> {
    // v4.1 §11.5 / Gap 4 — auto-create todos + workshop jobs for failing items;
    // status transitions per TC-P2-002 (all-pass → ready) / TC-P2-003 (any
    // failure → being_prepared until jobs done).
    // TODO: Supabase: bulk-create todos + workshop jobs + update vehicle status in tx
    await delay();
    const checks = inspections.filter((c) => c.vehicleId === vehicleId);
    const failing = checks.filter((c) =>
      NEGATIVE_INSPECTION_STATUSES.has(c.status),
    );
    const v = await vehicleService.getById(vehicleId);
    if (!v) throw new Error("Vehicle not found");

    for (const check of failing) {
      const description = check.actionRequired
        ? `${check.checkItem}: ${check.actionRequired}`
        : `${check.checkItem} — needs attention (${check.status})`;
      // Things to Do entry — visible on vehicle's Things to Do tab
      await todoService.add({
        vehicleId,
        description,
        vendorId: null,
        cost: null,
        source: "inspection",
        createdBy: actorId,
      });
      // Corresponding Workshop job — visible on /maintenance/workshop
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

    // Status transition (TC-P2-002 / TC-P2-003)
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
