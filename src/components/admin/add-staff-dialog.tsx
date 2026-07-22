"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Copy, Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL_CAPABILITIES,
  CAPABILITY_LABELS,
  type Capability,
} from "@/lib/capabilities";
import {
  isValidUsername,
  normalizeUsername,
  suggestUsername,
} from "@/lib/auth/username";
import { toast } from "@/lib/toast";

// Crypto-random, human-relayable temporary password (no ambiguous chars).
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const rnd = new Uint32Array(14);
  crypto.getRandomValues(rnd);
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[rnd[i] % chars.length];
  return `${out}!9`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/**
 * Create a staff login with NO email — the admin generates a username +
 * password and relays it out-of-band. Access is assigned as a flat list of
 * individual "views" (capabilities) — no roles, no categories. The selected
 * views are stored as per-user grants; on success the credentials are shown.
 *
 * Layout: prototype Variation B — identity column on the left, searchable
 * flat view list on the right (Linear / Height-style settings dialog).
 */
export function AddStaffDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  // null => follow the auto-suggestion derived from `name`; string => admin-edited.
  const [usernameOverride, setUsernameOverride] = useState<string | null>(null);
  const [caps, setCaps] = useState<Set<Capability>>(() => new Set<Capability>());
  const [search, setSearch] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    username: string;
    password: string;
  } | null>(null);

  // Reset the form each time the dialog opens (component stays mounted for the
  // open/close animation, so a reset effect is required).
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName("");
    setUsernameOverride(null);
    setCaps(new Set<Capability>());
    setSearch("");
    setPassword(generatePassword());
    setError(null);
    setCreated(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  const username = usernameOverride ?? suggestUsername(name);
  const usernameOk = isValidUsername(username);
  const canSubmit =
    name.trim().length > 0 &&
    usernameOk &&
    caps.size > 0 &&
    password.length >= 8 &&
    !submitting;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_CAPABILITIES;
    return ALL_CAPABILITIES.filter((c) =>
      CAPABILITY_LABELS[c].toLowerCase().includes(q),
    );
  }, [search]);

  function toggleCap(c: Capability) {
    setCaps((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/team/create-with-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizeUsername(username),
          name: name.trim(),
          password,
          capabilities: [...caps],
        }),
      });
      const json = (await res.json()) as { username?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not create the staff login");
        return;
      }
      setCreated({
        username: json.username ?? normalizeUsername(username),
        password,
      });
      onCreated?.();
    } catch {
      setError("Could not create the staff login");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCreds() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(
        `Username: ${created.username}\nPassword: ${created.password}`,
      );
      toast.success("Credentials copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-0 border-b px-5 py-4 pr-10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold">
                Add staff member
              </DialogTitle>
              <p className="truncate text-xs font-normal text-muted-foreground">
                Username login, no email needed
              </p>
            </div>
          </div>
        </DialogHeader>

        {created ? (
          <div className="p-5">
            <div
              className="rounded-md border bg-emerald-50 p-4 text-sm dark:bg-emerald-950/20"
              data-testid="add-staff-creds"
            >
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                Staff login created, relay these credentials
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Send these to the staff member (WhatsApp / phone / in person).
                They&apos;ll set their own password on first login.
              </p>
              <div className="mt-3 grid gap-1 font-mono text-xs">
                <div>
                  <span className="text-muted-foreground">Username: </span>
                  {created.username}
                </div>
                <div>
                  <span className="text-muted-foreground">Password: </span>
                  {created.password}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyCreds()}
                  data-testid="add-staff-copy"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:h-[440px] sm:grid-cols-[260px_1fr]">
              {/* Identity column */}
              <div className="flex flex-col gap-4 border-b p-5 sm:overflow-y-auto sm:border-b-0 sm:border-r">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <Input
                    className="mt-1.5"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ahmed Khan"
                    autoFocus
                    data-testid="add-staff-name"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Username</Label>
                  <Input
                    className="mt-1.5 font-mono"
                    value={username}
                    onChange={(e) =>
                      setUsernameOverride(e.target.value.toLowerCase())
                    }
                    placeholder="ahmed.khan"
                    data-testid="add-staff-username"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {username && !usernameOk
                      ? "3–32 chars: lowercase letters, numbers, dot, underscore or hyphen (start & end alphanumeric)."
                      : "Staff log in with this username + the password below. No email needed."}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Temporary password</Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      className="flex-1 font-mono"
                      value={password}
                      readOnly
                      onFocusCapture={(e) => e.currentTarget.select()}
                      data-testid="add-staff-password"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPassword(generatePassword())}
                      aria-label="Regenerate password"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-generated. The staff member is forced to set their own
                    on first login.
                  </p>
                </div>
              </div>

              {/* Access column — searchable flat view list */}
              <div className="flex min-h-0 flex-col">
                <div className="flex items-center gap-2 border-b px-4 py-2.5">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-8 pl-8"
                      placeholder="Search views…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      data-testid="add-staff-cap-search"
                    />
                  </div>
                  <span
                    className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium tabular-nums text-muted-foreground"
                    data-testid="add-staff-selected-count"
                  >
                    {caps.size}/{ALL_CAPABILITIES.length}
                  </span>
                </div>
                <div className="flex items-center gap-3 border-b px-4 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    Tick the views this staff member can access. No roles.
                  </span>
                  <div className="ml-auto flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setCaps(new Set<Capability>(ALL_CAPABILITIES))}
                      className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      data-testid="add-staff-select-all"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaps(new Set<Capability>())}
                      className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      data-testid="add-staff-clear"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 max-sm:max-h-64">
                  {filtered.map((cap) => (
                    <label
                      key={cap}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={caps.has(cap)}
                        onCheckedChange={() => toggleCap(cap)}
                        data-testid={`add-staff-cap-${cap}`}
                      />
                      <span>{CAPABILITY_LABELS[cap]}</span>
                    </label>
                  ))}
                  {filtered.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No views match “{search}”.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-5 py-3.5">
              {error ? (
                <p className="text-sm text-destructive" data-testid="add-staff-error">
                  {error}
                </p>
              ) : (
                <span />
              )}
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCreate()}
                  disabled={!canSubmit}
                  data-testid="add-staff-submit"
                >
                  {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Create staff login
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
