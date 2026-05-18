"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { DataGridSearchBar } from "@/components/data-grid";
import { RemoveMemberDialog } from "@/components/admin/remove-member-dialog";
import type { User } from "@/lib/types";
import { usePermissionsGrid } from "./use-permissions-grid";
import { PermissionsGridTable } from "./permissions-grid-table";
import { PermissionsGridSaveBar } from "./permissions-grid-save-bar";

export interface PermissionsGridHandle {
  reload: () => Promise<void>;
}

interface PermissionsGridProps {
  /** Rendered on the right of the toolbar row, inline with the search field. */
  toolbarAction?: ReactNode;
}

export const PermissionsGrid = forwardRef<
  PermissionsGridHandle,
  PermissionsGridProps
>(function PermissionsGrid({ toolbarAction }, ref) {
    const { user: currentUser } = useAuth();
    const {
      users,
      localState,
      serverState,
      pendingChanges,
      toggleCapability,
      save,
      discard,
      reload,
      loading,
      saving,
    } = usePermissionsGrid();
    const [filter, setFilter] = useState("");
    const [removeTarget, setRemoveTarget] = useState<User | null>(null);

    useImperativeHandle(ref, () => ({ reload }), [reload]);

    const filtered = useMemo(() => {
      if (!users) return null;
      const q = filter.trim().toLowerCase();
      if (!q) return users;
      return users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }, [users, filter]);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataGridSearchBar
            value={filter}
            onChange={setFilter}
            placeholder="Filter by name or email…"
            className="max-w-xs flex-1"
          />
          {toolbarAction}
        </div>

        {loading || !filtered ? (
          <Skeleton className="h-72" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No team members match"
            description="Adjust the filter or invite a new member."
          />
        ) : (
          <PermissionsGridTable
            users={filtered}
            localState={localState}
            serverState={serverState}
            currentUserId={currentUser?.id}
            onToggle={toggleCapability}
            onRemove={setRemoveTarget}
          />
        )}

        <PermissionsGridSaveBar
          changeCount={pendingChanges.length}
          saving={saving}
          onSave={() => void save()}
          onDiscard={discard}
        />

        <RemoveMemberDialog
          user={removeTarget}
          open={removeTarget !== null}
          onOpenChange={(o) => {
            if (!o) setRemoveTarget(null);
          }}
          onRemoved={() => void reload()}
        />
      </div>
    );
  },
);
