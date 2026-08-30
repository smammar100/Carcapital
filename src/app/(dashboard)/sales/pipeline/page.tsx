"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, TrendingUp, Clock, Check, Car } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { authService } from "@/lib/services/auth-service";
import { pipelineStageService } from "@/lib/services/pipeline-stage-service";
import type {
  PipelineStage,
  SalesDeal,
  SalesStage,
  User,
  Vehicle,
} from "@/lib/types";
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
import { DealDetailSheet } from "@/components/sales/deal-detail-sheet";
import { cn, formatCurrency, formatRelativeTime, getInitials } from "@/lib/utils";
import { vehicleDetailHref } from "@/lib/vehicle-nav";
import { toast } from "@/lib/toast";
import { DragHandle } from "@/components/shared/drag-handle";

// Per-stage accent (column top-bar + dot). The shipped stages keep the colours
// they've always had; user-added stages cycle through the rest by position, so
// a new column never renders unstyled (GEN-65).
const STAGE_META: Record<string, { dot: string; bar: string }> = {
  new_lead: { dot: "bg-slate-400", bar: "border-t-slate-400" },
  contacted: { dot: "bg-blue-500", bar: "border-t-blue-500" },
  test_drive: { dot: "bg-violet-500", bar: "border-t-violet-500" },
  offer_made: { dot: "bg-amber-500", bar: "border-t-amber-500" },
  deposit_taken: { dot: "bg-orange-500", bar: "border-t-orange-500" },
  collection_delivery: { dot: "bg-teal-500", bar: "border-t-teal-500" },
  completed_sale: { dot: "bg-emerald-500", bar: "border-t-emerald-500" },
  lost: { dot: "bg-rose-500", bar: "border-t-rose-500" },
};

const FALLBACK_META: { dot: string; bar: string }[] = [
  { dot: "bg-sky-500", bar: "border-t-sky-500" },
  { dot: "bg-fuchsia-500", bar: "border-t-fuchsia-500" },
  { dot: "bg-lime-500", bar: "border-t-lime-500" },
  { dot: "bg-cyan-500", bar: "border-t-cyan-500" },
];

const metaFor = (slug: string, index: number) =>
  STAGE_META[slug] ?? FALLBACK_META[index % FALLBACK_META.length];

/**
 * A completed sale drops off the live board a fortnight after it closes —
 * agreed on the UAT call (GEN-65). It stays in Closed Deals and the master
 * sheet; this only stops the board turning into an archive.
 */
const COMPLETED_VISIBLE_DAYS = 14;

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
  const pathname = usePathname();
  const { user, company } = useAuth();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [agentFilter, setAgentFilter] = useState<string | "all">("all");
  const [nowTs, setNowTs] = useState<number | null>(null);
  const [viewDeal, setViewDeal] = useState<SalesDeal | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      salesService.getAll(company.id),
      pipelineStageService.getEnabled(company.id),
      vehicleService.getAll(company.id),
      authService.getUsersForCompany(company.id),
    ]).then(([d, s, v, u]) => {
      setDeals(d);
      setStages(s);
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
    if (!filteredDeals || stages.length === 0) return null;
    // `nowTs` is stamped once after the data loads (it also drives the card age
    // counters) — reading the clock during render is neither pure nor stable.
    const cutoff = new Date(
      (nowTs ?? 0) - COMPLETED_VISIBLE_DAYS * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const wonSlugs = new Set(
      stages.filter((s) => s.behaviour === "won").map((s) => s.slug),
    );
    const map: Record<string, SalesDeal[]> = Object.fromEntries(
      stages.map((s) => [s.slug, [] as SalesDeal[]]),
    );
    for (const d of filteredDeals) {
      // A closed sale ages off the board after a fortnight.
      if (
        wonSlugs.has(d.stage) &&
        d.completionDate &&
        d.completionDate < cutoff
      ) {
        continue;
      }
      // A deal whose stage was deleted or disabled has no column. Rather than
      // vanish, it falls into the first stage so it stays workable.
      (map[d.stage] ?? map[stages[0].slug]).push(d);
    }
    return map;
  }, [filteredDeals, stages, nowTs]);

  async function handleMove(id: string, stage: SalesStage) {
    if (!user || !company || !deals) return;
    const target = deals.find((d) => d.id === id);
    if (!target || target.stage === stage) return;
    const prevDeals = deals;
    // Optimistic: the card should land in its new column the instant it's
    // dropped, not after updateStage's write chain + a full refetch resolve
    // — that round trip previously left the board looking unresponsive
    // ("clicks not registering") for a second or more (GEN-70).
    setDeals(deals.map((d) => (d.id === id ? { ...d, stage } : d)));
    const label = stages.find((s) => s.slug === stage)?.label ?? stage;
    try {
      await salesService.updateStage(id, stage, user.id);
      setDeals(await salesService.getAll(company.id));
      toast.success(`Moved → ${label}`);
    } catch (e) {
      setDeals(prevDeals);
      toast.error(e instanceof Error ? e.message : "Couldn't move the deal");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sales Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Track every deal from new lead to completed sale. Stages are
            yours to shape: rename, reorder, add or remove them in Settings.
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
          {stages.map((stage, stageIndex) => {
            const list = grouped[stage.slug] ?? [];
            const meta = metaFor(stage.slug, stageIndex);
            const total = list.reduce((s, d) => s + (dealValue(d) ?? 0), 0);
            return (
              <div
                key={stage.slug}
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
                  if (dealId) void handleMove(dealId, stage.slug);
                }}
              >
                <div
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md border border-t-2 bg-card px-2.5 py-2",
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
                      // Invoicing opens once money is committed — any stage
                      // that reserves the car or completes the sale, whatever
                      // it has been renamed to (GEN-65).
                      const showInvoiceCta =
                        stage.behaviour === "reserved" ||
                        stage.behaviour === "won";
                      return (
                        <Card
                          key={d.id}
                          className="group/card relative cursor-grab overflow-hidden border bg-card p-0 transition-shadow hover:shadow-md active:cursor-grabbing"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/deal-id", d.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                        >
                          {/* The grip sits above the image rather than in
                              it: the header is a photo under a dark gradient,
                              and a muted glyph on that is invisible. */}
                          <DragHandle className="absolute left-1.5 top-1.5 z-10 rounded bg-background/80 p-0.5 text-muted-foreground/70 backdrop-blur-sm" />
                          {/* Premium image header — plate + price over a
                              gradient, with the movable stage as a glassy chip */}
                          <div className="relative">
                            {/* A vehicle with no hero image gets the same
                                clean muted+car-icon placeholder the grids use.
                                Rendering VehicleImage's striped placeholder
                                under the photo gradient below produced a murky
                                grey smear + a duplicate reg plate (GEN-52). */}
                            {v && v.heroImageUrl ? (
                              <Link
                                href={vehicleDetailHref(v.id, pathname)}
                                title="Open vehicle details"
                                className="block"
                              >
                                <VehicleImage
                                  vehicle={v}
                                  variant="card"
                                  className="rounded-none"
                                />
                              </Link>
                            ) : v ? (
                              <Link
                                href={vehicleDetailHref(v.id, pathname)}
                                title="Open vehicle details"
                                className="grid aspect-[16/10] w-full place-items-center bg-muted text-muted-foreground/50"
                              >
                                <Car className="size-8" strokeWidth={1.4} />
                              </Link>
                            ) : (
                              <div className="grid aspect-[16/10] w-full place-items-center bg-muted text-muted-foreground/50">
                                <Car className="size-6" />
                              </div>
                            )}
                            {/* Legibility gradient belongs over PHOTOS only —
                                on the light placeholder it just muddies it. */}
                            {v?.heroImageUrl ? (
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            ) : null}
                            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
                              {v ? (
                                <Link
                                  href={vehicleDetailHref(v.id, pathname)}
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewDeal(d);
                                }}
                                className="truncate text-left text-sm font-semibold leading-tight hover:underline"
                                title="Open deal details"
                              >
                                {d.customerName}
                              </button>
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

      <DealDetailSheet
        deal={viewDeal}
        vehicle={
          viewDeal
            ? (vehicles.find((v) => v.id === viewDeal.vehicleId) ?? null)
            : null
        }
        agent={
          viewDeal
            ? (users.find((u) => u.id === viewDeal.sellingAgent) ?? null)
            : null
        }
        users={users}
        open={viewDeal !== null}
        onOpenChange={(o) => {
          if (!o) setViewDeal(null);
        }}
      />
    </div>
  );
}
