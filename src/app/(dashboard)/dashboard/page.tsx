"use client";

import { MessageSquare, Megaphone } from "lucide-react";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { YourStockCard } from "@/components/dashboard/your-stock-card";
import { FindVehicleCard } from "@/components/dashboard/find-vehicle-card";
import { ActionTile } from "@/components/dashboard/action-tile";
import { MasterCalendarPreview } from "@/components/dashboard/master-calendar-preview";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardGreeting />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <YourStockCard />

        <div className="grid gap-4 lg:grid-rows-[auto_1fr]">
          <FindVehicleCard />
          <div className="grid grid-cols-2 gap-4">
            <ActionTile
              label="Sales Enquiries"
              href="/leads"
              icon={<MessageSquare className="h-4 w-4" />}
              description="Follow up on new and contacted leads"
            />
            <ActionTile
              label="Work List"
              href="/listings"
              icon={<Megaphone className="h-4 w-4" />}
              description="Listings, AT indicator, channels"
            />
          </div>
        </div>
      </div>

      <MasterCalendarPreview />
    </div>
  );
}
