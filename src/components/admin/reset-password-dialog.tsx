"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";
import { toast } from "@/lib/toast";

interface Props {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Admin "reset password" for a member — the no-email equivalent of forgot
 * password. Confirms, calls /api/team/reset-password, then shows the new
 * temporary credential (Username/Email + Password) for out-of-band relay.
 */
export function ResetPasswordDialog({ user, open, onOpenChange }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{
    username: string | null;
    email: string | null;
    password: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setCreds(null);
    setError(null);
    setSubmitting(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  async function handleReset() {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/team/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = (await res.json()) as {
        username?: string | null;
        email?: string | null;
        password?: string;
        error?: string;
      };
      if (!res.ok || !json.password) {
        setError(json.error ?? "Could not reset the password");
        return;
      }
      setCreds({
        username: json.username ?? null,
        email: json.email ?? null,
        password: json.password,
      });
    } catch {
      setError("Could not reset the password");
    } finally {
      setSubmitting(false);
    }
  }

  const handle = creds?.username ?? creds?.email ?? "";
  const handleLabel = creds?.username ? "Username" : "Email";

  async function copyCreds() {
    if (!creds) return;
    try {
      await navigator.clipboard.writeText(
        `${handleLabel}: ${handle}\nPassword: ${creds.password}`,
      );
      toast.success("Credentials copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          {user && !creds && (
            <DialogDescription>
              Generate a new temporary password for <strong>{user.name}</strong>
              . They&apos;ll be forced to set their own on next login. Relay it
              out-of-band (WhatsApp / phone / in person).
            </DialogDescription>
          )}
        </DialogHeader>

        {creds ? (
          <div
            className="rounded-md border bg-emerald-50 p-4 text-sm dark:bg-emerald-950/20"
            data-testid="reset-password-creds"
          >
            <p className="font-medium text-emerald-800 dark:text-emerald-300">
              New password set — relay these
            </p>
            <div className="mt-2 grid gap-1 font-mono text-xs">
              <div>
                <span className="text-muted-foreground">{handleLabel}: </span>
                {handle}
              </div>
              <div>
                <span className="text-muted-foreground">Password: </span>
                {creds.password}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyCreds()}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleReset()}
                disabled={submitting}
                data-testid="confirm-reset-password"
              >
                {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Reset password
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
