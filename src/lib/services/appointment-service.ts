import { mockAppointments } from "@/lib/mock-data";
import type { Appointment, UUID } from "@/lib/types";
import { delay } from "./_base";

export const appointmentService = {
  async getAll(companyId: UUID): Promise<Appointment[]> {
    // TODO: Supabase: from('appointments').select('*').eq('company_id', companyId)
    await delay();
    return mockAppointments
      .filter((a) => a.companyId === companyId)
      .sort((a, b) =>
        a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
      );
  },

  async getForDate(companyId: UUID, date: string): Promise<Appointment[]> {
    // TODO: Supabase: ... .eq('date', date)
    await delay(150);
    return mockAppointments.filter(
      (a) => a.companyId === companyId && a.date === date,
    );
  },

  async getForVehicle(vehicleId: UUID): Promise<Appointment[]> {
    // TODO: Supabase: ... .eq('vehicle_id', vehicleId)
    await delay();
    return mockAppointments.filter((a) => a.vehicleId === vehicleId);
  },
};
