"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function InsightsPage() {
  const { company } = useAuth();
  const [data, setData] = useState<{ source: string; count: number }[] | null>(
    null,
  );

  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then((vs) => {
      const counts = new Map<string, number>();
      for (const v of vs) {
        const key = v.auctionHouse ?? v.sourceType;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      setData(
        Array.from(counts.entries())
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count),
      );
    });
  }, [company]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Sourcing channel ROI, days-in-stock by make, conversion funnel.
          </p>
        </div>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Stock by source (preview)</h2>
        </div>
        {!data ? (
          <Skeleton className="h-72" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Full insights — sourcing-channel ROI, days-in-stock by make, conversion
        funnel, stock-aging breakdown — land in v2.
      </p>
    </div>
  );
}
