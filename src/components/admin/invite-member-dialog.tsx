"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_DEFS, type RoleValue } from "@/lib/roles";
import { teamService, InviteValidationError } from "@/lib/services/team-service";
import { joinLinkService } from "@/lib/services/join-link-service";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// New joiners land View Only by default; an admin elevates them in the grid.
const DEFAULT_ROLE: RoleValue = "view_only";

function roleLabel(value: RoleValue): string {
  return ROLE_DEFS.find((r) => r.value === value)?.label ?? value;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: (count: number) => void;
}

export function InviteMemberDialog({ open, onOpenChange, onInvited }: Props) {
  const { user, company } = useAuth();
  const [emailDraft, setEmailDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!open || !company || !user) return;
    void joinLinkService
      .ensure(company.id, user.id)
      .then((l) => setJoinUrl(`${window.location.origin}/join/${l.token}`))
      .catch(() => setJoinUrl(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company, user]);

  async function handleInvite() {
    if (!user || !company) return;
    const emails = emailDraft
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) {
      toast.error("Enter at least one email address");
      return;
    }
    const invalid = emails.find((e) => !EMAIL_RE.test(e));
    if (invalid) {
      toast.error(`"${invalid}" is not a valid email address`);
      return;
    }
    setSubmitting(true);
    try {
      const created = await teamService.invite({
        companyId: company.id,
        emails,
        roles: [DEFAULT_ROLE],
        actorId: user.id,
      });
      toast.success(
        `Invited ${created.length} member${created.length === 1 ? "" : "s"}`,
      );
      setEmailDraft("");
      onInvited?.(created.length);
    } catch (err) {
      if (err instanceof InviteValidationError) toast.error(err.message);
      else toast.error("Could not send invitations");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    if (!user || !company) return;
    setResetting(true);
    try {
      const link = await joinLinkService.reset(company.id, user.id);
      setJoinUrl(`${window.location.origin}/join/${link.token}`);
      toast.success("Join link reset — the old link no longer works");
    } catch {
      toast.error("Could not reset the join link");
    } finally {
      setResetting(false);
    }
  }

  async function handleCopy() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast.success("Join link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite people to your team</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleInvite();
              }
            }}
            placeholder="Enter emails (comma separated)"
            className="flex-1"
            data-testid="invite-email-input"
          />
          <Button
            onClick={() => void handleInvite()}
            disabled={submitting || !emailDraft.trim()}
            data-testid="invite-submit"
          >
            {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Invite
          </Button>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Invite via magic link</h3>
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={resetting}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              data-testid="magic-link-reset"
            >
              <RotateCw
                className={cn("h-3.5 w-3.5", resetting && "animate-spin")}
              />
              Reset
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              readOnly
              value={joinUrl ?? "Generating…"}
              className="flex-1 font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
              data-testid="magic-link-url"
            />
            <Button
              variant="default"
              onClick={() => void handleCopy()}
              disabled={!joinUrl}
              data-testid="magic-link-copy"
            >
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Anyone with this link can join {company?.name ?? "your team"} as{" "}
            {roleLabel(DEFAULT_ROLE)}. Reset to revoke it.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
