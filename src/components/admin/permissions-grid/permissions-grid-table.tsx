"use client";

import {
  ALL_CAPABILITIES,
  CAPABILITY_LABELS,
  type Capability,
} from "@/lib/capabilities";
import { Trash2, SlidersHorizontal, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import type { User, UUID } from "@/lib/types";
import { PermissionCell } from "./permission-cell";
import type { PermissionsMap } from "./types";

interface Props {
  users: User[];
  localState: PermissionsMap;
  serverState: PermissionsMap;
  currentUserId?: UUID;
  onToggle: (userId: UUID, cap: Capability) => void;
  onRemove?: (user: User) => void;
  onEditRoles?: (user: User) => void;
  onResetPassword?: (user: User) => void;
}

const STICKY_COL =
  "sticky left-0 z-1 bg-background border-r min-w-[220px] max-w-[220px]";

export function PermissionsGridTable({
  users,
  localState,
  serverState,
  currentUserId,
  onToggle,
  onRemove,
  onEditRoles,
  onResetPassword,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          {/* Single flat header row — individual permission "views", no role/category grouping */}
          <tr>
            <th
              className={cn(
                STICKY_COL,
                "z-2 border-b px-4 pb-2 align-bottom",
              )}
            >
              <span
                className="text-xs font-medium text-muted-foreground"
                data-testid="member-count"
              >
                {users.length} member{users.length === 1 ? "" : "s"}
              </span>
            </th>
            {ALL_CAPABILITIES.map((cap) => (
              <th
                key={cap}
                className="w-28 min-w-28 max-w-28 border-b border-l px-2 py-2 align-bottom"
              >
                <span className="block text-center text-xs leading-tight font-medium text-muted-foreground">
                  {CAPABILITY_LABELS[cap]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody data-testid="permissions-grid-body">
          {users.map((u) => {
            const local = localState.get(u.id) ?? new Set<Capability>();
            const server = serverState.get(u.id) ?? new Set<Capability>();
            const isYou = currentUserId === u.id;
            return (
              <tr
                key={u.id}
                className="hover:bg-muted/20"
                data-testid={`permissions-grid-row-${u.id}`}
              >
                <td className={cn(STICKY_COL, "border-b px-4 py-2")}>
                  <div className="group/member flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-2xs">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {u.name}
                        </span>
                        {isYou && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                            You
                          </span>
                        )}
                        {u.isSuperUser && (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                            Super
                          </span>
                        )}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {u.username ?? u.email}
                      </span>
                    </div>
                    {onEditRoles && !isYou && !u.isSuperUser && (
                      <button
                        type="button"
                        onClick={() => onEditRoles(u)}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/member:opacity-100"
                        aria-label={`Edit roles for ${u.name}`}
                        title="Edit roles"
                        data-testid={`edit-roles-${u.id}`}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                    )}
                    {onResetPassword && !isYou && !u.isSuperUser && (
                      <button
                        type="button"
                        onClick={() => onResetPassword(u)}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/member:opacity-100"
                        aria-label={`Reset password for ${u.name}`}
                        title="Reset password"
                        data-testid={`reset-password-${u.id}`}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    )}
                    {onRemove && !isYou && !u.isSuperUser && (
                      <button
                        type="button"
                        onClick={() => onRemove(u)}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/member:opacity-100"
                        aria-label={`Remove ${u.name}`}
                        title="Remove member"
                        data-testid={`remove-member-${u.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
                {ALL_CAPABILITIES.map((cap) => {
                  const checked = local.has(cap);
                  const changed =
                    !u.isSuperUser && checked !== server.has(cap);
                  return (
                    <PermissionCell
                      key={cap}
                      userId={u.id}
                      capability={cap}
                      checked={checked}
                      superUser={u.isSuperUser}
                      changed={changed}
                      onToggle={onToggle}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
