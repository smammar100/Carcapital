import { createClient } from "@/lib/supabase/client";
import { invalidate } from "@/lib/cache";
import type { UUID } from "@/lib/types";
import { activityService } from "./activity-service";

/**
 * One-shot launch-day migration utilities (Spec v3.0 — Module F).
 *
 * Two responsibilities:
 *   1. **Wipe seed data** before real-staff invitations go out — Chunk 1.5
 *      / Decision F-3. Deletes every `is_demo = true` row from the five
 *      tables that hold transactional data; leaves the schema and the
 *      lookup tables (companies, vendors, dealer_partners, lead_channels,
 *      custom_field_definitions, etc.) untouched.
 *   2. **Import the live master sheet** into `vehicles` — Chunk 1.6 /
 *      Decision F-2. Reads two CSVs: the dealer's master sheet and a
 *      column-mapping file. Unmapped Excel columns are dumped to
 *      `vehicles.legacy_data` so nothing is silently lost.
 *
 * Both methods write an activity-log row with `metadata.migrated = true`
 * so the launch-day audit is greppable.
 */

const NS_TOUCHED = ["users:", "vehicles:", "leads:", "appointments:", "invoices:"] as const;

/** Reusable metadata stamp. Recognised throughout the audit log. */
export const MIGRATION_METADATA = { migrated: true } as const;

interface WipeResult {
  users: number;
  vehicles: number;
  leads: number;
  appointments: number;
  invoices: number;
}

/**
 * A single mapping rule parsed from `db/migrations/mapping.template.csv`.
 * `transformation_notes` is human prose for now; recognised values trigger
 * one of the named transforms below. Unrecognised values are treated as
 * "verbatim copy" and surfaced in the result's `unknownTransforms` list.
 */
interface MappingRule {
  excelColumn: string;
  postgresColumn: string | null; // null = archive to legacy_data
  transform: string | null;
}

interface ImportResult {
  imported: number;
  failed: Array<{ row: number; error: string }>;
  unknownTransforms: string[];
  unmappedColumns: string[];
}

interface ImportInput {
  companyId: UUID;
  csvContent: string;
  mappingContent: string;
  actorId: UUID;
}

// ---------------------------------------------------------------------------
// CSV parsing — minimal but tolerant of quoted strings + escaped quotes.
// Good enough for Excel "Save As CSV"; swap for `papaparse` if a row crashes.
// ---------------------------------------------------------------------------

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      // Skip rows that are blank or pure-comment (`#…`).
      if (row.length > 1 || row[0].trim() !== "") {
        if (!row[0].trim().startsWith("#")) rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0].trim() !== "") {
      if (!row[0].trim().startsWith("#")) rows.push(row);
    }
  }
  return rows;
}

function parseMapping(mappingCsv: string): MappingRule[] {
  const rows = parseCsvRows(mappingCsv);
  if (rows.length === 0) return [];
  // Expect a header row matching the template exactly.
  const [header, ...body] = rows;
  const cols = header.map((c) => c.trim().toLowerCase());
  const iExcel = cols.indexOf("excel_column_name");
  const iPg = cols.indexOf("postgres_column_name");
  const iNote = cols.indexOf("transformation_notes");
  if (iExcel < 0 || iPg < 0) {
    throw new Error(
      "mapping.csv: missing required header row " +
        '("excel_column_name,postgres_column_name,transformation_notes")',
    );
  }
  return body
    .filter((r) => (r[iExcel] ?? "").trim() !== "")
    .map((r) => ({
      excelColumn: r[iExcel].trim(),
      postgresColumn: (r[iPg] ?? "").trim() || null,
      transform: iNote >= 0 ? (r[iNote] ?? "").trim() || null : null,
    }));
}

// Named transformations recognised by `transformation_notes`.
// Anything else is treated as verbatim copy and reported back so the
// importer warns rather than silently mis-converts.
const KNOWN_TRANSFORMS = new Set([
  "verbatim",
  "trim",
  "trim + uppercase",
  "uppercase",
  "lowercase",
  "date dd/mm/yyyy -> ISO",
  "currency £1,234.56 -> 1234.56 numeric",
  "currency -> numeric",
  "Y/N -> boolean",
  "yes/no -> boolean",
]);

function applyTransform(value: string, transform: string | null): unknown {
  const t = (transform ?? "").trim().toLowerCase();
  const v = value;
  switch (t) {
    case "":
    case "verbatim":
      return v;
    case "trim":
      return v.trim();
    case "trim + uppercase":
      return v.trim().toUpperCase();
    case "uppercase":
      return v.toUpperCase();
    case "lowercase":
      return v.toLowerCase();
    case "date dd/mm/yyyy -> iso": {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
      return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
    }
    case "currency £1,234.56 -> 1234.56 numeric":
    case "currency -> numeric": {
      const n = Number(v.replace(/[£,]/g, "").trim());
      return Number.isFinite(n) ? n : null;
    }
    case "y/n -> boolean":
    case "yes/no -> boolean":
      return /^(?:y|yes|true|1)$/i.test(v.trim());
    default:
      // Unrecognised transform — surface it to the caller but pass-through.
      return v;
  }
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export const migrationService = {
  /**
   * Delete every `is_demo = true` row from the five transactional tables.
   * Children-first ordering keeps FK constraints happy.
   *
   * Not wrapped in a single PG transaction (Supabase JS SDK doesn't expose
   * one); each DELETE is idempotent on re-run.
   */
  async wipeDemoData(companyId: UUID, actorId: UUID): Promise<WipeResult> {
    // `is_demo` / `legacy_data` columns added in migration 0009 — Supabase
    // types are regenerated separately. Until then, cast loose so the
    // file compiles. eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const counts: WipeResult = {
      users: 0,
      vehicles: 0,
      leads: 0,
      appointments: 0,
      invoices: 0,
    };

    // Order matters — children first.
    const sequence: Array<{ table: keyof WipeResult; field: "is_demo" }> = [
      { table: "appointments", field: "is_demo" },
      { table: "invoices", field: "is_demo" },
      { table: "leads", field: "is_demo" },
      { table: "vehicles", field: "is_demo" },
      { table: "users", field: "is_demo" },
    ];

    for (const { table, field } of sequence) {
      const { error, count } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .eq("company_id", companyId)
        .eq(field, true);
      if (error) throw error;
      counts[table] = count ?? 0;
    }

    for (const ns of NS_TOUCHED) invalidate(ns);

    await activityService.log({
      companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "data_migrated",
      description: `Demo data wiped: ${Object.entries(counts)
        .map(([t, n]) => `${t}=${n}`)
        .join(", ")}`,
      metadata: { ...MIGRATION_METADATA, op: "wipe", counts },
    });

    return counts;
  },

  /**
   * Import the master-sheet CSV into `vehicles` using the column mapping.
   *
   * Hard-fails if the mapping is empty (Decision F-1 hard gate). For each
   * input row:
   *   - mapped columns populate the matching `vehicles.<col>` (after the
   *     named transformation);
   *   - unmapped columns are archived as JSON in `vehicles.legacy_data`;
   *   - `received_date` is preserved from the sheet (Decision F-2);
   *   - one activity-log entry is written with `metadata.migrated = true`.
   *
   * Inserts are issued sequentially so a bad row produces a single error
   * rather than corrupting a batch. Real run is small (~hundreds of rows).
   */
  async importMasterSheet(input: ImportInput): Promise<ImportResult> {
    const rules = parseMapping(input.mappingContent);
    if (rules.length === 0) {
      throw new Error(
        "mapping.csv is empty — Phase 0 hard gate (Decision F-1). " +
          "Fill in db/migrations/mapping.template.csv before running import.",
      );
    }

    const rows = parseCsvRows(input.csvContent);
    if (rows.length < 2) {
      throw new Error("master sheet CSV has no data rows");
    }
    const [header, ...body] = rows;
    const headerTrim = header.map((h) => h.trim());

    // Build a per-row excel-column → rule lookup based on the actual header.
    const ruleByCol = new Map<string, MappingRule>();
    for (const r of rules) ruleByCol.set(r.excelColumn, r);
    const unmappedColumns = headerTrim.filter(
      (h) => !ruleByCol.has(h) || ruleByCol.get(h)?.postgresColumn == null,
    );
    const unknownTransforms: string[] = [];

    // `is_demo` / `legacy_data` columns added in migration 0009 — Supabase
    // types are regenerated separately. Until then, cast loose so the
    // file compiles. eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const result: ImportResult = {
      imported: 0,
      failed: [],
      unknownTransforms: [],
      unmappedColumns,
    };

    for (let i = 0; i < body.length; i++) {
      const row = body[i];
      const insertRow: Record<string, unknown> = { company_id: input.companyId };
      const legacy: Record<string, unknown> = {};

      for (let c = 0; c < headerTrim.length; c++) {
        const excelCol = headerTrim[c];
        const rule = ruleByCol.get(excelCol);
        const value = row[c] ?? "";
        if (!rule || !rule.postgresColumn) {
          if (value !== "") legacy[excelCol] = value;
          continue;
        }
        if (rule.transform && !KNOWN_TRANSFORMS.has(rule.transform.toLowerCase())) {
          unknownTransforms.push(rule.transform);
        }
        insertRow[rule.postgresColumn] = applyTransform(value, rule.transform);
      }

      if (Object.keys(legacy).length > 0) {
        insertRow.legacy_data = legacy;
      }
      insertRow.is_demo = false; // real data, never demo

      const { data, error } = await supabase
        .from("vehicles")
        .insert(insertRow)
        .select("id, registration")
        .single();
      if (error) {
        result.failed.push({ row: i + 2, error: error.message });
        continue;
      }

      result.imported++;
      await activityService.log({
        companyId: input.companyId,
        userId: input.actorId,
        vehicleId: (data as { id: string }).id,
        actionType: "data_migrated",
        description: `Imported ${(data as { registration: string }).registration} from master sheet`,
        metadata: { ...MIGRATION_METADATA, op: "import", rowNumber: i + 2 },
      });
    }

    result.unknownTransforms = [...new Set(unknownTransforms)];
    invalidate("vehicles:");

    await activityService.log({
      companyId: input.companyId,
      userId: input.actorId,
      vehicleId: null,
      actionType: "data_migrated",
      description: `Master-sheet import complete: ${result.imported} imported, ${result.failed.length} failed`,
      metadata: {
        ...MIGRATION_METADATA,
        op: "import_summary",
        imported: result.imported,
        failed: result.failed.length,
        unmappedColumns: result.unmappedColumns,
        unknownTransforms: result.unknownTransforms,
      },
    });

    return result;
  },
};
