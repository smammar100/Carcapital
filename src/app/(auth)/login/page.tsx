"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { authService } from "@/lib/services/auth-service";
import type { User } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
      return;
    }
    void (async () => {
      const us = await authService.getAllUsers();
      setUsers(us);
      setLoading(false);
    })();
  }, [user, router]);

  async function pick(userId: string) {
    setPendingId(userId);
    try {
      await signIn(userId);
      toast.success("Signed in");
      router.push("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign in");
      setPendingId(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold tracking-widest">
            CC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Car Capital UK
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in — pick a user to continue
          </p>
        </div>
        {loading ? (
          <Card className="p-5">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-14 w-full" />
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Users</h2>
              <span className="text-xs text-muted-foreground">
                {users.length} user{users.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {users.map((u) => {
                const pending = pendingId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => void pick(u.id)}
                    disabled={pendingId !== null}
                    className={cn(
                      "flex items-center gap-3 rounded-md border bg-card p-3 text-left transition-colors",
                      "hover:border-primary/40 hover:bg-accent/40",
                      "disabled:opacity-60",
                      pending && "border-primary",
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {u.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className="capitalize"
                    >
                      {u.role.replace("_", " ")}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Card>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Demo mode — no password required. Sessions persist via localStorage.
        </p>
      </div>
    </div>
  );
}
