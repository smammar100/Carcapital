import { DVLA_MOCK } from "@/lib/mock-data";
import type { Vehicle } from "@/lib/types";
import { delay } from "./_base";

export const dvlaService = {
  async lookup(reg: string): Promise<Partial<Vehicle> | null> {
    // TODO: Replace with real DVLA Vehicle Enquiry Service API call
    // (or Auto-Trader / GoVolution integration if rebadged through a partner)
    await delay(1000); // simulate slow gov API
    const cleaned = reg.toUpperCase().trim();
    return DVLA_MOCK[cleaned] ?? null;
  },
};
