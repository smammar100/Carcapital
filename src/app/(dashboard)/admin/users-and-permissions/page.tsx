"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { teamService } from "@/lib/services/team-service";
import type { User } from "@/lib/types";
import { ROLE_DEFS, type RoleValue } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { InviteTeamMembersDialog } from "@/components/admin/invite-team-members-dialog";
import { EditRolesDialog } from "@/components/admin/edit-roles-dialog";
import { RemoveMemberDialog } from "@/components/admin/remove-member-dialog";
import { DataGridSearchBar } from "@/components/data-grid";
import { cn, formatDateTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";

function roleLabel(value: RoleValue): string {
  return ROLE_DEFS.find((r) => r.value === value)?.label ?? value;
}

export default function TeamAndSecurityPage() {
  const { user: currentUser, company } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [filter, setFilter] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const canManageMembers = currentUser?.isSuperUser ?? false;

  async function load() {
    if (!company) return;
    const list = await teamService.getAll(company.id);
    setUsers(list);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, filter]);

  async function handleResend(userId: string) {
    if (!currentUser) return;
    await teamService.resendInvitation(userId, currentUser.id);
    toast.success("Invitation re-sent");
    void load();
  }

  async function handleRevoke(userId: string) {
    if (!currentUser) return;
    if (!window.confirm("Revoke this invitation? The pending user record will be removed.")) return;
    await teamService.revokeInvitation(userId, currentUser.id);
    toast.success("Invitation revoked");
    void load();
  }

  async function handleAcceptMock(userId: string) {
    await teamService.acceptInvitation(userId);
    toast.success("Invitation accepted (mock)");
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb + h1 */}
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
      </div>

      {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DataGridSearchBar
              value={filter}
              onChange={setFilter}
              placeholder="Filter by name or email…"
              className="w-full max-w-xs"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setInviteOpen(true)}
                data-testid="new-member-btn"
              >
                <Plus className="mr-1.5 h-3 w-3" />
                New member
                <span className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono">
                  N
                </span>
              </Button>
            </div>
          </div>

          {/* Table */}
          {!filtered ? (
            <Skeleton className="h-72" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No team members match"
              description="Adjust the filter or invite a new member."
            />
          ) : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">MEMBER</th>
                    <th className="px-4 py-2 font-medium">ROLES</th>
                    <th className="px-4 py-2 font-medium">AUTH</th>
                    <th className="px-4 py-2 font-medium">LAST LOGIN</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody data-testid="team-table-body">
                  {filtered.map((u) => {
                    const isYou = currentUser?.id === u.id;
                    const pending = teamService.isPending(u);
                    const roleLabels = u.roles.map(roleLabel);
                    const roleSummary =
                      roleLabels.length === 0
                        ? "—"
                        : roleLabels.length <= 3
                          ? roleLabels.join(", ")
                          : `${roleLabels.slice(0, 3).join(", ")}, +${roleLabels.length - 3} more...`;
                    return (
                      <tr
                        key={u.id}
                        className="border-b last:border-b-0 hover:bg-muted/30"
                        data-testid={`team-row-${u.id}`}
                      >
                        <td className="px-4 py-3">
                          {pending ? (
                            <span className="font-medium">{u.email}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(u.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col leading-tight">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {u.name}
                                  </span>
                                  {isYou && (
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm" data-testid="role-summary">
                          {u.isSuperUser ? (
                            <>
                              Super Administrator
                              <span className="ml-1 text-muted-foreground">(Owner)</span>
                            </>
                          ) : (
                            roleSummary
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {pending ? (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                              Invitation sent
                            </span>
                          ) : u.passwordResetRequired ? (
                            <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
                              Pending First Login
                            </span>
                          ) : u.twoStepEnabled ? (
                            <span className="rounded bg-cyan-100 px-2 py-0.5 text-xs text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300">
                              Two-step
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {pending
                            ? "—"
                            : u.lastLoginAt
                              ? formatDateTime(u.lastLoginAt)
                              : "Never"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {/* Owner / super-admin rows are immutable from this UI
                              — no edit roles, no removal, no reset. */}
                          {!isYou && !u.isSuperUser && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  aria-label="Member actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {pending ? (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={() => void handleResend(u.id)}
                                    >
                                      Resend invite
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => void handleAcceptMock(u.id)}
                                    >
                                      Accept (mock)
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={() => void handleRevoke(u.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      Revoke
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuItem
                                      disabled={!canManageMembers}
                                      onSelect={() => setEditTarget(u)}
                                      data-testid={`edit-roles-${u.id}`}
                                    >
                                      Edit roles
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={!canManageMembers}
                                      onSelect={() => setRemoveTarget(u)}
                                      className="text-destructive focus:text-destructive"
                                      data-testid={`remove-member-${u.id}`}
                                    >
                                      Remove
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                <span data-testid="member-count">
                  {filtered.length} member{filtered.length === 1 ? "" : "s"}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          )}

      <InviteTeamMembersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() => void load()}
      />

      <EditRolesDialog
        user={editTarget}
        open={editTarget !== null}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
        onSaved={() => void load()}
      />

      <RemoveMemberDialog
        user={removeTarget}
        open={removeTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null);
        }}
        onRemoved={() => void load()}
      />
    </div>
  );
}

function exportCsv(users: User[]) {
  const headers = ["Name", "Email", "Roles", "Auth", "Last login"];
  const rows = users.map((u) => [
    u.name,
    u.email,
    u.isSuperUser ? "Super Administrator (Owner)" : u.roles.map(roleLabel).join("; "),
    u.invitedAt && !u.acceptedAt
      ? "Invitation sent"
      : u.twoStepEnabled
        ? "Two-step"
        : "—",
    u.lastLoginAt ?? "—",
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((c) => (c.includes(",") || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c))
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
