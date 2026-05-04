import type { ColumnDef } from "./types";

export function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function defaultCsv<T>(col: ColumnDef<T>, row: T): string {
  if (col.csv) return col.csv(row);
  const raw = col.get
    ? col.get(row)
    : (row as Record<string, unknown>)[col.key];
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "Y" : "N";
  return String(raw);
}

export function exportCsv<T>(
  rows: T[],
  cols: ColumnDef<T>[],
  filename: string,
): void {
  const head = cols.map((c) => csvEscape(c.label)).join(",");
  const body = rows
    .map((r) => cols.map((c) => csvEscape(defaultCsv(c, r))).join(","))
    .join("\n");
  const csv = `${head}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
