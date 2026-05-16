"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Search,
  Settings as SettingsIcon,
  User as UserIcon,
} from "lucide-react";
import { titleFromPath } from "./sidebar-config";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications } from "@/contexts/notifications-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [searchValue, setSearchValue] = useState("");

  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    const v = await vehicleService.getByRegistration(trimmed);
    if (v) {
      router.push(`/vehicles/${v.id}`);
      setSearchValue("");
    } else {
      router.push(`/vehicles?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function handleSignOut() {
    signOut();
    toast.success("Signed out");
    router.push("/login");
  }

  return (
    <div
      className="flex h-full w-full items-center"
      style={{
        paddingLeft: "var(--space-4)",
        paddingRight: "var(--space-4)",
        gap: "var(--space-3)",
      }}
    >
      {/* Breadcrumb (mobile + desktop label) */}
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">
              {titleFromPath(pathname)}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="text-sm font-medium tracking-tight md:hidden">
        {titleFromPath(pathname)}
      </div>

      {/* Search — pinned right of breadcrumb, max 320px */}
      <form
        onSubmit={onSearchSubmit}
        className="relative ml-auto hidden md:block"
        style={{ maxWidth: 320, width: "100%" }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search reg or stock ID…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-8"
        />
      </form>

      {/* Right cluster — notification bell + profile dropdown */}
      <div
        className="flex items-center"
        style={{ gap: "var(--space-3)", marginLeft: "auto" }}
      >
        <NotificationsDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
        />
        <ProfileDropdown user={user} onSignOut={handleSignOut} />
      </div>
    </div>
  );
}

function NotificationsDropdown({
  notifications,
  unreadCount,
  onMarkAllRead,
}: {
  notifications: ReturnType<typeof useNotifications>["notifications"];
  unreadCount: number;
  onMarkAllRead: () => void | Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 rounded-xl p-0 shadow-lg"
        data-testid="notifications-dropdown"
      >
        <div
          className="flex items-center justify-between"
          style={{
            padding: "var(--space-3)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span className="text-sm font-semibold">Notifications</span>
          <button
            type="button"
            onClick={() => void onMarkAllRead()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Mark all as read
          </button>
        </div>
        {/* Native overflow scroll — Radix ScrollArea's viewport uses
            height:100% which resolves to indefinite when the root only
            has max-height (no explicit height), so it grew to full
            content height and the list spilled under the fixed footer.
            A plain max-h + overflow-y-auto respects max-height correctly
            and keeps the header/footer as proper bookends. */}
        <div className="max-h-[320px] overflow-y-auto overscroll-contain">
          {notifications.length === 0 ? (
            <div
              className="text-center text-sm text-muted-foreground"
              style={{ padding: "var(--space-6)" }}
            >
              No notifications
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.slice(0, 5).map((n) => (
                <a
                  key={n.id}
                  href={n.link ?? "#"}
                  className="flex items-start transition-colors hover:bg-accent/40"
                  style={{
                    padding: "var(--space-3)",
                    gap: "var(--space-2)",
                  }}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      n.type === "urgent" && "bg-destructive",
                      n.type === "warning" && "bg-amber-500",
                      n.type === "success" && "bg-emerald-500",
                      n.type === "info" && "bg-sky-500",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium leading-tight">
                      {n.title}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "var(--space-3)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <Button variant="secondary" className="w-full" size="sm">
            Show all
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileDropdown({
  user,
  onSignOut,
}: {
  user: ReturnType<typeof useAuth>["user"];
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="px-2"
          style={{ gap: "var(--space-2)" }}
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[11px]">
              {user ? getInitials(user.name) : "—"}
            </AvatarFallback>
          </Avatar>
          <div className="hidden flex-col items-start leading-tight sm:flex">
            <span className="text-xs font-medium">{user?.name ?? ""}</span>
            <span className="text-[10px] capitalize text-muted-foreground">
              {user?.role.replace("_", " ")}
            </span>
          </div>
          <ChevronDown className="hidden h-3 w-3 opacity-60 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl p-1"
        data-testid="profile-dropdown"
      >
        <div
          className="flex flex-col"
          style={{
            padding: "var(--space-3)",
            gap: "var(--space-1)",
          }}
        >
          <span className="text-sm font-medium">{user?.name}</span>
          <span className="text-xs text-muted-foreground">{user?.email}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2">
          <Building2 className="h-4 w-4" />
          My Organization
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2">
          <UserIcon className="h-4 w-4" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2">
          <SettingsIcon className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
