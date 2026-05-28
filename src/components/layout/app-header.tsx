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
import { HealthIndicator } from "./health-indicator";
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
    <div className="flex h-full w-full items-center gap-3 px-4">
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

      <form
        onSubmit={onSearchSubmit}
        className="relative ml-auto hidden w-full max-w-[320px] md:block"
      >
        <Input
          type="search"
          placeholder="Search reg or stock ID…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-8"
        />
        <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </form>

      <div className="ml-auto flex items-center gap-3">
        <HealthIndicator />
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
      <DropdownMenuTrigger
        render={
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
        }
      />
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 rounded-xl p-0 shadow-lg"
        data-testid="notifications-dropdown"
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="text-sm font-semibold">Notifications</span>
          <button
            type="button"
            onClick={() => void onMarkAllRead()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Mark all as read
          </button>
        </div>
        <div className="max-h-[320px] overflow-y-auto overscroll-contain">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.slice(0, 5).map((n) => (
                <a
                  key={n.id}
                  href={n.link ?? "#"}
                  className="flex items-start gap-2 p-3 transition-colors hover:bg-accent/40"
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
        <div className="border-t border-border p-3">
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
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="gap-2 px-2">
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
        }
      />
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl p-1"
        data-testid="profile-dropdown"
      >
        <div className="flex flex-col gap-1 p-3">
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
        <DropdownMenuItem
          className="gap-2"
          onClick={() => router.push("/admin/settings")}
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
