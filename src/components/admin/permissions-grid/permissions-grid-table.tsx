"use client";

import {
  ALL_CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  type Capability,
} from "@/lib/capabilities";
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
}

const STICKY_COL =
  "sticky left-0 z-1 bg-background border-r min-w-[220px] max-w-[220px]";

export function PermissionsGridTable({
  users,
  localState,
  serverState,
  currentUserId,
  onToggle,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          {/* Row 1 — domain group headers */}
          <tr>
            <th
              className={cn(
                STICKY_COL,
                "z-2 border-b px-4 py-2 text-left align-bottom text-xs font-semibold uppercase text-muted-foreground",
              )}
            >
              Member
            </th>
            {CAPABILITY_GROUPS.map((g) => (
              <th
                key={g.label}
                colSpan={g.capabilities.length}
                className="border-b border-l bg-muted/40 px-2 py-2 text-center text-xs font-semibold whitespace-nowrap"
              >
                {g.label}{" "}
                <span className="text-muted-foreground">
                  ({g.capabilities.length})
                </span>
              </th>
            ))}
          </tr>
          {/* Row 2 — individual capability labels (horizontal) */}
          <tr>
            <th
              className={cn(
                STICKY_COL,
                "z-2 border-b px-4 align-bottom",
              )}
            />
            {CAPABILITY_GROUPS.map((g) =>
              g.capabilities.map((cap, i) => (
                <th
                  key={cap}
                  className={cn(
                    "w-28 min-w-28 max-w-28 border-b px-2 py-2 align-bottom",
                    i === 0 && "border-l",
                  )}
                >
                  <span className="block text-center text-[11px] leading-tight font-medium text-muted-foreground">
                    {CAPABILITY_LABELS[cap]}
                  </span>
                </th>
              )),
            )}
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
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {u.name}
                        </span>
                        {isYou && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                            You
                          </span>
                        )}
                        {u.isSuperUser && (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                            Super
                          </span>
                        )}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    </div>
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
