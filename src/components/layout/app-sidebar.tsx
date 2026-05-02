"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SIDEBAR_GROUPS } from "./sidebar-config";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface Props {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function AppSidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-14" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center",
          collapsed ? "justify-center" : "justify-between px-5",
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          onClick={onNavigate}
        >
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
            CC
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight">
              Car Capital UK
            </span>
          )}
        </Link>
        {!collapsed && onToggleCollapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-4">
          {SIDEBAR_GROUPS.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {group.label && !collapsed && (
                <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </div>
              )}
              {group.label && collapsed && gi !== 0 && (
                <Separator className="my-1" />
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center rounded-md text-sm transition-colors",
                      collapsed
                        ? "h-9 w-9 justify-center"
                        : "gap-2.5 px-3 py-2",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    )}
                    aria-label={collapsed ? item.label : undefined}
                  >
                    {active && (
                      <span
                        className={cn(
                          "absolute top-1/2 h-5 -translate-y-1/2 rounded-r-sm border-l-2 border-primary",
                          collapsed ? "-left-1" : "left-0",
                        )}
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
                if (!collapsed) return link;
                return (
                  <Tooltip key={item.href} delayDuration={150}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
      {collapsed && onToggleCollapsed && (
        <>
          <Separator />
          <div className="flex justify-center py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
