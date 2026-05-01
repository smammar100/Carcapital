"use client";

import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export function DashboardGreeting() {
  const { user } = useAuth();
  const firstName = user?.name.split(" ")[0] ?? "";
  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-12 w-12">
        <AvatarFallback className="text-sm font-medium">
          {user ? getInitials(user.name) : "—"}
        </AvatarFallback>
      </Avatar>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi {firstName},
        </h1>
        <p className="text-sm text-muted-foreground">
          Let&rsquo;s take a look at your stats
        </p>
      </div>
    </div>
  );
}
