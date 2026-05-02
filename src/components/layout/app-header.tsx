"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Search,
} from "lucide-react";
import { titleFromPath } from "./sidebar-config";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications } from "@/contexts/notifications-context";
import { authService } from "@/lib/services/auth-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import type { Company } from "@/lib/types";
import { useEffect } from "react";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, company, signOut, switchCompany } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (user?.role === "owner") {
      void authService.getAllCompanies().then(setCompanies);
    }
  }, [user]);

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

  async function handleSwitchCompany(id: string) {
    try {
      await switchCompany(id);
      toast.success("Switched company");
    } catch {
      toast.error("Could not switch company");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-2 hidden data-[orientation=vertical]:h-4 md:block"
      />
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{titleFromPath(pathname)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="text-sm font-medium tracking-tight md:hidden">
        {titleFromPath(pathname)}
      </div>

      <form
        onSubmit={onSearchSubmit}
        className="relative ml-auto hidden w-64 md:block"
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

      {user?.role === "owner" && companies.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden gap-2 md:inline-flex">
              <Building2 className="h-4 w-4" />
              <span className="max-w-32 truncate">{company?.name}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Switch company</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {companies.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onSelect={() => void handleSwitchCompany(c.id)}
                className={cn(c.id === company?.id && "font-semibold")}
              >
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          </div>
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  asChild
                  className="cursor-pointer items-start gap-2 px-3 py-2"
                >
                  <a href={n.link ?? "#"}>
                    <div className="flex w-full items-start gap-2">
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
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {n.title}
                          </span>
                          {!n.read && (
                            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </a>
                </DropdownMenuItem>
              ))
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
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
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm">{user?.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {user?.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
