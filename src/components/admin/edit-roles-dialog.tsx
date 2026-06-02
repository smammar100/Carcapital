"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ROLE_DEFS,
  ROLE_GROUPS,
  type RoleValue,
} from "@/lib/roles";
import { teamService } from "@/lib/services/team-service";
import type { User } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

interface Props {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function EditRolesDialog({ user, open, onOpenChange, onSaved }: Props) {
  const { user: actor } = useAuth();
  const [roles, setRoles] = useState<Set<RoleValue>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state when target user changes / dialog re-opens.
  useEffect(() => {
    if (open && user) {
      // Intentional reset-on-open: re-sync the picker to the target member each
      // time the dialog opens. Owner == super-user, not assignable here, so it
      // is never seeded.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoles(
        new Set((user.roles as RoleValue[]).filter((r) => r !== "owner")),
      );
      setSearch("");
    }
  }, [open, user]);

  function toggleRole(value: RoleValue) {
    const next = new Set(roles);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setRoles(next);
  }

  const filteredRoleDefs = useMemo(() => {
    // Owner / Super Administrator is a deliberate super-user grant, not
    // assignable from the role editor — exclude it from the picker.
    const assignable = ROLE_DEFS.filter((r) => r.value !== "owner");
    const q = search.trim().toLowerCase();
    if (!q) return assignable;
    return assignable.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [search]);

  async function handleSave() {
    if (!actor || !user) return;
    setSubmitting(true);
    try {
      await teamService.setRoles(user.id, [...roles], actor.id);
      toast.success(`Roles updated for ${user.name}`);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save roles");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-2xl flex max-h-[80vh] flex-col gap-0 p-0"
      >
        <DialogHeader className="border-b px-6 pt-5 pb-4">
          <DialogTitle>Edit roles</DialogTitle>
          {user && (
            <DialogDescription>
              Update the role bundle for <strong>{user.name}</strong> ({user.email}).
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-hidden px-6 py-5">
          <div>
            <Label className="text-sm font-medium">Search roles</Label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by role…"
                className="pl-8"
                data-testid="edit-role-search"
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
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
                      className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={roles.has(r.value)}
                        onCheckedChange={() => toggleRole(r.value)}
                        data-testid={`edit-role-${r.value}`}
                        className="mt-0.5"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{r.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting} data-testid="save-roles">
            {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
