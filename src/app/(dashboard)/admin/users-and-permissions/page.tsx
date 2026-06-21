"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, ShieldX } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { AddStaffDialog } from "@/components/admin/add-staff-dialog";
import {
  PermissionsGrid,
  type PermissionsGridHandle,
} from "@/components/admin/permissions-grid";

export default function TeamAndSecurityPage() {
  const { can, isSuperUser, isLoading } = usePermissions();
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const gridRef = useRef<PermissionsGridHandle>(null);

  const canManage = isSuperUser || can("admin:manage_permissions");

  // The role-based "Invite Member" CTA (IAM Admin / Owner) navigates here with
  // ?invite=1 — auto-open the invite dialog so the CTA lands in the flow.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("invite") === "1" && canManage) setAddStaffOpen(true);
  }, [searchParams, canManage]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Team and security
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who is on your team and exactly what each person can access.
          Toggle capabilities per member, then save or discard your changes.
        </p>
      </div>

      {!isLoading && !canManage ? (
        <EmptyState
          icon={ShieldX}
          title="You don't have access"
          description="Managing team permissions requires the Manage Permissions capability."
        />
      ) : (
        <PermissionsGrid
          ref={gridRef}
          toolbarAction={
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setAddStaffOpen(true)}
                data-testid="add-staff-btn"
              >
                <Plus className="mr-1.5 h-3 w-3" />
                Add staff
              </Button>
              {/* "Invite by email" CTA hidden for now — username accounts are
                  the live flow. Restore the button + InviteMemberDialog from
                  git history to re-enable it. */}
            </div>
          }
        />
      )}

      <AddStaffDialog
        open={addStaffOpen}
        onOpenChange={setAddStaffOpen}
        onCreated={() => void gridRef.current?.reload()}
      />
    </div>
  );
}
