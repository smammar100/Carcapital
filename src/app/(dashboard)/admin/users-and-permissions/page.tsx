"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, ShieldX } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { InviteMemberDialog } from "@/components/admin/invite-member-dialog";
import {
  PermissionsGrid,
  type PermissionsGridHandle,
} from "@/components/admin/permissions-grid";

export default function TeamAndSecurityPage() {
  const { can, isSuperUser, isLoading } = usePermissions();
  const [inviteOpen, setInviteOpen] = useState(false);
  const gridRef = useRef<PermissionsGridHandle>(null);

  const canManage = isSuperUser || can("admin:manage_permissions");

  // The role-based "Invite Member" CTA (IAM Admin / Owner) navigates here with
  // ?invite=1 — auto-open the invite dialog so the CTA lands in the flow.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("invite") === "1" && canManage) setInviteOpen(true);
  }, [searchParams, canManage]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Team and security
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle individual capabilities per member. Changes are batched —
          save or discard them from the bar at the bottom.
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
            <Button
              size="sm"
              onClick={() => setInviteOpen(true)}
              data-testid="new-member-btn"
            >
              <Plus className="mr-1.5 h-3 w-3" />
              New member
            </Button>
          }
        />
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() => void gridRef.current?.reload()}
      />
    </div>
  );
}
