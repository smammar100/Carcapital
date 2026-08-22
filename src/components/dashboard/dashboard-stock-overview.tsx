"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

/** Active stock broken into four pipeline buckets.
 *
 * Colour comes from Dashboard Home.dc.html. Note it puts green on "Ready" and
 * amber on "In preparation" — status hues on pipeline stages, which the brand
 * guideline's rule 4 argues against. Implemented as drawn (the dashboard
 * artwork is the later artefact) and flagged for reconciliation; the tokens
 * live in globals.css so a decision changes one place. */
const BUCKETS: { label: string; token: string; statuses: VehicleStatus[] }[] = [
  {
    label: "Ready to sell",
    token: "--color-stock-ready",
    statuses: ["ready", "listed", "reserved"],
  },
  {
    label: "In preparation",
    token: "--color-stock-prep",
    statuses: ["being_prepared"],
  },
  {
    label: "Awaiting inspection",
    token: "--color-stock-inspection",
    statuses: ["received", "inspection_pending"],
  },
  {
    label: "Photography",
    token: "--color-stock-photography",
    statuses: ["photos_pending", "photos_ready"],
  },
];

/* ------------------------------------------------- isometric projection */

/** True 30° isometric: a point in stage-space becomes a point on the plate. */
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * 0.866, (x + y) * 0.5 - z];
}

/** A face of a block: the same hue scaled toward black, exactly as the design
 *  computes it, but done in CSS so the colour stays a token reference instead
 *  of being read back out of the document and duplicated as a hex string. */
function face(token: string, k: number): string {
  return k >= 1
    ? `var(${token})`
    : `color-mix(in srgb, var(${token}) ${k * 100}%, #000)`;
}

const CW = 44; // block width in stage units
const CD = 44; // block depth
const SEAM = 2; // gap between stacked blocks, so segments stay countable

/**
 * Total drawing height of the column.
 *
 * The design hard-codes 2.35 units per vehicle against a viewBox sized for its
 * 63-car mock. Real stock is not 63 — at 106 cars the column ran past the top
 * of the viewBox and was cut off flat. Height is normalised to a constant
 * instead, so the column is always drawn whole and the segments read as shares
 * of it. Magnitude is not lost: the header states the total and every row
 * carries its own count.
 *
 * 148 = the design's own column height (63 x 2.35), so these proportions and
 * the hard-coded viewBox below still agree.
 */
const COLUMN_HEIGHT = 148;

type Segment = { label: string; value: number; token: string };

/**
 * One stacked isometric column — the whole of active stock as a single object,
 * segmented by stage, largest at the top.
 *
 * Depth here is presentational, and it is only safe because this is ONE column:
 * in a group of isometric bars a far bar sits higher on screen and reads as
 * larger, so never use this shape to compare separate values.
 */
function StackColumn({ segments }: { segments: Segment[] }) {
  const faces: React.ReactElement[] = [];
  let z = 0;

  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  if (total <= 0) return null;
  const unit = COLUMN_HEIGHT / total;

  // Reversed: the first bucket is drawn last and therefore ends up on top.
  for (const [i, seg] of [...segments].reverse().entries()) {
    // Floor of 1 unit: a stage holding a couple of cars out of a hundred is
    // thinner than the seam, and subtracting the seam would take it negative —
    // it would vanish from the column while its row still read "1 · 1%".
    // A stage with cars in it always draws something.
    const height = Math.max(seg.value * unit - SEAM, 1);
    const p = (x: number, y: number, zz: number) => iso(x, y, zz);
    const poly = (pts: [number, number][], fill: string, key: string) => (
      <polygon
        fill={fill}
        key={key}
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
      />
    );
    faces.push(
      poly(
        [
          p(0, CD, z + height),
          p(CW, CD, z + height),
          p(CW, CD, z),
          p(0, CD, z),
        ],
        face(seg.token, 0.74),
        `l${i}`,
      ),
      poly(
        [
          p(CW, 0, z + height),
          p(CW, CD, z + height),
          p(CW, CD, z),
          p(CW, 0, z),
        ],
        face(seg.token, 0.56),
        `r${i}`,
      ),
      poly(
        [
          p(0, 0, z + height),
          p(CW, 0, z + height),
          p(CW, CD, z + height),
          p(0, CD, z + height),
        ],
        face(seg.token, 1),
        `t${i}`,
      ),
    );
    z += seg.value * unit;
  }

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 block size-full overflow-hidden"
      preserveAspectRatio="xMidYMid meet"
      viewBox="-54 -156 108 210"
    >
      {/* Ground shadow, so the column sits on the card instead of floating. */}
      <ellipse
        cx={0}
        cy={iso(CW / 2, CD / 2, 0)[1] + 3}
        fill="#18181B"
        opacity={0.09}
        rx={50}
        ry={16}
      />
      {faces}
    </svg>
  );
}

/* --------------------------------------------------------------- widget */

export function DashboardStockOverview() {
  const { company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);

  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then(setVehicles);
  }, [company]);

  const { segments, total } = useMemo(() => {
    if (!vehicles) return { segments: null, total: 0 };
    const counted = BUCKETS.map((b) => ({
      label: b.label,
      token: b.token,
      value: vehicles.filter((v) => b.statuses.includes(v.status)).length,
    }));
    return {
      segments: counted,
      total: counted.reduce((sum, b) => sum + b.value, 0),
    };
  }, [vehicles]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">
            Stock by stage
          </h2>
          <span className="text-[12px] text-muted-text">
            {segments === null ? "—" : `${total} car${total === 1 ? "" : "s"}`}
          </span>
        </div>
        <Link
          className="text-[12px] text-accent-navy no-underline hover:underline"
          href="/vehicles"
        >
          Inventory
        </Link>
      </div>

      {segments === null ? (
        <div className="p-4">
          <Skeleton className="h-48" />
        </div>
      ) : total === 0 ? (
        // Rule 6: name the thing that is absent and the condition that would
        // put it there.
        <p className="px-6 py-10 text-center text-[13px] leading-[1.55] text-body-text">
          No cars are in the pipeline. Vehicles appear here from the moment they
          are booked in, and move between stages as prep and photography
          complete.
        </p>
      ) : (
        <div className="flex flex-1 items-stretch gap-2 px-4 pt-2.5 pb-3">
          <span className="relative block w-[60%] shrink-0 self-stretch">
            <StackColumn
              segments={segments.filter((seg) => seg.value > 0)}
            />
          </span>
          <span className="flex w-[40%] min-w-0 shrink-0 flex-col justify-evenly py-1">
            {segments.map((s) => (
              <span className="flex flex-col gap-[3px]" key={s.label}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="block size-[7px] shrink-0 rounded-[2px]"
                    style={{ background: `var(${s.token})` }}
                  />
                  <span className="truncate text-[11px] text-muted-text">
                    {s.label}
                  </span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[16px] font-semibold tracking-[-0.02em] tabular-nums">
                    {s.value}
                  </span>
                  {/* Rule 3: the count alone says nothing about the mix. */}
                  <span className="text-[11px] text-faint tabular-nums">
                    {total === 0 ? "0%" : `${Math.round((s.value / total) * 100)}%`}
                  </span>
                </span>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
