"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { authService } from "@/lib/services/auth-service";
import type { SalesDeal, SalesStage, User, Vehicle } from "@/lib/types";
import { SALES_STAGES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegPlate } from "@/components/shared/reg-plate";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

export default function SalesPipelinePage() {
  const { user, company } = useAuth();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [agentFilter, setAgentFilter] = useState<string | "all">("all");

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      salesService.getAll(company.id),
      vehicleService.getAll(company.id),
      authService.getUsersForCompany(company.id),
    ]).then(([d, v, u]) => {
      setDeals(d);
      setVehicles(v);
      setUsers(u);
    });
  }, [company]);

  const grouped = useMemo(() => {
    if (!deals) return null;
    const filtered =
      agentFilter === "all"
        ? deals
        : deals.filter((d) => d.sellingAgent === agentFilter);
    const map: Record<SalesStage, SalesDeal[]> = {
      new_lead: [],
      contacted: [],
      test_drive: [],
      offer_made: [],
      deposit_taken: [],
      collection_delivery: [],
      completed_sale: [],
      lost: [],
    };
    for (const d of filtered) map[d.stage].push(d);
    return map;
  }, [deals, agentFilter]);

  async function handleMove(id: string, stage: SalesStage) {
    if (!user || !company) return;
    await salesService.updateStage(id, stage, user.id);
    setDeals(await salesService.getAll(company.id));
    toast.success(`Moved → ${stage.replace("_", " ")}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Sales Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            8 stages from new lead to completed sale (+ lost).
          </p>
        </div>
        <Select
          value={agentFilter}
          onValueChange={(v) => setAgentFilter(v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {users
              .filter(
                (u) =>
                  u.role === "sales" || u.role === "owner" || u.role === "admin",
              )
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {!grouped ? (
        <Skeleton className="h-72" />
      ) : deals && deals.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No deals yet"
          description="Convert a lead into an appointment, then a deal will appear."
        />
      ) : (
        <div className="grid auto-cols-[220px] grid-flow-col gap-3 overflow-x-auto pb-2">
          {SALES_STAGES.map((stage) => {
            const list = grouped[stage.value];
            return (
              <div key={stage.value} className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                  <h3 className="text-xs font-semibold capitalize">
                    {stage.label}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {list.length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {list.length === 0 ? (
                    <div className="rounded border border-dashed p-2 text-center text-[10px] text-muted-foreground">
                      —
                    </div>
                  ) : (
                    list.map((d) => {
                      const v = vehicles.find((x) => x.id === d.vehicleId);
                      const agent = users.find((u) => u.id === d.sellingAgent);
                      const days = Math.max(
                        0,
                        Math.round(
                          (Date.now() - new Date(d.updatedAt).getTime()) /
                            86400000,
                        ),
                      );
                      const showInvoiceCta =
                        d.stage === "deposit_taken" ||
                        d.stage === "completed_sale";
                      return (
                        <Card key={d.id} className="border bg-background p-2.5">
                          <div className="flex items-center justify-between gap-1">
                            {v && (
                              <RegPlate
                                registration={v.registration}
                                size="sm"
                              />
                            )}
                            <Select
                              value={d.stage}
                              onValueChange={(s) =>
                                void handleMove(d.id, s as SalesStage)
                              }
                            >
                              <SelectTrigger className="h-6 w-[6.5rem] text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SALES_STAGES.map((s) => (
                                  <SelectItem
                                    key={s.value}
                                    value={s.value}
                                    className="text-xs"
                                  >
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Link
                            href={v ? `/vehicles/${v.id}` : "#"}
                            className="mt-1 block text-xs font-medium hover:underline"
                          >
                            {d.customerName}
                          </Link>
                          <p className="line-clamp-1 text-[11px] text-muted-foreground">
                            {v ? `${v.make} ${v.model}` : "—"}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>
                              {formatCurrency(d.agreedPrice ?? d.offerPrice ?? null)}
                            </span>
                            <span>{days}d</span>
                          </div>
                          {agent && (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {agent.name}
                            </div>
                          )}
                          {showInvoiceCta && (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="mt-2 h-6 w-full text-[10px]"
                            >
                              <Link href="/admin/invoicing">
                                <Receipt className="mr-1 h-3 w-3" />
                                Generate Invoice
                              </Link>
                            </Button>
                          )}
                          <p className="mt-1 text-[9px] text-muted-foreground">
                            Updated {formatRelativeTime(d.updatedAt)}
                          </p>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
