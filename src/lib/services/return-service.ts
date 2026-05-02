import { mockReturns } from "@/lib/mock-data";
import type {
  ReturnResolutionPath,
  UUID,
  VehicleReturn,
} from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

interface CreateInput {
  companyId: UUID;
  vehicleId: UUID;
  saleDealId: UUID | null;
  customerName: string;
  customerPhone: string;
  returnDate: string;
  reason: string;
  resolutionPath: ReturnResolutionPath;
  resolutionNotes: string | null;
  refundAmount: number | null;
}

export const returnService = {
  async getAll(companyId: UUID): Promise<VehicleReturn[]> {
    // TODO: Supabase: from('vehicle_returns').select('*').eq('company_id', companyId)
    await delay();
    return mockReturns
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => b.returnDate.localeCompare(a.returnDate));
  },

  async getById(id: UUID): Promise<VehicleReturn | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockReturns.find((r) => r.id === id) ?? null;
  },

  async create(input: CreateInput, actorId: UUID): Promise<VehicleReturn> {
    // TODO: Supabase: insert + log + flip vehicle status
    await delay();
    const ret: VehicleReturn = {
      id: newId("return"),
      ...input,
      status: "pending",
      createdAt: nowIso(),
      resolvedAt: null,
    };
    mockReturns.push(ret);
    await vehicleService.changeStatus(input.vehicleId, "returned", actorId);
    const v = await vehicleService.getById(input.vehicleId);
    if (v) {
      await activityService.log({
        companyId: input.companyId,
        userId: actorId,
        vehicleId: v.id,
        actionType: "vehicle_returned",
        description: `${input.customerName} returned ${v.registration} — ${input.resolutionPath.replace("_", " ")}`,
        metadata: { returnId: ret.id, resolutionPath: input.resolutionPath },
      });
    }
    return ret;
  },
};
