"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Plus, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { authService } from "@/lib/services/auth-service";
import { activityService } from "@/lib/services/activity-service";
import type { User, UserRole } from "@/lib/types";
import { AUTHORITY_MATRIX, USER_ROLES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  type ColumnDef,
  DataGridFooterRow,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridTable,
  UserCell,
} from "@/components/data-grid";
import { toast } from "sonner";

export default function UsersPage() {
  const { user: actor, company } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState({
    name: "",
    email: "",
    role: "sales" as UserRole,
  });

  const cols = useMemo<ColumnDef<User>[]>(
    () => [
      {
        key: "name",
        label: "Name",
        type: "user",
        sticky: true,
        width: 220,
        render: (u) => <UserCell name={u.name} email={u.email} />,
      },
      { key: "role", label: "Role", type: "select", width: 160 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      {
        key: "createdAt",
        label: "Joined",
        type: "date",
        width: 130,
        get: (u) => u.createdAt.slice(0, 10),
      },
    ],
    [],
  );

  useEffect(() => {
    if (!company) return;
    void authService.getUsersForCompany(company.id).then(setUsers);
  }, [company]);

  async function handleInvite() {
    if (!actor || !company) return;
    if (!invite.email.trim() || !invite.name.trim()) {
      toast.error("Name and email required");
      return;
    }
    await activityService.log({
      companyId: company.id,
      userId: actor.id,
      vehicleId: null,
      actionType: "user_invited",
      description: `Invited ${invite.name} as ${invite.role.replace("_", " ")} (${invite.email})`,
      metadata: { role: invite.role },
    });
    toast.success("Invite sent (mocked)");
    setOpen(false);
    setInvite({ name: "", email: "", role: "sales" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users & Access</h1>
        <p className="text-sm text-muted-foreground">
          Users in {company?.name ?? "—"} and what each role can do.
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Users</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Invite User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={invite.name}
                    onChange={(e) =>
                      setInvite({ ...invite, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={invite.email}
                    onChange={(e) =>
                      setInvite({ ...invite, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={invite.role}
                    onValueChange={(v) =>
                      setInvite({ ...invite, role: v as UserRole })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite}>
                  <Mail className="mr-1.5 h-4 w-4" /> Send invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {!users ? (
          <Skeleton className="h-40" />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No users" />
        ) : (
          <DataGridShell>
            <DataGridTable cols={cols}>
              <DataGridHeaderRow cols={cols} />
              <tbody>
                {users.map((u, i) => (
                  <DataGridRow key={u.id} row={u} cols={cols} index={i} />
                ))}
                <DataGridFooterRow
                  label="Invite user"
                  span={cols.length}
                  onClick={() => setOpen(true)}
                />
              </tbody>
            </DataGridTable>
          </DataGridShell>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-sm font-semibold">Authority level</h2>
          <p className="text-xs text-muted-foreground">
            Read-only matrix of who can do what.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Action</TableHead>
                {USER_ROLES.map((r) => (
                  <TableHead key={r.value} className="capitalize text-center">
                    {r.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {AUTHORITY_MATRIX.map((row) => (
                <TableRow key={row.action}>
                  <TableCell className="font-medium">{row.action}</TableCell>
                  {USER_ROLES.map((r) => (
                    <TableCell key={r.value} className="text-center">
                      {row.roles[r.value] ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
