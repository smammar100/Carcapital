"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, TrendingUp, Clock, Check, Car } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { authService } from "@/lib/services/auth-service";
import type { SalesDeal, SalesStage, User, Vehicle } from "@/lib/types";
import { SALES_STAGES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegPlate } from "@/components/shared/reg-plate";
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { cn, formatCurrency, formatRelativeTime, getInitials } from "@/lib/utils";
import { toast } from "@/lib/toast";

// Per-stage accent (column top-bar + dot). Keyed by SalesStage.
const STAGE_META: Record<SalesStage, { dot: string; bar: string }> = {
  new_lead: { dot: "bg-slate-400", bar: "border-t-slate-400" },
  contacted: { dot: "bg-blue-500", bar: "border-t-blue-500" },
  test_drive: { dot: "bg-violet-500", bar: "border-t-violet-500" },
  offer_made: { dot: "bg-amber-500", bar: "border-t-amber-500" },
  deposit_taken: { dot: "bg-orange-500", bar: "border-t-orange-500" },
  collection_delivery: { dot: "bg-teal-500", bar: "border-t-teal-500" },
  completed_sale: { dot: "bg-emerald-500", bar: "border-t-emerald-500" },
  lost: { dot: "bg-rose-500", bar: "border-t-rose-500" },
};

const dealValue = (d: SalesDeal): number | null =>
  d.agreedPrice ?? d.offerPrice ?? null;

const fmtTotal = (n: number): string =>
  `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

function ageTone(days: number): string {
  if (days <= 14) return "text-muted-foreground";
  if (days <= 30) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export default function SalesPipelinePage() {
  const { user, company } = useAuth();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [agentFilter, setAgentFilter] = useState<string | "all">("all");
  const [nowTs, setNowTs] = useState<number | null>(null);

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
      setNowTs(Date.now());
    });
  }, [company]);

  const filteredDeals = useMemo(() => {
    if (!deals) return null;
    return agentFilter === "all"
      ? deals
      : deals.filter((d) => d.sellingAgent === agentFilter);
  }, [deals, agentFilter]);

  const grouped = useMemo(() => {
    if (!filteredDeals) return null;
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
    // Only bucket known stages into the 8 fixed columns; ignore any
    // unexpected stage value rather than crashing on an undefined bucket.
    for (const d of filteredDeals) map[d.stage]?.push(d);
    return map;
  }, [filteredDeals]);

  async function handleMove(id: string, stage: SalesStage) {
    if (!user || !company) return;
    await salesService.updateStage(id, stage, user.id);
    setDeals(await salesService.getAll(company.id));
    toast.success(`Moved → ${stage.replace(/_/g, " ")}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sales Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Track every deal from new lead to completed sale across eight
            stages, plus anything lost.
          </p>
        </div>
        <Select
          items={{
            all: "All agents",
            ...Object.fromEntries(
              users
                .filter(
                  (u) =>
                    u.role === "sales" ||
                    u.role === "owner" ||
                    u.role === "admin",
                )
                .map((u) => [u.id, u.name]),
            ),
          }}
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
        <div className="grid auto-cols-[244px] grid-flow-col gap-3 overflow-x-auto pb-2">
          {SALES_STAGES.map((stage) => {
            const list = grouped[stage.value];
            const meta = STAGE_META[stage.value];
            const total = list.reduce((s, d) => s + (dealValue(d) ?? 0), 0);
            return (
              <div
                key={stage.value}
                className="flex flex-col gap-2 rounded-lg transition-shadow"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("ring-1", "ring-primary");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("ring-1", "ring-primary");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-1", "ring-primary");
                  const dealId = e.dataTransfer.getData("text/deal-id");
                  if (dealId) void handleMove(dealId, stage.value);
                }}
              >
                <div
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md border border-t-2 bg-muted/40 px-2.5 py-2",
                    meta.bar,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span className={cn("size-2 rounded-full", meta.dot)} />
                      {stage.label}
                    </span>
                    <span className="rounded-full bg-background px-1.5 text-2xs font-medium tabular-nums text-muted-foreground">
                      {list.length}
                    </span>
                  </div>
                  {total > 0 ? (
                    <span className="text-2xs tabular-nums text-muted-foreground">
                      {fmtTotal(total)}
                    </span>
                  ) : null}
                </div>

                <div className="flex min-h-[3rem] flex-col gap-2">
                  {list.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-3 text-center text-2xs text-muted-foreground">
                      No deals
                    </div>
                  ) : (
                    list.map((d) => {
                      const v = vehicles.find((x) => x.id === d.vehicleId);
                      const agent = users.find((u) => u.id === d.sellingAgent);
                      const days = nowTs
                        ? Math.max(
                            0,
                            Math.round(
                              (nowTs - new Date(d.updatedAt).getTime()) /
                                86_400_000,
                            ),
                          )
                        : 0;
                      const showInvoiceCta =
                        d.stage === "deposit_taken" ||
                        d.stage === "completed_sale";
                      return (
                        <Card
                          key={d.id}
                          className="cursor-grab overflow-hidden border bg-background p-0 transition-shadow hover:shadow-md active:cursor-grabbing"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/deal-id", d.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                        >
                          {/* Premium image header — plate + price over a
                              gradient, with the movable stage as a glassy chip */}
                          <div className="relative">
                            {v ? (
                              <Link
                                href={`/vehicles/${v.id}`}
                                title="Open vehicle details"
                                className="block"
                              >
                                <VehicleImage
                                  vehicle={v}
                                  variant="card"
                                  className="rounded-none"
                                />
                              </Link>
                            ) : (
                              <div className="grid aspect-[16/10] w-full place-items-center bg-gradient-to-br from-muted to-muted-foreground/20 text-muted-foreground/50">
                                <Car className="size-6" />
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
                              {v ? (
                                <Link
                                  href={`/vehicles/${v.id}`}
                                  title="Open vehicle details"
                                  className="pointer-events-auto transition-opacity hover:opacity-80"
                                >
                                  <RegPlate registration={v.registration} size="sm" />
                                </Link>
                              ) : (
                                <span />
                              )}
                              {dealValue(d) != null ? (
                                <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-black shadow backdrop-blur">
                                  {formatCurrency(dealValue(d))}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <Link
                                href={v ? `/vehicles/${v.id}` : "#"}
                                className="truncate text-sm font-semibold leading-tight hover:underline"
                              >
                                {d.customerName}
                              </Link>
                              <span
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-1",
                                  ageTone(days),
                                )}
                              >
                                <Clock className="size-3" />
                                {days}d
                              </span>
                            </div>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {v ? `${v.make} ${v.model}` : "—"}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              {agent ? (
                                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                  <Avatar size="sm" className="size-5">
                                    <AvatarFallback className="text-2xs">
                                      {getInitials(agent.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">{agent.name}</span>
                                </span>
                              ) : (
                                <span />
                              )}
                              <span className="inline-flex shrink-0 items-center gap-1 text-2xs text-muted-foreground">
                                <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                                {formatRelativeTime(d.updatedAt)}
                              </span>
                            </div>
                            {showInvoiceCta && (
                              <Button
                                asChild
                                size="sm"
                                className="mt-1 h-8 w-full text-xs"
                              >
                                <Link
                                  href={
                                    v
                                      ? `/sales/invoice-generation?vehicleId=${v.id}`
                                      : "/sales/invoice-generation"
                                  }
                                >
                                  <Receipt className="mr-1 h-3 w-3" />
                                  Generate Invoice
                                </Link>
                              </Button>
                            )}
                          </div>
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
