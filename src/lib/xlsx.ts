/*
 * Minimal .xlsx writer — an XLSX file is a zip of small XML parts, so we
 * hand-write the XML and zip it with fflate (~8 kB). Supports exactly what
 * report exports need: multiple named sheets, string/number cells, a bold
 * header row, and column widths. No styling engine, no formulas.
 */

import { strToU8, zipSync } from "fflate";

export type CellValue = string | number | null | undefined;

export interface Sheet {
  /** Tab name (Excel limit: 31 chars, no \ / ? * [ ] :). */
  name: string;
  /** First row is rendered bold (header) when `headerRow` is true. */
  rows: CellValue[][];
  headerRow?: boolean;
  /** Optional column widths in characters (defaults to 14). */
  colWidths?: number[];
}

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Column index (0-based) → A1-style letters. */
function colRef(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const sheetNameSafe = (name: string): string =>
  name.replace(/[\\/?*[\]:]/g, "–").slice(0, 31) || "Sheet";

function sheetXml(sheet: Sheet): string {
  const widths = sheet.colWidths ?? [];
  const colCount = Math.max(...sheet.rows.map((r) => r.length), 1);
  const cols = Array.from({ length: colCount }, (_, i) => {
    const w = widths[i] ?? 14;
    return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
  }).join("");

  const rows = sheet.rows
    .map((row, ri) => {
      const cells = row
        .map((v, ci) => {
          if (v === null || v === undefined || v === "") return "";
          const ref = `${colRef(ci)}${ri + 1}`;
          const style = sheet.headerRow && ri === 0 ? ' s="1"' : "";
          if (typeof v === "number" && Number.isFinite(v)) {
            return `<c r="${ref}"${style}><v>${v}</v></c>`;
          }
          // Inline strings avoid a shared-strings table.
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows}</sheetData>` +
    `</worksheet>`
  );
}

/** Build an .xlsx workbook (as bytes) from a list of sheets. */
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const named = sheets.map((s, i) => ({
    ...s,
    name: sheetNameSafe(s.name) || `Sheet${i + 1}`,
  }));

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    named
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    named
      .map(
        (s, i) =>
          `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join("") +
    `</sheets>` +
    `</workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    named
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  // Two cell styles: 0 = default, 1 = bold (header rows).
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf/></cellStyleXfs>` +
    `<cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs>` +
    `</styleSheet>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
    "xl/styles.xml": strToU8(styles),
  };
  named.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s));
  });

  return zipSync(files);
}

/** Build and download an .xlsx in the browser. */
export function downloadXlsx(sheets: Sheet[], filename: string): void {
  const bytes = buildXlsx(sheets);
  // Copy into a fresh ArrayBuffer so the BlobPart type is exact.
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
