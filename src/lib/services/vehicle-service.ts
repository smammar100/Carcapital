import { mockMaintenanceJobs, mockVehicles } from "@/lib/mock-data";
import type { UUID, Vehicle, VehicleStatus } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";

export const vehicleService = {
  async getAll(companyId: UUID): Promise<Vehicle[]> {
    // TODO: Supabase: from('vehicles').select('*').eq('company_id', companyId)
    await delay();
    return mockVehicles.filter((v) => v.companyId === companyId);
  },

  async getById(id: UUID): Promise<Vehicle | null> {
    // TODO: Supabase: from('vehicles').select('*').eq('id', id).single()
    await delay(150);
    return mockVehicles.find((v) => v.id === id) ?? null;
  },

  async getByRegistration(reg: string): Promise<Vehicle | null> {
    // TODO: Supabase: ... .eq('registration', reg).maybeSingle()
    await delay(150);
    const cleaned = reg.toUpperCase().replace(/\s+/g, "");
    return (
      mockVehicles.find(
        (v) => v.registration.replace(/\s+/g, "") === cleaned,
      ) ?? null
    );
  },

  async getByStatus(
    companyId: UUID,
    status: VehicleStatus,
  ): Promise<Vehicle[]> {
    // TODO: Supabase: ... .eq('company_id', companyId).eq('status', status)
    await delay();
    return mockVehicles.filter(
      (v) => v.companyId === companyId && v.status === status,
    );
  },

  async getRecent(companyId: UUID, days: number): Promise<Vehicle[]> {
    // TODO: Supabase: ... .gte('received_date', new Date(Date.now() - days*86400000).toISOString())
    await delay();
    const cutoff = Date.now() - days * 86400000;
    return mockVehicles.filter(
      (v) =>
        v.companyId === companyId &&
        new Date(v.receivedDate).getTime() >= cutoff,
    );
  },

  async getSoldRecently(companyId: UUID, days: number): Promise<Vehicle[]> {
    // TODO: Supabase: ... .eq('status', 'sold').gte('date_sold', cutoff)
    await delay();
    const cutoff = Date.now() - days * 86400000;
    return mockVehicles.filter(
      (v) =>
        v.companyId === companyId &&
        v.status === "sold" &&
        v.dateSold !== null &&
        new Date(v.dateSold).getTime() >= cutoff,
    );
  },

  async create(
    input: Omit<Vehicle, "id" | "createdAt" | "updatedAt" | "stockId">,
    actorId: UUID,
  ): Promise<Vehicle> {
    // TODO: Supabase: insert + return; trigger handles stockId
    await delay();
    const stockId = generateStockId(input.companyId);
    const now = nowIso();
    const vehicle: Vehicle = {
      ...input,
      id: newId("vehicle"),
      stockId,
      createdAt: now,
      updatedAt: now,
    };
    mockVehicles.push(vehicle);
    await activityService.log({
      companyId: vehicle.companyId,
      userId: actorId,
      vehicleId: vehicle.id,
      actionType: "vehicle_arrived",
      description: `${vehicle.make} ${vehicle.model} (${vehicle.registration}) received`,
      metadata: { stockId },
    });
    // Auto-create a pending maintenance job — every new stock car needs prep.
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const jobId = newId("maint");
    mockMaintenanceJobs.push({
      id: jobId,
      companyId: vehicle.companyId,
      vehicleId: vehicle.id,
      description: "New stock — needs inspection + readiness",
      assignedTo: null,
      vendorId: null,
      estimatedCost: null,
      actualCost: null,
      estimatedDurationHours: 2,
      startDate: null,
      dueDate: dueDate.toISOString().slice(0, 10),
      completedDate: null,
      status: "pending",
      notes: null,
      createdAt: now,
    });
    await activityService.log({
      companyId: vehicle.companyId,
      userId: actorId,
      vehicleId: vehicle.id,
      actionType: "maintenance_job_created",
      description: `New stock maintenance job created for ${vehicle.registration}`,
      metadata: { jobId },
    });
    return vehicle;
  },

  async update(
    id: UUID,
    patch: Partial<Vehicle>,
    actorId: UUID,
  ): Promise<Vehicle> {
    // TODO: Supabase: update + return
    await delay();
    const idx = mockVehicles.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error("Vehicle not found");
    mockVehicles[idx] = {
      ...mockVehicles[idx],
      ...patch,
      updatedAt: nowIso(),
    };
    await activityService.log({
      companyId: mockVehicles[idx].companyId,
      userId: actorId,
      vehicleId: id,
      actionType: "cost_updated",
      description: `${mockVehicles[idx].registration} updated`,
      metadata: {},
    });
    return mockVehicles[idx];
  },

  async changeStatus(
    id: UUID,
    newStatus: VehicleStatus,
    actorId: UUID,
  ): Promise<Vehicle> {
    await delay();
    const idx = mockVehicles.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error("Vehicle not found");
    mockVehicles[idx] = {
      ...mockVehicles[idx],
      status: newStatus,
      updatedAt: nowIso(),
    };
    await activityService.log({
      companyId: mockVehicles[idx].companyId,
      userId: actorId,
      vehicleId: id,
      actionType: "vehicle_status_changed",
      description: `${mockVehicles[idx].registration} → ${newStatus}`,
      metadata: { newStatus },
    });
    return mockVehicles[idx];
  },
};

function generateStockId(companyId: UUID): string {
  const prefix = companyId === "company-1" ? "CC" : "CG";
  const count =
    mockVehicles.filter((v) => v.companyId === companyId).length + 1;
  return `${prefix}-${String(count).padStart(4, "0")}`;
}
