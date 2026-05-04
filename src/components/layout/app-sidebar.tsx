"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ChevronRight, ChevronsUpDown, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getInitials } from "@/lib/utils";
import { SIDEBAR_GROUPS } from "./sidebar-config";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const COLLAPSED_KEY = "cc:sidebar:collapsed";

function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveCollapsed(s: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...s]));
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { user, company, signOut } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setCollapsed(loadCollapsed());
  }, []);

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      saveCollapsed(next);
      return next;
    });
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  function groupContainsActive(items: { href: string }[]): boolean {
    return items.some((i) => isActive(i.href));
  }

  function handleSignOut() {
    signOut();
    toast.success("Signed out");
    router.push("/login");
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                  CC
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Car Capital UK</span>
                  <span className="text-xs text-muted-foreground">
                    {company?.name ?? "—"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          {SIDEBAR_GROUPS.map((group, gi) => {
            const items = (
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            );

            // Unlabeled groups (Dashboard / Warranties / etc.) render as-is —
            // they're single-link shortcuts, no collapse needed.
            if (!group.label) {
              return (
                <SidebarGroup key={gi}>
                  <SidebarGroupContent>{items}</SidebarGroupContent>
                </SidebarGroup>
              );
            }

            // Labeled groups: clickable header with chevron + collapse. If the
            // group contains the active route, force it open so the user can
            // see where they are.
            const hasActive = groupContainsActive(group.items);
            const isCollapsed = collapsed.has(group.label) && !hasActive;
            return (
              <Collapsible
                key={gi}
                open={!isCollapsed}
                onOpenChange={() => {
                  if (group.label) toggleGroup(group.label);
                }}
                asChild
              >
                <SidebarGroup>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="group/collapsible flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-sidebar-foreground/70 outline-none transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Toggle ${group.label} group`}
                    >
                      <ChevronRight className="size-3 shrink-0 transition-transform duration-150 group-data-[state=open]/collapsible:rotate-90" />
                      <span className="truncate">{group.label}</span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>{items}</SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-md">
                    <AvatarFallback className="rounded-md text-[11px]">
                      {user ? getInitials(user.name) : "—"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user?.name ?? ""}
                    </span>
                    <span className="truncate text-xs capitalize text-muted-foreground">
                      {user?.role.replace("_", " ") ?? ""}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side="top"
                align="end"
              >
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
