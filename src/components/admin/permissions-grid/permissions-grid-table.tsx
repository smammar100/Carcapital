"use client";

import {
  ALL_CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  type Capability,
  type CapabilityGroup,
} from "@/lib/capabilities";
import { capabilitiesForRoles } from "@/lib/roles";
import { Trash2, SlidersHorizontal, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import type { User, UUID } from "@/lib/types";
import { PermissionCell } from "./permission-cell";
import type { PermissionsMap } from "./types";

interface Props {
  users: User[];
  /** Visible capability groups (drives the grouped two-row header). */
  groups?: CapabilityGroup[];
  localState: PermissionsMap;
  serverState: PermissionsMap;
  currentUserId?: UUID;
  onToggle: (userId: UUID, cap: Capability) => void;
  onRemove?: (user: User) => void;
  onEditRoles?: (user: User) => void;
  onResetPassword?: (user: User) => void;
}

const MEMBER_COL_W = 248;
const CAP_COL_W = 92;

// Solid backgrounds on sticky cells — translucency lets scrolled-out content
// bleed through (same fix as the Master Sheet). Shadow marks the frozen edge.
const STICKY_SHADOW = "shadow-[2px_0_4px_-2px_var(--shadow-color)]";

export function PermissionsGridTable({
  users,
  groups = CAPABILITY_GROUPS,
  localState,
  serverState,
  currentUserId,
  onToggle,
  onRemove,
  onEditRoles,
  onResetPassword,
}: Props) {
  // Columns flattened in group order (keeps related capabilities adjacent).
  const caps = groups.flatMap((g) => g.capabilities);

  return (
    <div className="relative max-h-[calc(100dvh-17rem)] min-h-[320px] overflow-auto rounded-lg border">
      <table
        className="w-max border-separate text-xs"
        style={{ borderSpacing: 0 }}
      >
        <colgroup>
          <col style={{ width: MEMBER_COL_W }} />
          {caps.map((cap) => (
            <col key={cap} style={{ width: CAP_COL_W }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-20 bg-muted">
          <tr>
            <th
              className={cn(
                "sticky left-0 z-30 border-b border-r bg-muted px-4 text-left",
                STICKY_SHADOW,
              )}
            >
              <span
                className="text-xs font-medium text-muted-foreground"
                data-testid="member-count"
              >
                {users.length} member{users.length === 1 ? "" : "s"}
              </span>
            </th>
            {caps.map((cap) => (
              <th
                key={cap}
                className="border-b border-l bg-muted px-1.5 py-1.5 text-center align-middle"
              >
                <span
                  className="line-clamp-2 text-center text-[11px] font-medium leading-[14px] text-muted-foreground"
                  title={CAPABILITY_LABELS[cap]}
                >
                  {CAPABILITY_LABELS[cap]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-background" data-testid="permissions-grid-body">
          {users.map((u) => {
            const local = localState.get(u.id) ?? new Set<Capability>();
            const server = serverState.get(u.id) ?? new Set<Capability>();
            const roleCaps = capabilitiesForRoles(u.roles);
            const isYou = currentUserId === u.id;
            const granted = u.isSuperUser ? ALL_CAPABILITIES.length : local.size;
            return (
              <tr
                key={u.id}
                className="group/row"
                data-testid={`permissions-grid-row-${u.id}`}
              >
                <td
                  className={cn(
                    "sticky left-0 z-10 border-b border-r bg-background px-3",
                    "group-hover/row:bg-muted",
                    STICKY_SHADOW,
                  )}
                >
                  <div className="group/member flex h-12 items-center gap-2">
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
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground",
                        "group-focus-within/member:hidden group-hover/member:hidden",
                      )}
                    >
                      {granted}/{ALL_CAPABILITIES.length}
                    </span>
                    <div
                      className={cn(
                        "ml-auto hidden shrink-0 items-center gap-0.5",
                        "group-focus-within/member:flex group-hover/member:flex",
                      )}
                    >
                      {onEditRoles && !isYou && !u.isSuperUser && (
                        <button
                          type="button"
                          onClick={() => onEditRoles(u)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove ${u.name}`}
                          title="Remove member"
                          data-testid={`remove-member-${u.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                {caps.map((cap) => {
                  const checked = local.has(cap);
                  const roleGranted = roleCaps.has(cap);
                  const changed =
                    !u.isSuperUser && !roleGranted && checked !== server.has(cap);
                  return (
                    <PermissionCell
                      key={cap}
                      userId={u.id}
                      capability={cap}
                      checked={checked}
                      superUser={u.isSuperUser}
                      roleGranted={roleGranted}
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
