"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, ShieldX } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          Settings <ChevronRight className="h-4 w-4" />
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
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
        <>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setInviteOpen(true)}
              data-testid="new-member-btn"
            >
              <Plus className="mr-1.5 h-3 w-3" />
              New member
            </Button>
          </div>

          <PermissionsGrid ref={gridRef} />
        </>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() => void gridRef.current?.reload()}
      />
    </div>
  );
}
