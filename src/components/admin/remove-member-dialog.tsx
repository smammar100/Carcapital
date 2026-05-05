"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { teamService } from "@/lib/services/team-service";
import type { User } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

interface Props {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved?: () => void;
}

export function RemoveMemberDialog({ user, open, onOpenChange, onRemoved }: Props) {
  const { user: actor } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!actor || !user) return;
    setSubmitting(true);
    try {
      await teamService.removeMember(user.id, actor.id);
      toast.success(`${user.name} removed from the team`);
      onRemoved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove member");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0"
        data-testid="remove-member-dialog"
      >
        <div className="flex gap-3 px-6 pt-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-2">
            <DialogHeader className="text-left">
              <DialogTitle>Remove team member?</DialogTitle>
              <DialogDescription className="text-sm">
                {user ? (
                  <>
                    <strong>{user.name}</strong> ({user.email}) will lose access to
                    Car Capital UK immediately. This action cannot be undone.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              <li>Their session is invalidated on next request.</li>
              <li>Audit-log entries authored by them remain for the record.</li>
              <li>Re-add later by sending a fresh invitation.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-testid="cancel-remove"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="confirm-remove"
          >
            {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Remove member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
