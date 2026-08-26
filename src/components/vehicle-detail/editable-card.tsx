"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Pencil, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  diffFields,
  firstError,
  parseIntegerStrict,
  parseNumeric,
  parseOptionalText,
  type FieldChange,
  type Validator,
} from "@/lib/field-edit";

/**
 * The shared inline-edit surface behind every editable vehicle-detail card
 * (GEN-98). One component owns draft state, validation, dirty tracking and
 * the Save/Cancel affordance so that Details, Financials, Location and the
 * rest cannot drift into subtly different behaviour.
 *
 * A card is described declaratively as a list of `EditableField`s; the caller
 * supplies an `onSave` that receives only the changed keys.
 */

export type FieldKind =
  | "text"
  | "number"
  | "integer"
  | "currency"
  | "select"
  | "date"
  | "boolean";

export interface SelectOption {
  value: string;
  label: string;
}

export interface EditableField<T> {
  key: Extract<keyof T, string>;
  label: string;
  kind: FieldKind;
  /** Read-mode display. Falls back to a sensible default per kind. */
  render?: (vehicle: T) => ReactNode;
  options?: SelectOption[];
  validators?: Validator<never>[];
  /** Rendered but never editable — derived or externally-owned values. */
  readOnly?: boolean;
  /** Appended in read mode, e.g. "mi" or "cc". */
  suffix?: string;
  /** Shown under the input while editing. */
  hint?: string;
  /** Render numerics without thousands separators (years, identifiers). */
  plain?: boolean;
}

interface EditableCardProps<T extends object> {
  title: string;
  icon?: LucideIcon;
  record: T;
  fields: EditableField<T>[];
  /** Receives only changed keys plus a description of what changed. */
  onSave: (patch: Partial<T>, changes: FieldChange[]) => Promise<void>;
  /** False hides the edit affordance entirely (permission-gated). */
  canEdit?: boolean;
  /** Notified whenever this card enters or leaves edit mode. */
  onDirtyChange?: (dirty: boolean) => void;
  className?: string;
}

export function EditableCard<T extends object>({
  title,
  icon: Icon,
  record,
  fields,
  onSave,
  canEdit = true,
  onDirtyChange,
  className,
}: EditableCardProps<T>) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveFailed, setSaveFailed] = useState(false);

  const editable = useMemo(() => fields.filter((f) => !f.readOnly), [fields]);

  const startEdit = useCallback(() => {
    const source = record as Record<string, unknown>;
    const next: Record<string, string | boolean> = {};
    for (const f of editable) {
      next[f.key] = toInputValue(source[f.key], f.kind);
    }
    setDraft(next);
    setErrors({});
    setSaveFailed(false);
    setEditing(true);
  }, [editable, record]);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft({});
    setErrors({});
    setSaveFailed(false);
  }, []);

  // Parse + validate the whole draft. Returns null when anything is invalid so
  // a bad field blocks the save rather than silently dropping that one value.
  const buildTyped = useCallback((): Record<string, unknown> | null => {
    const typed: Record<string, unknown> = {};
    const nextErrors: Record<string, string> = {};

    for (const f of editable) {
      const raw = draft[f.key];
      const parsed = parseByKind(raw, f.kind);

      if (parsed === undefined) {
        nextErrors[f.key] = `${f.label} is not a valid ${
          f.kind === "date" ? "date" : "number"
        }`;
        continue;
      }

      const err = firstError(parsed as never, (f.validators ?? []) as Validator<never>[]);
      if (err) {
        nextErrors[f.key] = err;
        continue;
      }
      typed[f.key] = parsed;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length > 0 ? null : typed;
  }, [draft, editable]);

  const dirty = useMemo(() => {
    if (!editing) return false;
    const typed: Record<string, unknown> = {};
    for (const f of editable) {
      const parsed = parseByKind(draft[f.key], f.kind);
      // Unparseable input still counts as dirty — the user typed something.
      typed[f.key] = parsed === undefined ? draft[f.key] : parsed;
    }
    return diffFields(record, typed as Partial<T>).changes.length > 0;
  }, [editing, draft, editable, record]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Unsaved-change protection on tab close / reload (GEN-99 UAT 15).
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = useCallback(async () => {
    const typed = buildTyped();
    if (!typed) return;

    const labels = Object.fromEntries(fields.map((f) => [f.key, f.label]));
    const { patch, changes } = diffFields(record, typed as Partial<T>, labels);

    // No-op save must not write or log anything (GEN-99 UAT 17).
    if (changes.length === 0) {
      cancel();
      return;
    }

    setSaveFailed(false);
    setSaving(true);
    try {
      await onSave(patch, changes);
      setEditing(false);
      setDraft({});
      setErrors({});
    } catch {
      // The card stays open with the user's edits intact so nothing is lost
      // and the failure cannot read as success. Reporting the error is the
      // caller's job (it knows what the operation was); swallowing it here
      // keeps a rejected save from surfacing as an unhandled rejection.
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [buildTyped, cancel, fields, onSave, record]);

  return (
    <div
      className={cn("rounded-xl border border-border bg-card", className)}
      data-testid={`editable-card-${slug(title)}`}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <span className="text-sm font-semibold">{title}</span>

        {canEdit && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1.5 px-2 text-xs"
            onClick={startEdit}
            aria-label={`Edit ${title}`}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}

        {editing && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={cancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        )}
      </div>

      {saveFailed && (
        <div
          role="alert"
          className="border-b border-destructive/30 bg-destructive/8 px-4 py-2 text-xs text-destructive"
        >
          Those changes could not be saved. Your edits are still here — try
          again, or cancel to discard them.
        </div>
      )}

      <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div
            key={f.key}
            className={cn(
              "gap-3",
              editing && !f.readOnly
                ? "flex flex-col"
                : "flex items-center justify-between",
            )}
          >
            <span
              className={cn(
                "shrink-0 text-xs text-muted-foreground",
                editing && !f.readOnly && "font-medium",
              )}
            >
              {f.label}
            </span>

            {editing && !f.readOnly ? (
              <FieldInput
                field={f}
                value={draft[f.key]}
                error={errors[f.key]}
                onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
              />
            ) : (
              <span className="text-right text-sm tabular-nums">
                {f.render
                  ? f.render(record)
                  : defaultRender((record as Record<string, unknown>)[f.key], f)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// FIELD INPUT — one control per field kind
// ============================================================

function FieldInput<T>({
  field,
  value,
  error,
  onChange,
}: {
  field: EditableField<T>;
  value: string | boolean | undefined;
  error?: string;
  onChange: (v: string | boolean) => void;
}) {
  const describedBy = error ? `${field.key}-error` : undefined;

  const control =
    field.kind === "boolean" ? (
      <Switch
        checked={Boolean(value)}
        onCheckedChange={(c) => onChange(c)}
        aria-label={field.label}
      />
    ) : field.kind === "select" ? (
      <Select
        items={Object.fromEntries(
          (field.options ?? []).map((o) => [o.value, o.label]),
        )}
        value={String(value ?? "")}
        onValueChange={(v) => onChange(String(v))}
      >
        <SelectTrigger className="h-8 w-full text-sm" aria-label={field.label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <Input
        type={field.kind === "date" ? "date" : "text"}
        inputMode={
          field.kind === "number" ||
          field.kind === "integer" ||
          field.kind === "currency"
            ? "decimal"
            : undefined
        }
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-8"
      />
    );

  return (
    <div className="flex w-full flex-col gap-1">
      {control}
      {error && (
        <span id={describedBy} role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
      {!error && field.hint && (
        <span className="text-xs text-muted-foreground">{field.hint}</span>
      )}
    </div>
  );
}

// ============================================================
// VALUE CONVERSION
// ============================================================

/** Stored value → the string an <input> holds while editing. */
export function toInputValue(value: unknown, kind: FieldKind): string | boolean {
  if (kind === "boolean") return Boolean(value);
  if (value === null || value === undefined) return "";
  if (kind === "date") {
    // <input type="date"> requires bare YYYY-MM-DD.
    return String(value).slice(0, 10);
  }
  return String(value);
}

/** Input string → typed value. `undefined` signals "not parseable". */
export function parseByKind(
  raw: string | boolean | undefined,
  kind: FieldKind,
): unknown {
  if (kind === "boolean") return Boolean(raw);
  const s = typeof raw === "string" ? raw : "";

  switch (kind) {
    case "integer":
      return parseIntegerStrict(s);
    case "number":
    case "currency":
      return parseNumeric(s);
    case "date":
      return parseOptionalText(s);
    case "select":
      // A select whose value is the empty sentinel clears the column.
      return s === "" ? null : s;
    default:
      return parseOptionalText(s);
  }
}

function defaultRender<T>(value: unknown, field: EditableField<T>): ReactNode {
  const { kind, suffix } = field;
  if (kind === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";

  // A select shows its option label, not the stored enum value — otherwise
  // "suv" and "trade_in" leak into the UI instead of "Suv" / "Trade in".
  if (kind === "select") {
    const match = field.options?.find((o) => o.value === String(value));
    return match ? match.label : String(value);
  }

  if (kind === "currency" || kind === "number" || kind === "integer") {
    const n = Number(value);
    // Years, and any other identifier-like number, must not be grouped —
    // "2,019" reads as a quantity rather than a year.
    const text = !Number.isFinite(n)
      ? String(value)
      : field.plain
        ? String(n)
        : n.toLocaleString();
    return suffix ? `${text} ${suffix}` : text;
  }

  return suffix ? `${String(value)} ${suffix}` : String(value);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
