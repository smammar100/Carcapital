"use client";

import * as React from "react";
import { useState } from "react";
import { Pencil, RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

/**
 * ComplianceCard — read-only summary of the DVLA + DVSA fields the
 * /api/vehicle/lookup route returns. Lives between sections 3 (Documentation)
 * and 4 (Purchase Cost) on the Add Vehicle form.
 *
 * Each datum has a small Edit pencil that flips the cell into an Input so
 * Ali can override DVLA-incorrect data (e.g. taxStatus stale by a few
 * days). On blur the override propagates back to the parent via the
 * `onChange` callback.
 *
 * The card never throws — every value can be `null`. Missing values render
 * as "—" (em-dash) rather than empty space.
 */

export interface ComplianceCardValue {
  registrationDate: string | null;
  co2Emissions: number | null;
  euroStatus: string | null;
  taxStatus: string | null;
  taxDueDate: string | null;
  motStatus: string | null;
  motExpiryDate: string | null;
  wheelplan: string | null;
  automatedVehicle: boolean | null;
  dateOfLastV5CIssued: string | null;
}

interface Props {
  value: ComplianceCardValue;
  onChange: (next: Partial<ComplianceCardValue>) => void;
  /** Show a small "Re-fetch" button that calls back to the parent's lookup. */
  onRefetch?: () => void;
  /** True when a lookup is in flight (disables the Re-fetch button). */
  refetching?: boolean;
  /** When did the data last arrive from the upstream APIs? */
  verifiedAt?: Date | null;
  /** Provenance markers from the route. */
  sources?: {
    dvla: "ok" | "error";
    dvsa: "ok" | "error" | "missing_credentials";
    autotrader: "ok" | "error" | "missing_credentials";
  };
  /** Which upstream supplied the MOT fields (F-AT4). */
  motSource?: "dvsa" | "autotrader" | "dvla" | null;
}

const MOT_SOURCE_LABEL: Record<string, string> = {
  dvsa: "via DVSA",
  autotrader: "via AutoTrader",
  dvla: "via DVLA",
};

export function ComplianceCard({
  value,
  onChange,
  onRefetch,
  refetching,
  verifiedAt,
  sources,
  motSource,
}: Props) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-emerald-600" />
          Compliance &amp; Verification
        </h2>
        <div className="flex items-center gap-2">
          {sources ? (
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              DVLA {sources.dvla === "ok" ? "✓" : "✗"} · DVSA{" "}
              {sources.dvsa === "ok" ? "✓" : sources.dvsa === "missing_credentials" ? "—" : "✗"}{" "}
              · AT{" "}
              {sources.autotrader === "ok"
                ? "✓"
                : sources.autotrader === "missing_credentials"
                  ? "—"
                  : "✗"}
            </span>
          ) : null}
          {onRefetch ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRefetch}
              disabled={refetching}
            >
              <RefreshCw
                className={cn("mr-1 size-3.5", refetching && "animate-spin")}
              />
              Re-fetch
            </Button>
          ) : null}
        </div>
      </div>

      {/* Status badges — Tax + MOT, full-width row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusTile
          label="Tax"
          status={value.taxStatus}
          tone={taxTone(value.taxStatus)}
          subtitle={
            value.taxDueDate ? `Due ${formatDate(value.taxDueDate)}` : "No due date"
          }
        />
        <StatusTile
          label="MOT"
          status={value.motStatus}
          tone={motTone(value.motStatus)}
          subtitle={
            [
              value.motExpiryDate
                ? `Expires ${formatDate(value.motExpiryDate)}`
                : "No expiry on file",
              motSource ? MOT_SOURCE_LABEL[motSource] : null,
            ]
              .filter(Boolean)
              .join(" · ")
          }
        />
      </div>

      {/* 6 detail fields in a 2/3-col grid with override pencils */}
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <EditableField
          label="Registration Date"
          value={value.registrationDate}
          type="date"
          onCommit={(v) => onChange({ registrationDate: v })}
        />
        <EditableField
          label="CO₂ (g/km)"
          value={value.co2Emissions == null ? null : String(value.co2Emissions)}
          type="number"
          onCommit={(v) =>
            onChange({
              co2Emissions:
                v == null || v === "" ? null : Number.parseInt(v, 10) || null,
            })
          }
        />
        <EditableField
          label="Euro Status"
          value={value.euroStatus}
          type="text"
          onCommit={(v) => onChange({ euroStatus: v })}
        />
        <EditableField
          label="Wheelplan"
          value={value.wheelplan}
          type="text"
          onCommit={(v) => onChange({ wheelplan: v })}
        />
        <EditableField
          label="Automated Vehicle"
          value={
            value.automatedVehicle == null
              ? null
              : value.automatedVehicle
                ? "Yes"
                : "No"
          }
          type="text"
          onCommit={(v) =>
            onChange({ automatedVehicle: parseYesNo(v) })
          }
        />
        <EditableField
          label="Last V5C Issued"
          value={value.dateOfLastV5CIssued}
          type="date"
          onCommit={(v) => onChange({ dateOfLastV5CIssued: v })}
        />
      </div>

      {verifiedAt ? (
        <p className="text-xs text-muted-foreground">
          Verified by DVLA + DVSA at {verifiedAt.toLocaleTimeString()}.
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Enter a registration above and click DVLA to populate.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Parse a free-text Yes/No override into a boolean. Returns null for blank
 *  or unrecognised input so the field can be cleared back to "—". */
function parseYesNo(v: string | null): boolean | null {
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if (s === "") return null;
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return null;
}

type Tone = "good" | "bad" | "neutral";

function taxTone(s: string | null): Tone {
  if (!s) return "neutral";
  const v = s.toLowerCase();
  if (v.includes("untax") || v.includes("sorn") || v.includes("not taxed")) return "bad";
  if (v.includes("tax")) return "good";
  return "neutral";
}

function motTone(s: string | null): Tone {
  if (!s) return "neutral";
  const v = s.toLowerCase();
  if (v.startsWith("valid")) return "good";
  if (v.includes("not valid") || v.includes("expired")) return "bad";
  return "neutral";
}

function StatusTile({
  label,
  status,
  tone,
  subtitle,
}: {
  label: string;
  status: string | null;
  tone: Tone;
  subtitle: string;
}) {
  const badgeClass =
    tone === "good"
      ? "border-transparent bg-emerald-100 text-emerald-800"
      : tone === "bad"
        ? "border-transparent bg-rose-100 text-rose-800"
        : "border-transparent bg-muted text-muted-foreground";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <Badge className={cn("text-xs", badgeClass)}>{status ?? "—"}</Badge>
    </div>
  );
}

function EditableField({
  label,
  value,
  type,
  readOnly,
  onCommit,
}: {
  label: string;
  value: string | null;
  type: "text" | "number" | "date";
  readOnly?: boolean;
  onCommit: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  // Sync the local draft when the parent's value changes (re-fetch landed,
  // sibling override flipped it, etc.). This is the documented React
  // pattern for "mirror an external prop" — the rule is silenced here.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setDraft(value ?? "");
  }, [value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function commit() {
    onCommit(draft.trim() === "" ? null : draft);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {!readOnly && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Override ${label}`}
          >
            <Pencil className="size-3" />
          </button>
        ) : null}
      </div>
      {editing ? (
        <Input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          autoFocus
          className="h-8 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => !readOnly && setEditing(true)}
          disabled={readOnly}
          className={cn(
            "w-full rounded-md border bg-muted/30 px-2.5 py-1.5 text-left text-sm tabular-nums",
            !readOnly &&
              "cursor-text transition-colors hover:border-primary/40 hover:bg-muted/50",
          )}
          aria-label={readOnly ? label : `Edit ${label}`}
        >
          {value && value.trim() !== "" ? (
            type === "date" ? (
              formatDate(value)
            ) : (
              value
            )
          ) : (
            <span className="text-muted-foreground">
              {readOnly ? "—" : "— add"}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
