import type { InspectionCheck, UUID } from "@/lib/types";
import { delay } from "./_base";

const inspections: InspectionCheck[] = [];

export const inspectionService = {
  async getForVehicle(vehicleId: UUID): Promise<InspectionCheck[]> {
    // TODO: Supabase: from('inspection_checks').select('*').eq('vehicle_id', vehicleId).order('check_number')
    await delay();
    return inspections
      .filter((c) => c.vehicleId === vehicleId)
      .sort((a, b) => a.checkNumber - b.checkNumber);
  },
};
