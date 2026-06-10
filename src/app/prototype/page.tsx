"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Minus,
  RefreshCw,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /prototype — design comparison surface (auth-free).
 *
 * Current feature: ADD STAFF DIALOG (username + password account with view
 * grants). 5 fully functional variations rendered OPEN on scrim frames so
 * they compare side-by-side. Every one works end-to-end: name → username
 * auto-suggestion (editable), grouped view selection with live counts,
 * deterministic temp-password regenerate + copy, validation, and a success
 * state showing the credentials. References (Mobbin): Slack onboarding
 * (stepper), Linear/Height settings dialogs (two-column), Front/Fresha
 * (role presets), Intercom new-teammate permissions (grouped sections),
 * Stripe/Intercom side panels (sheet).
 */

/* ------------------------------------------------------------ shared model */

interface PermGroup {
  label: string;
  caps: string[];
}

const PERM_GROUPS: PermGroup[] = [
  { label: "Inventory", caps: ["Add Vehicle", "Edit Vehicle", "Edit Costs", "Remove from Website"] },
  { label: "Inspection", caps: ["Run Inspection", "Add Inspection Note"] },
  { label: "Maintenance & Workshop", caps: ["Create Maintenance Job", "Edit Maintenance Job", "Complete Maintenance Job", "Add Workshop Note"] },
  { label: "Photos & Adverts", caps: ["Process Photos", "Create Listing", "Edit Listing", "Publish to AutoTrader"] },
  { label: "Leads & Sales", caps: ["Create Lead", "Edit Lead", "Book Appointment", "Edit Pipeline Stage", "Mark Sold"] },
  { label: "Invoicing", caps: ["Generate Invoice", "Send Invoice", "Mark Paid"] },
  { label: "Warranties & Returns", caps: ["Create Warranty", "Raise Claim", "Resolve Claim", "Create Vehicle Return"] },
  { label: "Admin", caps: ["View Master Sheet", "View Financials", "View Master Calendar", "Manage Users", "Manage Permissions"] },
];
const ALL_CAPS: string[] = PERM_GROUPS.flatMap((g) => g.caps);

const ROLE_PRESETS: { label: string; caps: string[] }[] = [
  { label: "Administrator", caps: ALL_CAPS },
  { label: "Inventory Manager", caps: [...PERM_GROUPS[0].caps, "Process Photos"] },
  { label: "Workshop Lead", caps: [...PERM_GROUPS[2].caps, ...PERM_GROUPS[1].caps] },
  { label: "Inspector", caps: [...PERM_GROUPS[1].caps] },
  { label: "Sales Specialist", caps: [...PERM_GROUPS[4].caps] },
  { label: "Finance Admin", caps: [...PERM_GROUPS[5].caps, "Create Vehicle Return"] },
  { label: "View Only", caps: [] },
];

/** Deterministic temp-password pool — regenerate cycles, no Math.random. */
const PASSWORDS = [
  "Xk7Trf2WqBn4!9",
  "Vm3PdJ8sRwH2!9",
  "Qt6BzN4kLcY8!9",
  "Hr9MfW3pXdK5!9",
  "Zw4SgV7nTjQ6!9",
];

const suggestUsername = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(".");

const isValidUsername = (u: string): boolean => /^[a-z0-9][a-z0-9._-]{2,}$/.test(u);

/* --------------------------------------------------------- shared form hook */

interface StaffForm {
  name: string;
  setName: (v: string) => void;
  username: string;
  setUsernameOverride: (v: string) => void;
  usernameOk: boolean;
  password: string;
  regenPassword: () => void;
  caps: Set<string>;
  toggleCap: (c: string) => void;
  setCaps: (list: string[]) => void;
  error: string | null;
  setError: (e: string | null) => void;
  created: { username: string; password: string } | null;
  submit: () => void;
  reset: () => void;
}

function useStaffForm(): StaffForm {
  const [name, setName] = useState("");
  const [usernameOverride, setUsernameOverride] = useState<string | null>(null);
  const [pwIdx, setPwIdx] = useState(0);
  const [caps, setCapsState] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  const username = usernameOverride ?? suggestUsername(name);
  const password = PASSWORDS[pwIdx % PASSWORDS.length];

  const submit = (): void => {
    if (!name.trim()) {
      setError("Enter the staff member's name.");
      return;
    }
    if (!isValidUsername(username)) {
      setError("Username needs 3+ characters (letters, digits, . _ -).");
      return;
    }
    if (caps.size === 0) {
      setError("Tick at least one view — otherwise they can't see anything.");
      return;
    }
    setError(null);
    setCreated({ username, password });
  };

  const reset = (): void => {
    setName("");
    setUsernameOverride(null);
    setCapsState(new Set());
    setPwIdx((i) => i + 1);
    setError(null);
    setCreated(null);
  };

  return {
    name,
    setName,
    username,
    setUsernameOverride: (v) => setUsernameOverride(v),
    usernameOk: isValidUsername(username),
    password,
    regenPassword: () => setPwIdx((i) => i + 1),
    caps,
    toggleCap: (c) =>
      setCapsState((prev) => {
        const next = new Set(prev);
        if (next.has(c)) next.delete(c);
        else next.add(c);
        return next;
      }),
    setCaps: (list) => setCapsState(new Set(list)),
    error,
    setError,
    created,
    submit,
    reset,
  };
}

/* ------------------------------------------------------- shared sub-pieces */

function CheckBox({ on, some = false }: { on: boolean; some?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
        on || some
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card",
      )}
    >
      {on ? <Check className="h-3 w-3" /> : some ? <Minus className="h-3 w-3" /> : null}
    </span>
  );
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-muted"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function PasswordField({ form }: { form: StaffForm }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">Temporary password</span>
      <div className="flex items-center gap-2">
        <code className="h-9 min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-3 leading-9 text-sm">
          {form.password}
        </code>
        <button
          type="button"
          aria-label="Regenerate password"
          onClick={form.regenPassword}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Auto-generated. The staff member is forced to set their own on first login.
      </p>
    </div>
  );
}

function SuccessPanel({
  created,
  onReset,
}: {
  created: { username: string; password: string };
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        Staff login created
      </p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          Username
        </span>
        <code className="min-w-0 flex-1 truncate text-xs">{created.username}</code>
        <CopyChip value={created.username} />
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          Password
        </span>
        <code className="min-w-0 flex-1 truncate text-xs">{created.password}</code>
        <CopyChip value={created.password} />
      </div>
      <p className="text-xs text-muted-foreground">
        Relay these out-of-band — they won&apos;t be shown again.
      </p>
      <div className="flex justify-end gap-2">
        <nord-button size="s" type="button" suppressHydrationWarning onClick={onReset}>
          Add another
        </nord-button>
      </div>
    </div>
  );
}

function IdentityFields({ form }: { form: StaffForm }) {
  return (
    <>
      <nord-input
        expand
        label="Name"
        type="text"
        placeholder="Ahmed Khan"
        value={form.name}
        onInput={(e) => form.setName((e.target as HTMLInputElement).value)}
        suppressHydrationWarning
      />
      <nord-input
        expand
        label="Username"
        hint="Staff log in with this username + the password below. No email needed."
        type="text"
        placeholder="ahmed.khan"
        value={form.username}
        onInput={(e) => form.setUsernameOverride((e.target as HTMLInputElement).value)}
        suppressHydrationWarning
      />
    </>
  );
}

/* --------------------------------------------------------------- page shell */

export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Prototype — Add Staff dialog · 5 functional variations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a winner (A–E). Each dialog is rendered open and fully works:
          type a name to auto-suggest the username, tick views (grouped — no
          more wall of checkboxes), regenerate/copy the temp password, submit
          to see the credentials hand-off state.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
        <Frame label="A — Two-step wizard" sub="Slack onboarding / Deel">
          <VariationA />
        </Frame>
        <Frame label="B — Two-column: identity + access" sub="Linear / Height settings">
          <VariationB />
        </Frame>
        <Frame label="C — Role preset first" sub="Front / Fresha">
          <VariationC />
        </Frame>
        <Frame label="D — Grouped accordion list" sub="Intercom teammate form">
          <VariationD />
        </Frame>
        <Frame label="E — Side panel with toggle tiles" sub="Stripe / Intercom sheet">
          <VariationE />
        </Frame>
      </div>
    </div>
  );
}

function Frame({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      {children}
    </section>
  );
}

/** Scrim-look stage the open dialog sits on. */
function Stage({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "center" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-h-[680px] rounded-lg border border-border bg-foreground/10 p-6 dark:bg-black/40",
        align === "center" ? "items-center justify-center" : "items-stretch justify-end p-0",
      )}
    >
      {children}
    </div>
  );
}

function DialogHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <UserPlus className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
      <button
        type="button"
        aria-label="Close"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- Variation A */

function VariationA(): React.ReactElement {
  const form = useStaffForm();
  const [step, setStep] = useState<0 | 1>(0);

  const nextFromIdentity = (): void => {
    if (!form.name.trim()) {
      form.setError("Enter the staff member's name.");
      return;
    }
    if (!form.usernameOk) {
      form.setError("Username needs 3+ characters (letters, digits, . _ -).");
      return;
    }
    form.setError(null);
    setStep(1);
  };

  return (
    <Stage>
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
        <DialogHeader
          title="Add staff member"
          sub={step === 0 ? "Step 1 of 2 — who are they?" : "Step 2 of 2 — what can they see?"}
        />
        {form.created ? (
          <SuccessPanel
            created={form.created}
            onReset={() => {
              form.reset();
              setStep(0);
            }}
          />
        ) : (
          <>
            {/* Step dots */}
            <div className="flex items-center gap-1.5 px-4 pt-3">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    step === i ? "w-6 bg-primary" : "w-1.5 bg-border",
                  )}
                />
              ))}
            </div>

            {step === 0 ? (
              <div className="flex flex-col gap-3.5 p-4">
                <IdentityFields form={form} />
                <PasswordField form={form} />
              </div>
            ) : (
              <div className="flex max-h-[380px] flex-col gap-3 overflow-y-auto p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Tick the views {form.name.trim() || "this staff member"} can access.
                  </p>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums">
                    {form.caps.size} selected
                  </span>
                </div>
                {PERM_GROUPS.map((g) => {
                  const onCount = g.caps.filter((c) => form.caps.has(c)).length;
                  return (
                    <div key={g.label}>
                      <button
                        type="button"
                        onClick={() =>
                          form.setCaps(
                            onCount === g.caps.length
                              ? [...form.caps].filter((c) => !g.caps.includes(c))
                              : [...new Set([...form.caps, ...g.caps])],
                          )
                        }
                        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60"
                      >
                        <CheckBox on={onCount === g.caps.length} some={onCount > 0 && onCount < g.caps.length} />
                        <span className="flex-1 text-xs font-semibold">{g.label}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {onCount}/{g.caps.length}
                        </span>
                      </button>
                      <div className="ml-6 grid grid-cols-2 gap-x-2">
                        {g.caps.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => form.toggleCap(c)}
                            className="flex items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted/60"
                          >
                            <CheckBox on={form.caps.has(c)} />
                            <span className="truncate text-xs">{c}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {form.error && (
              <p className="px-4 pb-1 text-xs font-medium text-destructive-foreground">
                {form.error}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              {step === 1 ? (
                <nord-button size="s" type="button" suppressHydrationWarning onClick={() => setStep(0)}>
                  <ChevronLeft slot="start" className="h-3.5 w-3.5" />
                  Back
                </nord-button>
              ) : (
                <span />
              )}
              {step === 0 ? (
                <nord-button variant="primary" size="s" type="button" suppressHydrationWarning onClick={nextFromIdentity}>
                  Next — access
                  <ChevronRight slot="end" className="h-3.5 w-3.5" />
                </nord-button>
              ) : (
                <nord-button variant="primary" size="s" type="button" suppressHydrationWarning onClick={form.submit}>
                  <UserPlus slot="start" className="h-3.5 w-3.5" />
                  Create staff login
                </nord-button>
              )}
            </div>
          </>
        )}
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------- Variation B */

function VariationB(): React.ReactElement {
  const form = useStaffForm();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const groups = q
    ? PERM_GROUPS.map((g) => ({
        ...g,
        caps: g.caps.filter((c) => c.toLowerCase().includes(q)),
      })).filter((g) => g.caps.length > 0)
    : PERM_GROUPS;

  return (
    <Stage>
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
        <DialogHeader title="Add staff member" sub="Username login — no email needed" />
        {form.created ? (
          <SuccessPanel created={form.created} onReset={form.reset} />
        ) : (
          <>
            <div className="grid grid-cols-[260px_1fr]">
              {/* Identity column */}
              <div className="flex flex-col gap-3.5 border-r border-border p-4">
                <IdentityFields form={form} />
                <PasswordField form={form} />
              </div>

              {/* Access column */}
              <div className="flex max-h-[420px] flex-col">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search views…"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums">
                    {form.caps.size}/{ALL_CAPS.length}
                  </span>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                  {groups.map((g) => {
                    const onCount = g.caps.filter((c) => form.caps.has(c)).length;
                    return (
                      <div key={g.label}>
                        <button
                          type="button"
                          onClick={() =>
                            form.setCaps(
                              onCount === g.caps.length
                                ? [...form.caps].filter((c) => !g.caps.includes(c))
                                : [...new Set([...form.caps, ...g.caps])],
                            )
                          }
                          className="mb-0.5 flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted/60"
                        >
                          <CheckBox on={onCount === g.caps.length} some={onCount > 0 && onCount < g.caps.length} />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {g.label}
                          </span>
                        </button>
                        <div className="ml-6 flex flex-col">
                          {g.caps.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => form.toggleCap(c)}
                              className="flex items-center gap-2 rounded px-1 py-[3px] text-left hover:bg-muted/60"
                            >
                              <CheckBox on={form.caps.has(c)} />
                              <span className="truncate text-xs">{c}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {groups.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No views match “{query}”.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {form.error && (
              <p className="border-t border-border px-4 pt-2 text-xs font-medium text-destructive-foreground">
                {form.error}
              </p>
            )}
            <div className={cn("flex justify-end gap-2 px-4 py-3", !form.error && "border-t border-border")}>
              <nord-button size="s" type="button" suppressHydrationWarning>
                Cancel
              </nord-button>
              <nord-button variant="primary" size="s" type="button" suppressHydrationWarning onClick={form.submit}>
                <UserPlus slot="start" className="h-3.5 w-3.5" />
                Create staff login
              </nord-button>
            </div>
          </>
        )}
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------- Variation C */

function VariationC(): React.ReactElement {
  const form = useStaffForm();
  const [preset, setPreset] = useState<string | null>(null);
  const [customising, setCustomising] = useState(false);

  const applyPreset = (label: string): void => {
    const p = ROLE_PRESETS.find((r) => r.label === label);
    if (!p) return;
    setPreset(label);
    form.setCaps(p.caps);
    setCustomising(false);
  };

  return (
    <Stage>
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
        <DialogHeader title="Add staff member" sub="Start from a role, then fine-tune" />
        {form.created ? (
          <SuccessPanel
            created={form.created}
            onReset={() => {
              form.reset();
              setPreset(null);
              setCustomising(false);
            }}
          />
        ) : (
          <>
            <div className="flex max-h-[460px] flex-col gap-3.5 overflow-y-auto p-4">
              <IdentityFields form={form} />

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">Starts as</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROLE_PRESETS.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => applyPreset(r.label)}
                      aria-pressed={preset === r.label}
                      className={cn(
                        "flex items-center justify-between gap-1.5 rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                        preset === r.label
                          ? "border-primary/50 bg-primary/5"
                          : "border-border text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {r.caps.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {preset !== null && (
                <div className="rounded-md border border-border bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {form.caps.size} view{form.caps.size === 1 ? "" : "s"} granted
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomising((c) => !c)}
                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Customise
                      <ChevronDown className={cn("h-3 w-3 transition-transform", customising && "rotate-180")} />
                    </button>
                  </div>
                  {!customising ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {form.caps.size > 0 ? [...form.caps].join(" · ") : "Read-only dashboard access."}
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {PERM_GROUPS.map((g) => (
                        <div key={g.label}>
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {g.label}
                          </p>
                          <div className="grid grid-cols-2 gap-x-2">
                            {g.caps.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => form.toggleCap(c)}
                                className="flex items-center gap-2 rounded px-1 py-[3px] text-left hover:bg-muted"
                              >
                                <CheckBox on={form.caps.has(c)} />
                                <span className="truncate text-xs">{c}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <PasswordField form={form} />
            </div>

            {form.error && (
              <p className="px-4 pb-1 text-xs font-medium text-destructive-foreground">{form.error}</p>
            )}
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <nord-button size="s" type="button" suppressHydrationWarning>
                Cancel
              </nord-button>
              <nord-button variant="primary" size="s" type="button" suppressHydrationWarning onClick={form.submit}>
                <UserPlus slot="start" className="h-3.5 w-3.5" />
                Create staff login
              </nord-button>
            </div>
          </>
        )}
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------- Variation D */

function VariationD(): React.ReactElement {
  const form = useStaffForm();
  const [open, setOpen] = useState<Set<string>>(() => new Set([PERM_GROUPS[0].label]));
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const groups = q
    ? PERM_GROUPS.map((g) => ({
        ...g,
        caps: g.caps.filter((c) => c.toLowerCase().includes(q)),
      })).filter((g) => g.caps.length > 0)
    : PERM_GROUPS;

  const toggleOpen = (label: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <Stage>
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
        <DialogHeader title="Add staff member" sub="Views grouped by section — expand what you need" />
        {form.created ? (
          <SuccessPanel created={form.created} onReset={form.reset} />
        ) : (
          <>
            <div className="flex max-h-[460px] flex-col gap-3.5 overflow-y-auto p-4">
              <IdentityFields form={form} />

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Access (views)</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {form.caps.size} selected
                  </span>
                </div>
                <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search views…"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  {groups.map((g, gi) => {
                    const expanded = q ? true : open.has(g.label);
                    const onCount = g.caps.filter((c) => form.caps.has(c)).length;
                    return (
                      <div key={g.label} className={cn(gi > 0 && "border-t border-border")}>
                        <div className="flex items-center gap-2 bg-muted/40 px-2.5 py-1.5">
                          <button
                            type="button"
                            aria-label={`${onCount === g.caps.length ? "Clear" : "Select"} all ${g.label}`}
                            onClick={() =>
                              form.setCaps(
                                onCount === g.caps.length
                                  ? [...form.caps].filter((c) => !g.caps.includes(c))
                                  : [...new Set([...form.caps, ...g.caps])],
                              )
                            }
                          >
                            <CheckBox on={onCount === g.caps.length} some={onCount > 0 && onCount < g.caps.length} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleOpen(g.label)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="truncate text-xs font-semibold">{g.label}</span>
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {onCount}/{g.caps.length}
                            </span>
                            <ChevronDown
                              className={cn(
                                "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                                expanded && "rotate-180",
                              )}
                            />
                          </button>
                        </div>
                        {expanded && (
                          <div className="grid grid-cols-2 gap-x-2 px-2.5 py-1.5">
                            {g.caps.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => form.toggleCap(c)}
                                className="flex items-center gap-2 rounded px-1 py-[3px] text-left hover:bg-muted/60"
                              >
                                <CheckBox on={form.caps.has(c)} />
                                <span className="truncate text-xs">{c}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {groups.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No views match “{query}”.
                    </p>
                  )}
                </div>
              </div>

              <PasswordField form={form} />
            </div>

            {form.error && (
              <p className="px-4 pb-1 text-xs font-medium text-destructive-foreground">{form.error}</p>
            )}
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <nord-button size="s" type="button" suppressHydrationWarning>
                Cancel
              </nord-button>
              <nord-button variant="primary" size="s" type="button" suppressHydrationWarning onClick={form.submit}>
                <UserPlus slot="start" className="h-3.5 w-3.5" />
                Create staff login
              </nord-button>
            </div>
          </>
        )}
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------- Variation E */

function VariationE(): React.ReactElement {
  const form = useStaffForm();

  return (
    <Stage align="right">
      <div className="flex w-full max-w-md flex-col border-l border-border bg-card shadow-xl">
        <DialogHeader title="Add staff member" sub="Toggle the screens they should see" />
        {form.created ? (
          <SuccessPanel created={form.created} onReset={form.reset} />
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <IdentityFields form={form} />

              {PERM_GROUPS.map((g) => {
                const onCount = g.caps.filter((c) => form.caps.has(c)).length;
                return (
                  <div key={g.label}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          form.setCaps(
                            onCount === g.caps.length
                              ? [...form.caps].filter((c) => !g.caps.includes(c))
                              : [...new Set([...form.caps, ...g.caps])],
                          )
                        }
                        className="text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {onCount === g.caps.length ? "Clear" : "All"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {g.caps.map((c) => {
                        const on = form.caps.has(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => form.toggleCap(c)}
                            aria-pressed={on}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-colors",
                              on
                                ? "border-primary/50 bg-primary/5 text-foreground"
                                : "border-border text-muted-foreground hover:bg-muted/60",
                            )}
                          >
                            <CheckBox on={on} />
                            <span className="truncate">{c}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <PasswordField form={form} />
            </div>

            {form.error && (
              <p className="px-4 pb-1 text-xs font-medium text-destructive-foreground">{form.error}</p>
            )}
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                {form.caps.size}/{ALL_CAPS.length} views
              </span>
              <div className="flex gap-2">
                <nord-button size="s" type="button" suppressHydrationWarning>
                  Cancel
                </nord-button>
                <nord-button variant="primary" size="s" type="button" suppressHydrationWarning onClick={form.submit}>
                  <UserPlus slot="start" className="h-3.5 w-3.5" />
                  Create staff login
                </nord-button>
              </div>
            </div>
          </>
        )}
      </div>
    </Stage>
  );
}
