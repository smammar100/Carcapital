"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Cell,
  Column,
  Content,
  Heading,
  LinkButton,
  Row,
  Skeleton,
  StatusLight,
  TableBody,
  TableHeader,
  TableView,
  Text,
} from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { claimService } from "@/lib/services/claim-service";
import { leadService } from "@/lib/services/lead-service";
import { salesService } from "@/lib/services/sales-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import type {
  Lead,
  MaintenanceJob,
  SalesDeal,
  SalesStage,
  Vehicle,
  WarrantyClaim,
} from "@/lib/types";
import { DAYS_IN_STOCK_THRESHOLDS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface DashboardData {
  vehicles: Vehicle[];
  claims: WarrantyClaim[];
  leads: Lead[];
  deals: SalesDeal[];
  jobs: MaintenanceJob[];
}

/**
 * Dashboard — Pilot for the React Spectrum S2 design language migration.
 *
 * Per v4.1 §11.2 + Gap 9: 6 KPI cards, Deals in Progress widget, Ongoing
 * Repairs widget (replaces Total Revenue), Recent Deals + Lead Sources.
 *
 * Layout uses S2's `style` macro for spacing — every component is from
 * `@react-spectrum/s2`. The shell (sidebar + header) stays on the existing
 * Tailwind grid for now; this page is the proof-of-concept for the rest of
 * the app to follow.
 */
export default function DashboardPage() {
  const { user, company } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      vehicleService.getAll(company.id),
      claimService.getAll(company.id),
      leadService.getAll(company.id),
      salesService.getAll(company.id),
      maintenanceService.getAll(company.id),
    ]).then(([vehicles, claims, leads, deals, jobs]) => {
      setData({ vehicles, claims, leads, deals, jobs });
    });
  }, [company]);

  return (
    <div
      className={style({
        display: "flex",
        flexDirection: "column",
        gap: 24,
      })}
    >
      <Greeting
        userName={user?.name?.split(" ")[0] ?? "there"}
        data={data}
        onAdd={() => router.push("/inventory/add-vehicle")}
      />
      <KpiRow data={data} />
      <div
        className={style({
          display: "grid",
          gridTemplateColumns: { default: "1fr", lg: "1fr 1fr" },
          gap: 12,
        })}
      >
        <DealsInProgress data={data} />
        <OngoingRepairs data={data} />
      </div>
      <div
        className={style({
          display: "grid",
          gridTemplateColumns: { default: "1fr", lg: "2fr 1fr" },
          gap: 12,
        })}
      >
        <RecentDeals data={data} />
        <LeadSources data={data} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Greeting
// ----------------------------------------------------------------------
function Greeting({
  userName,
  data,
  onAdd,
}: {
  userName: string;
  data: DashboardData | null;
  onAdd: () => void;
}) {
  const carsToPrep =
    data?.vehicles.filter((v) =>
      ["received", "inspection_pending", "being_prepared"].includes(v.status),
    ).length ?? 0;
  return (
    <div
      className={style({
        display: "flex",
        flexDirection: { default: "column", sm: "row" },
        alignItems: { default: "start", sm: "center" },
        justifyContent: "space-between",
        gap: 16,
      })}
    >
      <div className={style({ display: "flex", flexDirection: "column", gap: 4 })}>
        <Heading level={1} styles={style({ font: "heading-xl" })}>
          Welcome Back, {userName}!
        </Heading>
        <Text styles={style({ font: "ui", color: "gray-700" })}>
          Today you have {carsToPrep} cars to prep, 0 returns pending
        </Text>
      </div>
      <div className={style({ display: "flex", gap: 8 })}>
        <Button variant="secondary">Export</Button>
        <Button variant="accent" onPress={onAdd}>
          + Add Vehicle
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// KPI row — 6 cards (v4.1 §11.2)
// ----------------------------------------------------------------------
function KpiRow({ data }: { data: DashboardData | null }) {
  const counts = useDashboardCounts(data);
  return (
    <div
      className={style({
        display: "grid",
        gridTemplateColumns: {
          default: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          xl: "repeat(6, 1fr)",
        },
        gap: 12,
      })}
    >
      <KpiCard label="Cars in Stock" value={counts?.carsInStock} />
      <KpiCard label="Cars in Readiness" value={counts?.carsInReadiness} />
      <KpiCard label="Sold This Month" value={counts?.soldThisMonth} />
      <KpiCard label="Warranty Open Claims" value={counts?.openClaims} />
      <KpiCard label="New Leads (24h)" value={counts?.newLeads24h} />
      <KpiCard
        label="Avg Days in Stock"
        value={counts ? `${counts.avgDays}d` : null}
        tone={
          counts === null
            ? undefined
            : counts.avgDays < DAYS_IN_STOCK_THRESHOLDS.green
              ? "positive"
              : counts.avgDays < DAYS_IN_STOCK_THRESHOLDS.amber
                ? "notice"
                : "negative"
        }
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string | null | undefined;
  tone?: "positive" | "notice" | "negative";
}) {
  const isLoading = value === null || value === undefined;
  return (
    <Card size="L">
      <Content>
        <Text slot="description" styles={style({ font: "ui-sm", color: "gray-700" })}>
          {label}
        </Text>
        <div className={style({ display: "flex", alignItems: "baseline", gap: 8 })}>
          <Skeleton isLoading={isLoading}>
            <Text styles={style({ font: "title-2xl" })}>
              {isLoading ? "0" : String(value)}
            </Text>
          </Skeleton>
          {tone && !isLoading && (
            <StatusLight size="S" variant={tone}>
              {tone === "positive"
                ? "healthy"
                : tone === "notice"
                  ? "slowing"
                  : "review"}
            </StatusLight>
          )}
        </div>
      </Content>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Deals in Progress
// ----------------------------------------------------------------------
const ACTIVE_STAGES: SalesStage[] = [
  "contacted",
  "test_drive",
  "offer_made",
  "deposit_taken",
];

function DealsInProgress({ data }: { data: DashboardData | null }) {
  const active = data?.deals.filter((d) => ACTIVE_STAGES.includes(d.stage)) ?? [];
  return (
    <Card size="L">
      <Content>
        <div
          className={style({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          })}
        >
          <Text slot="title" styles={style({ font: "heading-sm" })}>
            Deals in Progress
          </Text>
          <Badge variant="neutral">{active.length}</Badge>
        </div>
        {active.length === 0 ? (
          <Text styles={style({ font: "ui-sm", color: "gray-600" })}>
            No active deals.
          </Text>
        ) : (
          <ul className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
            {active.slice(0, 6).map((d) => {
              const v = data?.vehicles.find((x) => x.id === d.vehicleId);
              return (
                <li
                  key={d.id}
                  className={style({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 8,
                    borderRadius: "default",
                    backgroundColor: "layer-1",
                  })}
                >
                  <div className={style({ display: "flex", flexDirection: "column" })}>
                    <Text styles={style({ font: "ui", color: "gray-1000" })}>
                      {d.customerName}
                    </Text>
                    <Text styles={style({ font: "ui-xs", color: "gray-700" })}>
                      {v ? `${v.make} ${v.model} · ${v.stockId}` : "—"}
                    </Text>
                  </div>
                  <div
                    className={style({
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "end",
                    })}
                  >
                    <Text styles={style({ font: "ui", color: "gray-1000" })}>
                      {formatCurrency(d.agreedPrice ?? d.offerPrice ?? null)}
                    </Text>
                    <Text styles={style({ font: "ui-xs", color: "gray-600" })}>
                      {d.stage.replace("_", " ")}
                    </Text>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Content>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Ongoing Repairs (v4.1 Gap 9 — replaces Total Revenue)
// ----------------------------------------------------------------------
function OngoingRepairs({ data }: { data: DashboardData | null }) {
  const active =
    data?.jobs.filter(
      (j) => j.status === "pending" || j.status === "in_progress",
    ) ?? [];
  return (
    <Card size="L">
      <Content>
        <div
          className={style({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          })}
        >
          <Text slot="title" styles={style({ font: "heading-sm" })}>
            Ongoing Repairs
          </Text>
          <Badge variant="neutral">{active.length}</Badge>
        </div>
        {active.length === 0 ? (
          <Text styles={style({ font: "ui-sm", color: "gray-600" })}>
            No ongoing maintenance work.
          </Text>
        ) : (
          <ul className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
            {active.slice(0, 6).map((j) => {
              const v = data?.vehicles.find((x) => x.id === j.vehicleId);
              return (
                <li
                  key={j.id}
                  className={style({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 8,
                    borderRadius: "default",
                    backgroundColor: "layer-1",
                  })}
                >
                  <div
                    className={style({
                      display: "flex",
                      flexDirection: "column",
                      maxWidth: 240,
                    })}
                  >
                    <Text styles={style({ font: "ui", color: "gray-1000" })}>
                      {j.description.length > 38
                        ? j.description.slice(0, 38) + "…"
                        : j.description}
                    </Text>
                    <Text styles={style({ font: "ui-xs", color: "gray-700" })}>
                      {v ? `${v.make} ${v.model} · ${v.stockId}` : "—"}
                    </Text>
                  </div>
                  <StatusLight
                    size="S"
                    variant={j.status === "in_progress" ? "informative" : "notice"}
                  >
                    {j.status.replace("_", " ")}
                  </StatusLight>
                </li>
              );
            })}
          </ul>
        )}
      </Content>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Recent Deals (TableView)
// ----------------------------------------------------------------------
function RecentDeals({ data }: { data: DashboardData | null }) {
  const deals = data?.deals.slice(0, 6) ?? [];
  return (
    <Card size="L">
      <Content>
        <Text slot="title" styles={style({ font: "heading-sm" })}>
          Recent Deals
        </Text>
        <div className={style({ marginTop: 12 })}>
          {deals.length === 0 ? (
            <Text styles={style({ font: "ui-sm", color: "gray-600" })}>
              No recent deals.
            </Text>
          ) : (
            <TableView
              aria-label="Recent deals"
              density="compact"
              overflowMode="truncate"
            >
              <TableHeader>
                <Column key="customer" isRowHeader>
                  Customer
                </Column>
                <Column key="vehicle">Vehicle</Column>
                <Column key="stage">Stage</Column>
                <Column key="price" align="end">
                  Price
                </Column>
              </TableHeader>
              <TableBody>
                {deals.map((d) => {
                  const v = data?.vehicles.find((x) => x.id === d.vehicleId);
                  return (
                    <Row key={d.id}>
                      <Cell>{d.customerName}</Cell>
                      <Cell>
                        {v ? `${v.make} ${v.model} · ${v.stockId}` : "—"}
                      </Cell>
                      <Cell>{d.stage.replace("_", " ")}</Cell>
                      <Cell>
                        {formatCurrency(d.agreedPrice ?? d.offerPrice ?? null)}
                      </Cell>
                    </Row>
                  );
                })}
              </TableBody>
            </TableView>
          )}
        </div>
        <div className={style({ marginTop: 12 })}>
          <LinkButton variant="secondary" href="/sales/pipeline">
            View pipeline
          </LinkButton>
        </div>
      </Content>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Lead Sources
// ----------------------------------------------------------------------
function LeadSources({ data }: { data: DashboardData | null }) {
  const buckets = useMemo(() => {
    if (!data) return null;
    const bySource: Record<string, number> = {};
    for (const l of data.leads) {
      bySource[l.source] = (bySource[l.source] ?? 0) + 1;
    }
    return Object.entries(bySource).sort((a, b) => b[1] - a[1]);
  }, [data]);
  const total = buckets?.reduce((sum, [, n]) => sum + n, 0) ?? 0;
  return (
    <Card size="L">
      <Content>
        <Text slot="title" styles={style({ font: "heading-sm" })}>
          Lead Sources
        </Text>
        <div
          className={style({
            marginTop: 12,
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          })}
        >
          <Text styles={style({ font: "title-xl" })}>{total}</Text>
          <Text styles={style({ font: "ui-sm", color: "gray-700" })}>
            total leads this month
          </Text>
        </div>
        {buckets && buckets.length > 0 && (
          <ul
            className={style({
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            })}
          >
            {buckets.map(([source, n]) => (
              <li
                key={source}
                className={style({
                  display: "flex",
                  justifyContent: "space-between",
                })}
              >
                <Text styles={style({ font: "ui-sm", color: "gray-1000" })}>
                  {source.replace("_", " ")}
                </Text>
                <Text styles={style({ font: "ui-sm", color: "gray-700" })}>{n}</Text>
              </li>
            ))}
          </ul>
        )}
      </Content>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Shared count derivation
// ----------------------------------------------------------------------
function useDashboardCounts(data: DashboardData | null) {
  return useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const monthDate = new Date(now);
    const month = monthDate.getMonth();
    const year = monthDate.getFullYear();
    const activeVehicles = data.vehicles.filter(
      (v) => v.status !== "sold" && v.removedFromWebsiteAt === null,
    );
    const carsInStock = activeVehicles.length;
    const carsInReadiness = data.vehicles.filter((v) => v.status === "ready").length;
    const soldThisMonth = data.vehicles.filter((v) => {
      if (!v.dateSold) return false;
      const d = new Date(v.dateSold);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;
    const openClaims = data.claims.filter(
      (c) => c.status === "open" || c.status === "under_review",
    ).length;
    const cutoff = now - 24 * 60 * 60 * 1000;
    const newLeads24h = data.leads.filter(
      (l) => new Date(l.createdAt).getTime() >= cutoff,
    ).length;
    const avgDays =
      activeVehicles.length === 0
        ? 0
        : Math.round(
            activeVehicles.reduce((sum, v) => sum + v.daysInStock, 0) /
              activeVehicles.length,
          );
    return {
      carsInStock,
      carsInReadiness,
      soldThisMonth,
      openClaims,
      newLeads24h,
      avgDays,
    };
  }, [data]);
}
