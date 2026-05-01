"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDEBAR_GROUPS } from "./sidebar-config";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          onClick={onNavigate}
        >
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
            CC
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Car Capital UK
          </span>
        </Link>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-4">
          {SIDEBAR_GROUPS.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {group.label && (
                <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-sm border-l-2 border-primary" />
                    )}
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
