"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ROLE_DEFS,
  ROLE_GROUPS,
  type RoleValue,
  type RoleDef,
} from "@/lib/roles";
import { teamService, InviteValidationError } from "@/lib/services/team-service";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired with the freshly-invited users so the parent can refresh its list. */
  onInvited?: (count: number) => void;
}

function generatePassword(): string {
  // Readable, strong-enough temp password the admin relays then the user
  // changes. Avoids ambiguous chars.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const rnd = new Uint32Array(14);
  crypto.getRandomValues(rnd);
  for (let i = 0; i < 14; i++) out += chars[rnd[i] % chars.length];
  return `${out}!9`;
}

export function InviteTeamMembersDialog({ open, onOpenChange, onInvited }: Props) {
  const { user, company } = useAuth();
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Set<RoleValue>>(new Set());
  const [roleSearch, setRoleSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Create-with-password mode state.
  const [pwEmail, setPwEmail] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [createdCreds, setCreatedCreds] = useState<{
    email: string;
    password: string;
  } | null>(null);

  function reset() {
    setEmails([]);
    setEmailDraft("");
    setEmailError(null);
    setRoles(new Set());
    setRoleSearch("");
    setPwEmail("");
    setPassword(generatePassword());
    setCreatedCreds(null);
    setMode("invite");
  }

  function commitEmail(raw: string) {
    const trimmed = raw.trim().replace(/,$/, "").trim();
    if (!trimmed) return;
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError(`"${trimmed}" is not a valid email address`);
      return;
    }
    if (emails.includes(trimmed.toLowerCase())) {
      setEmailError("Email already added");
      return;
    }
    setEmails((prev) => [...prev, trimmed.toLowerCase()]);
    setEmailDraft("");
    setEmailError(null);
  }

  function handleEmailKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitEmail(emailDraft);
    } else if (e.key === "Backspace" && !emailDraft && emails.length > 0) {
      e.preventDefault();
      setEmails((prev) => prev.slice(0, -1));
    }
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email));
  }

  function toggleRole(value: RoleValue) {
    const next = new Set(roles);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setRoles(next);
  }

  const filteredRoleDefs = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return ROLE_DEFS;
    return ROLE_DEFS.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [roleSearch]);

  const selectedRoleDefs = useMemo(
    () => ROLE_DEFS.filter((r) => roles.has(r.value)),
    [roles],
  );

  async function handleCreateWithPassword() {
    if (!user || !company) return;
    const email = pwEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setEmailError(`"${pwEmail}" is not a valid email address`);
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (roles.size === 0) {
      toast.error("Select at least one role");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/create-with-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          email,
          password,
          roles: [...roles],
        }),
      });
      const json = (await res.json()) as {
        email?: string;
        password?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Could not create the member");
        return;
      }
      setCreatedCreds({ email: json.email ?? email, password });
      toast.success(`${email} created — relay the credentials below`);
      onInvited?.(1);
    } catch {
      toast.error("Could not create the member");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!user || !company) return;
    if (mode === "password") {
      void handleCreateWithPassword();
      return;
    }
    setEmailError(null);
    // Commit any draft text as a final email
    if (emailDraft.trim()) commitEmail(emailDraft);
    const finalEmails = emailDraft.trim() && EMAIL_RE.test(emailDraft.trim())
      ? [...emails, emailDraft.trim().toLowerCase()]
      : emails;
    if (finalEmails.length === 0) {
      setEmailError("Add at least one email address");
      return;
    }
    if (roles.size === 0) {
      toast.error("Select at least one role");
      return;
    }
    setSubmitting(true);
    try {
      const created = await teamService.invite({
        companyId: company.id,
        emails: finalEmails,
        roles: [...roles],
        actorId: user.id,
      });
      toast.success(
        `Invitation sent to ${created.length} member${created.length === 1 ? "" : "s"}`,
      );
      onInvited?.(created.length);
      reset();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof InviteValidationError) toast.error(err.message);
      else toast.error("Could not send invitations");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex h-screen w-screen flex-col gap-0 bg-popover text-popover-foreground outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        >
          <div className="flex items-center justify-between border-b px-8 py-5">
            <DialogPrimitive.Title className="text-lg font-heading font-medium">
              Invite team members
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" className="bg-secondary">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="flex gap-2 border-b px-8 py-3">
            <button
              type="button"
              onClick={() => setMode("invite")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                mode === "invite"
                  ? "bg-secondary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid="mode-invite"
            >
              Email invite
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                mode === "password"
                  ? "bg-secondary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid="mode-password"
            >
              Create with password
            </button>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1fr_1fr] md:divide-x">
            {/* Left column — email + role pickers */}
            <div className="flex flex-col gap-5 overflow-y-auto px-8 py-6">
            {mode === "invite" && (
            <div>
              <Label className="text-sm font-medium">
                Enter team member email addresses
              </Label>
              <div
                className={cn(
                  "mt-2 flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:border-primary",
                  emailError && "border-destructive",
                )}
              >
                {emails.map((e) => (
                  <span
                    key={e}
                    className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
                    data-testid="email-chip"
                  >
                    {e}
                    <button
                      type="button"
                      onClick={() => removeEmail(e)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${e}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  onKeyDown={handleEmailKey}
                  onBlur={() => emailDraft.trim() && commitEmail(emailDraft)}
                  placeholder={
                    emails.length === 0
                      ? "ada@stripe.com, andy@example.com, etc."
                      : ""
                  }
                  className="flex-1 min-w-[200px] bg-transparent text-sm outline-none"
                  data-testid="email-input"
                />
              </div>
              {emailError && (
                <p className="mt-1 text-xs text-destructive">{emailError}</p>
              )}
            </div>
            )}

            {mode === "password" && (
              <div className="flex flex-col gap-4">
                {createdCreds ? (
                  <div className="rounded-md border bg-emerald-50 p-4 text-sm dark:bg-emerald-950/20">
                    <p className="font-medium text-emerald-800 dark:text-emerald-300">
                      Member created — relay these credentials
                    </p>
                    <div className="mt-2 grid gap-1 font-mono text-xs">
                      <div>
                        <span className="text-muted-foreground">Email: </span>
                        {createdCreds.email}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Password:{" "}
                        </span>
                        {createdCreds.password}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(
                            `Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`,
                          )
                          .then(() => toast.success("Credentials copied"));
                      }}
                    >
                      Copy credentials
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="text-sm font-medium">
                        Team member email
                      </Label>
                      <Input
                        value={pwEmail}
                        onChange={(e) => {
                          setPwEmail(e.target.value);
                          if (emailError) setEmailError(null);
                        }}
                        placeholder="ada@stripe.com"
                        className="mt-2"
                        data-testid="pw-email"
                      />
                      {emailError && (
                        <p className="mt-1 text-xs text-destructive">
                          {emailError}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">
                        Temporary password
                      </Label>
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="font-mono"
                          data-testid="pw-password"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPassword(generatePassword())}
                        >
                          Generate
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        The member signs in immediately with these — no email
                        is sent. Ask them to change it after first login.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Select team member roles</Label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Search by role…"
                  className="pl-8"
                  data-testid="role-search"
                />
              </div>

              <div className="mt-3 flex flex-col gap-1 max-h-[420px] overflow-y-auto">
                {ROLE_GROUPS.map((group) => {
                  const groupRoles = filteredRoleDefs.filter((r) => r.group === group);
                  if (groupRoles.length === 0) return null;
                  return (
                    <div key={group} className="flex flex-col">
                      <div className="rounded bg-muted/40 px-3 py-1.5 text-xs font-semibold">
                        {group}
                      </div>
                      {groupRoles.map((r) => (
                        <label
                          key={r.value}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30"
                        >
                          <Checkbox
                            checked={roles.has(r.value)}
                            onCheckedChange={() => toggleRole(r.value)}
                            data-testid={`role-${r.value}`}
                          />
                          <span>{r.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
                {filteredRoleDefs.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">
                    No roles match "{roleSearch}".
                  </p>
                )}
              </div>
            </div>
            </div>

            {/* Right column — role description */}
            <div className="flex flex-col gap-3 overflow-y-auto px-8 py-6">
              <h3 className="text-base font-semibold">Role description</h3>
              {selectedRoleDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Choose roles to see their descriptions...
                </p>
              ) : (
                <>
                  <div className="rounded border bg-muted/30 px-3 py-2 text-xs">
                    ⓘ The team member(s) will receive the combined set of
                    permissions provided by these roles.
                  </div>
                  <div className="flex flex-col gap-4 pr-1">
                    {selectedRoleDefs.map((r) => (
                      <RoleDescriptionItem key={r.value} role={r} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t px-8 py-4">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || (mode === "password" && createdCreds !== null)}
              data-testid="send-invites"
            >
              {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {mode === "password" ? "Create member" : "Send invites"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function RoleDescriptionItem({ role }: { role: RoleDef }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-semibold">{role.label}</h4>
      <p className="text-xs text-muted-foreground">{role.description}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="self-start text-xs text-primary hover:underline"
      >
        {open ? "Hide details" : "View details"}
      </button>
      {open && (
        <ul className="mt-1 list-disc rounded bg-muted/40 px-5 py-2 text-[11px] text-muted-foreground">
          {role.capabilities.length === 0 ? (
            <li>Bypasses every capability check (super-user).</li>
          ) : (
            role.capabilities.map((c) => <li key={c}>{c}</li>)
          )}
        </ul>
      )}
    </div>
  );
}
