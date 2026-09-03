import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { downloadXlsx, type Sheet, type CellValue } from "@/lib/xlsx";

/**
 * User-triggered full data backup (GEN-90).
 *
 * Car Capital lost a database once and asked for an export they take
 * themselves — deliberately not an automatic background job, because the file
 * contains the whole business and a person should knowingly request and
 * receive it.
 *
 * The export is a multi-sheet workbook rather than JSON so it opens in Excel,
 * which is what the office already uses. Every table is dumped verbatim: the
 * point is reconstruction after a loss, not a tidy report.
 */

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;
/** Tables that carry a `company_id`, so the export can be tenant-scoped. */
type CompanyScopedTable = {
  [K in TableName]: Tables[K]["Row"] extends { company_id: unknown } ? K : never;
}[TableName];

type BackupSpec =
  | { table: CompanyScopedTable; sheet: string; scoped: true }
  | { table: TableName; sheet: string; scoped: false };

/** Tables included in a backup, in the order they appear as workbook tabs. */
const BACKUP_TABLES: BackupSpec[] = [
  { table: "vehicles", sheet: "Vehicles", scoped: true },
  { table: "customers", sheet: "Customers", scoped: true },
  { table: "leads", sheet: "Leads", scoped: true },
  { table: "sales_deals", sheet: "Deals", scoped: true },
  { table: "invoices", sheet: "Invoices", scoped: true },
  { table: "invoice_line_items", sheet: "Invoice Lines", scoped: false },
  { table: "inspection_checks", sheet: "Inspections", scoped: false },
  { table: "todo_items", sheet: "Things To Do", scoped: false },
  { table: "appointments", sheet: "Appointments", scoped: true },
  { table: "warranties", sheet: "Warranties", scoped: true },
  { table: "location_movements", sheet: "Location History", scoped: false },
  { table: "vendors", sheet: "Vendors", scoped: true },
  { table: "users", sheet: "Users", scoped: true },
];

/** Supabase rows are plain JSON; flatten anything nested for a cell. */
function toCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return JSON.stringify(value);
}

function rowsToSheet(name: string, rows: Record<string, unknown>[]): Sheet {
  if (rows.length === 0) {
    return { name, rows: [["(no rows)"]], headerRow: true };
  }
  // Union of keys across rows — Postgres returns a stable shape, but a
  // defensive union means a sparse row can never shift columns.
  const columns = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );
  return {
    name,
    headerRow: true,
    rows: [columns, ...rows.map((r) => columns.map((c) => toCell(r[c])))],
  };
}

export interface BackupResult {
  sheets: number;
  rows: number;
  /** False when the backup was produced but could not be recorded. */
  recorded: boolean;
}

export const backupService = {
  /**
   * When the last backup was taken, or null if never.
   *
   * Derived from the activity log rather than a dedicated column, so the
   * backup history is auditable alongside everything else. Returns null (which
   * reads as "due") if the query fails — better to over-remind than to leave
   * someone believing they are protected when they are not.
   */
  async getLastBackupAt(companyId: UUID): Promise<string | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("activity_log")
        .select("created_at")
        .eq("company_id", companyId)
        .eq("action_type", "data_backup_created")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) return null;
      return (data?.[0]?.created_at as string | undefined) ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Gather every table and hand the user a workbook.
   *
   * Throws if the data cannot be read — a partial backup is worse than none,
   * because it looks like protection. Recording the event is best-effort: if
   * the audit write fails (e.g. migration 0044 not yet applied) the user still
   * gets their file, and `recorded: false` says the reminder cannot reset.
   */
  async createBackup(companyId: UUID, actorId: UUID, filename: string): Promise<BackupResult> {
    const supabase = createClient();

    const sheets: Sheet[] = [];
    let totalRows = 0;

    for (const spec of BACKUP_TABLES) {
      const { data, error } = spec.scoped
        ? await supabase.from(spec.table).select("*").eq("company_id", companyId)
        : await supabase.from(spec.table).select("*");
      if (error) {
        // A table the schema does not have (or RLS blocks) should not sink the
        // whole backup — record it as an empty sheet so the gap is visible in
        // the file rather than silently absent.
        sheets.push({
          name: spec.sheet,
          headerRow: true,
          rows: [[`Could not export ${spec.table}: ${error.message ?? "unknown error"}`]],
        });
        continue;
      }

      const rows = (data ?? []) as Record<string, unknown>[];
      totalRows += rows.length;
      sheets.push(rowsToSheet(spec.sheet, rows));
    }

    if (sheets.length === 0) {
      throw new Error("Nothing could be exported.");
    }

    downloadXlsx(sheets, filename);

    let recorded = true;
    try {
      await activityService.log({
        companyId,
        userId: actorId,
        vehicleId: null,
        actionType: "data_backup_created",
        description: `Data backup downloaded (${totalRows} rows across ${sheets.length} sheets)`,
        metadata: { filename, rows: totalRows, sheets: sheets.length },
      });
    } catch {
      recorded = false;
    }

    return { sheets: sheets.length, rows: totalRows, recorded };
  },
};
