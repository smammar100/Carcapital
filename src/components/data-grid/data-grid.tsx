"use client";

import {
  Calendar as CalendarIcon,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Hash,
  Phone,
  Plus,
  PoundSterling,
  Tag,
  Type,
  User as UserIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  AppointmentOutcomeCell,
  AppointmentStatusCell,
  AtIndicatorCell,
  BooleanCell,
  ChannelsCell,
  CurrencyCell,
  DateCell,
  DateRangeCell,
  EmptyCell,
  InvoiceStatusCell,
  LeadStatusCell,
  MaintenanceStatusCell,
  NumberCell,
  PhoneCell,
  ReturnResolutionCell,
  ReturnStatusCell,
  SalesStageCell,
  SelectCell,
  TextCell,
  UserCell,
  VehicleCell,
  VehicleStatusCell,
  WarrantyStatusCell,
} from "./cells";
import type { ColumnDef, ColType, SelectionState } from "./types";
import { DENSITY_ROW_HEIGHT, type Density } from "./density";

/** Row height fallback (matches the legacy h-13 = 3.25rem). */
const ROW_H = "var(--dg-row-h, 3.25rem)";

const TYPE_ICON: Record<ColType, LucideIcon> = {
  vehicle: Car,
  user: UserIcon,
  text: Type,
  phone: Phone,
  number: Hash,
  currency: PoundSterling,
  date: CalendarIcon,
  dateRange: CalendarIcon,
  boolean: Check,
  select: Tag,
  channels: Tag,
  vehicleStatus: Tag,
  salesStage: Tag,
  leadStatus: Tag,
  appointmentStatus: Tag,
  appointmentOutcome: Tag,
  warrantyStatus: Tag,
  invoiceStatus: Tag,
  returnStatus: Tag,
  returnResolution: Tag,
  atIndicator: Tag,
  custom: Type,
};

function alignFor(col: ColumnDef<unknown>): "left" | "right" | "center" {
  if (col.align) return col.align;
  if (col.type === "number" || col.type === "currency") return "right";
  return "left";
}

function getValue<T>(col: ColumnDef<T>, row: T): unknown {
  if (col.get) return col.get(row);
  return (row as Record<string, unknown>)[col.key];
}

// ────────────────────────────────────────────────────────────────────────────
// Shell
// ────────────────────────────────────────────────────────────────────────────

interface ShellProps {
  children: ReactNode;
  className?: string;
  /** When true, renders as a plain div instead of a Card (use when embedding in another Card). */
  bare?: boolean;
}

export function DataGridShell({ children, className, bare }: ShellProps) {
  if (bare) {
    return (
      <div className={cn("relative overflow-auto", className)}>{children}</div>
    );
  }
  return (
    <Card className={cn("flex min-h-0 flex-col p-0", className)}>
      <div className="relative min-h-0 flex-1 overflow-auto">{children}</div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Table wrapper — handles colgroup, sets w-max vs w-full
// ────────────────────────────────────────────────────────────────────────────

interface TableProps<T> {
  cols: ColumnDef<T>[];
  selection?: SelectionState;
  trailing?: boolean;
  /**
   * When true (default), the table fills the available width so columns
   * spread to use the viewport. Pass `fluid={false}` for very wide tables
   * (master-sheet) where horizontal scroll is preferable.
   */
  fluid?: boolean;
  /** Row density — sets the `--dg-row-h` CSS variable rows render against. */
  density?: Density;
  children: ReactNode;
}

export function DataGridTable<T>({
  cols,
  selection,
  trailing,
  fluid = true,
  density = "normal",
  children,
}: TableProps<T>) {
  return (
    <table
      className={cn(
        "border-separate text-xs",
        fluid ? "w-full min-w-max" : "w-max",
      )}
      style={
        {
          borderSpacing: 0,
          "--dg-row-h": DENSITY_ROW_HEIGHT[density],
        } as React.CSSProperties
      }
      data-grid=""
      data-fluid={fluid ? "" : undefined}
      data-density={density}
    >
      {/* In non-fluid mode (master-sheet style), pin column widths via colgroup
       * so very wide tables stay at min-content width and scroll horizontally.
       * In fluid mode the colgroup is omitted; widths become min-widths on the
       * <th> cells (see DataGridHeaderRow below) so columns flex up to fill
       * the available space. */}
      {!fluid ? (
        <colgroup>
          {selection ? <col style={{ width: 40 }} /> : null}
          {cols.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
          {trailing ? <col style={{ width: 40 }} /> : null}
        </colgroup>
      ) : null}
      {children}
    </table>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header
// ────────────────────────────────────────────────────────────────────────────

interface HeaderProps<T> {
  cols: ColumnDef<T>[];
  selection?: SelectionState;
  trailing?: boolean;
  /** Pass-through from DataGridTable. Only used to attach min-width hints. */
  fluid?: boolean;
  /**
   * The identifier of the column the data is currently sorted by (matches a
   * column's `sortKey` or, if absent, its `key`). When it matches a sortable
   * column, that header shows an active up/down chevron.
   */
  sortKey?: string;
  /** Direction of the active sort. Drives the chevron icon. */
  sortDir?: "asc" | "desc";
  /**
   * Called with a column's `sortKey ?? key` when a sortable header is
   * clicked. The consumer owns toggling asc/desc + the actual comparison.
   * Sortable headers are inert (plain labels) when this is omitted.
   */
  onSort?: (key: string) => void;
}

export function DataGridHeaderRow<T>({
  cols,
  selection,
  trailing,
  fluid = true,
  sortKey,
  sortDir,
  onSort,
}: HeaderProps<T>) {
  // Sticky cells need SOLID backgrounds — a translucent sticky cell lets
  // scrolled-out content show through, corrupting the cell text. `bg-card`
  // is both opaque and the white table surface (GEN-62); the header still
  // reads as a band via its borders + font-medium.
  // The right-edge drop shadow marks the boundary between pinned and
  // scrollable content; only the rightmost sticky cell's shadow is
  // visually present at any moment (inner shadows are occluded by the
  // next sticky cell's background via paint order).
  return (
    <thead className="sticky top-0 z-20 bg-card">
      <tr>
        {selection ? (
          <th
            className="sticky left-0 z-30 border-b border-r bg-card shadow-[2px_0_4px_-2px_var(--shadow-color)]"
            style={{ width: 40 }}
          >
            <div className="flex h-8 items-center justify-center">
              <Checkbox
                checked={selection.allSelected}
                onCheckedChange={selection.toggleAll}
                aria-label="Select all"
              />
            </div>
          </th>
        ) : null}
        {cols.map((c) => {
          const Icon = c.headerIcon ?? TYPE_ICON[c.type];
          const align = alignFor(c as ColumnDef<unknown>);
          // In fluid mode, widths become min-widths so columns can grow to
          // fill the available width via the table's `w-full` rule. In
          // non-fluid mode the colgroup pins exact widths instead.
          const widthStyle: React.CSSProperties = c.width
            ? fluid
              ? { minWidth: c.width }
              : {}
            : {};
          const stickyStyle: React.CSSProperties = c.sticky
            ? { left: selection ? 40 : 0 }
            : {};
          // A column is an interactive sort control only when it opts in
          // (`sortable`) AND the consumer wired an `onSort` handler. The
          // identifier passed back is `sortKey` when present, else `key`.
          const sortId = c.sortKey ?? c.key;
          const isSortable = Boolean(c.sortable && onSort);
          const isActiveSort = isSortable && sortKey === sortId;
          const SortIcon = isActiveSort
            ? sortDir === "asc"
              ? ChevronUp
              : ChevronDown
            : ChevronsUpDown;
          const inner = (
            <>
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate text-foreground">{c.label}</span>
              {isSortable ? (
                <SortIcon
                  className={cn(
                    "h-3 w-3 shrink-0",
                    isActiveSort
                      ? "text-foreground"
                      : "text-muted-foreground/40",
                  )}
                />
              ) : null}
            </>
          );
          return (
            <th
              key={c.key}
              aria-sort={
                isActiveSort
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : isSortable
                    ? "none"
                    : undefined
              }
              className={cn(
                "border-b border-r px-3 text-left font-medium",
                c.sticky &&
                  "sticky z-30 bg-card shadow-[2px_0_4px_-2px_var(--shadow-color)]",
              )}
              style={{ ...widthStyle, ...stickyStyle }}
            >
              {isSortable ? (
                <button
                  type="button"
                  onClick={() => onSort?.(sortId)}
                  title={`Click to sort by ${c.label}`}
                  className={cn(
                    "-mx-1 flex h-8 w-full cursor-pointer items-center gap-1.5 rounded px-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                    align === "right" && "justify-end",
                    align === "center" && "justify-center",
                  )}
                >
                  {inner}
                </button>
              ) : (
                <div
                  className={cn(
                    "flex h-8 items-center gap-1.5 text-xs text-muted-foreground",
                    align === "right" && "justify-end",
                    align === "center" && "justify-center",
                  )}
                >
                  {inner}
                </div>
              )}
            </th>
          );
        })}
        {trailing ? (
          <th className="border-b">
            <div className="flex h-8 items-center justify-center text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
            </div>
          </th>
        ) : null}
      </tr>
    </thead>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Row + cell
// ────────────────────────────────────────────────────────────────────────────

interface RowProps<T> {
  row: T;
  cols: ColumnDef<T>[];
  index: number;
  selection?: SelectionState;
  rowId?: string;
  trailing?: boolean;
  onClick?: (row: T) => void;
}

const INTERACTIVE_SELECTOR =
  "button, a, [role='checkbox'], input, select, textarea, [data-stop]";

export function DataGridRow<T>({
  row,
  cols,
  index,
  selection,
  rowId,
  trailing,
  onClick,
}: RowProps<T>) {
  const isSelected = rowId !== undefined && selection?.selected.has(rowId);
  const clickable = onClick !== undefined;

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (!onClick) return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    onClick(row);
  }

  return (
    <tr
      className={cn(
        "group/row",
        isSelected && "bg-primary/5",
        clickable && "cursor-pointer",
      )}
      onClick={handleClick}
    >
      {selection && rowId ? (
        <td
          className={cn(
            // Sticky cells use SOLID backgrounds. Earlier translucent
            // versions (`bg-muted/40`, `bg-primary/5`) let scrolled-out
            // content bleed through and visually corrupt the cell text
            // (e.g. a date column's "04/07/2026" sliding under the
            // sticky stock-ID column produced "CC400072026"-style
            // artifacts). The drop shadow marks the boundary between
            // pinned and scrollable content.
            // bg-card keeps it opaque AND white (GEN-62); the row's tints
            // are mixed into --card so sticky cells match the normal ones.
            "sticky left-0 z-10 border-b border-r bg-card text-center",
            "shadow-[2px_0_4px_-2px_var(--shadow-color)]",
            isSelected &&
              "bg-[color-mix(in_srgb,var(--primary)_5%,var(--card))]",
            "group-hover/row:bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))]",
          )}
        >
          <div
            className="flex items-center justify-center"
            style={{ height: ROW_H }}
          >
            <span className="text-xs tabular-nums text-muted-foreground group-hover/row:hidden group-has-[[data-state=checked]]/row:hidden">
              {index + 1}
            </span>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => selection.toggle(rowId)}
              aria-label={`Select row ${index + 1}`}
              className={cn(
                "hidden group-hover/row:inline-flex",
                isSelected && "inline-flex",
              )}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </td>
      ) : null}
      {cols.map((c) => {
        const align = alignFor(c as ColumnDef<unknown>);
        return (
          <td
            key={c.key}
            className={cn(
              "border-b border-r px-3",
              // Sticky data cells: SOLID bg + drop shadow. States mix the
              // row's tints into --card so they stay opaque (no bleed) while
              // matching the normal cells exactly (GEN-62).
              c.sticky &&
                "sticky z-10 bg-card shadow-[2px_0_4px_-2px_var(--shadow-color)] group-hover/row:bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))]",
              isSelected &&
                c.sticky &&
                "bg-[color-mix(in_srgb,var(--primary)_5%,var(--card))]",
              // Non-sticky cells keep the translucent hover/select tints
              // — they don't have a bleed problem because nothing slides
              // under them during scroll.
              !c.sticky && "group-hover/row:bg-muted/40",
            )}
            style={c.sticky ? { left: selection ? 40 : 0 } : undefined}
          >
            <div
              className={cn(
                "flex items-center",
                align === "right" && "justify-end",
                align === "center" && "justify-center",
              )}
              style={{ height: ROW_H }}
            >
              <DataGridCell col={c} row={row} index={index} />
            </div>
          </td>
        );
      })}
      {trailing ? <td className="border-b group-hover/row:bg-muted/40" /> : null}
    </tr>
  );
}

interface CellProps<T> {
  col: ColumnDef<T>;
  row: T;
  index: number;
}

function DataGridCell<T>({ col, row, index }: CellProps<T>) {
  if (col.render) return <>{col.render(row, index)}</>;
  const value = getValue(col, row);
  if (value === null || value === undefined || value === "") return <EmptyCell />;
  switch (col.type) {
    case "vehicle":
      return <VehicleCell vehicle={value as never} />;
    case "user":
      return <UserCell name={String(value)} />;
    case "phone":
      return <PhoneCell value={String(value)} />;
    case "number":
      return <NumberCell value={Number(value)} />;
    case "currency":
      return <CurrencyCell value={Number(value)} />;
    case "date":
      return <DateCell value={String(value)} />;
    case "dateRange": {
      const v = value as { start?: string; end?: string } | null;
      return <DateRangeCell start={v?.start} end={v?.end} />;
    }
    case "boolean":
      return <BooleanCell value={Boolean(value)} />;
    case "select":
      return <SelectCell value={value} />;
    case "channels":
      return <ChannelsCell channels={value as Record<string, boolean>} />;
    case "vehicleStatus":
      return <VehicleStatusCell status={value as never} />;
    case "salesStage":
      return <SalesStageCell stage={value as never} />;
    case "leadStatus":
      return <LeadStatusCell status={value as never} />;
    case "appointmentStatus":
      return <AppointmentStatusCell status={value as never} />;
    case "appointmentOutcome":
      return <AppointmentOutcomeCell outcome={value as never} />;
    case "warrantyStatus":
      return <WarrantyStatusCell status={value as never} />;
    case "invoiceStatus":
      return <InvoiceStatusCell status={value as never} />;
    case "returnStatus":
      return <ReturnStatusCell status={value as never} />;
    case "returnResolution":
      return <ReturnResolutionCell resolution={value as never} />;
    case "atIndicator":
      return <AtIndicatorCell indicator={String(value)} />;
    case "text":
    case "custom":
    default:
      return <TextCell value={value} />;
  }
}

// Dummy import so TS doesn't grumble about unused MaintenanceStatusCell —
// it's part of the public API even if no consumer uses it via dispatch.
void MaintenanceStatusCell;
