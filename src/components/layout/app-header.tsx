"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { titleFromPath } from "./sidebar-config";
import { HealthIndicator } from "./health-indicator";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications } from "@/contexts/notifications-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { vehicleDetailHref } from "@/lib/vehicle-nav";
import { toast } from "@/lib/toast";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();
  const [searchValue, setSearchValue] = useState("");

  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    const v = await vehicleService.getByRegistration(trimmed);
    if (v) {
      router.push(vehicleDetailHref(v.id, pathname));
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
    <nord-header slot="header">
      <h1 className="truncate text-base font-semibold">
        {titleFromPath(pathname)}
      </h1>

      <div slot="end" className="flex items-center gap-2">
        <form onSubmit={onSearchSubmit} className="hidden md:block">
          <nord-input
            type="search"
            label="Search"
            hideLabel
            size="s"
            placeholder="Search reg or stock ID…"
            value={searchValue}
            onInput={(e) =>
              setSearchValue((e.target as HTMLInputElement).value)
            }
            suppressHydrationWarning
          />
        </form>

        <HealthIndicator />

        {/* The dark-mode toggle was removed with the Genaro migration: the
            brand defines a single light system, so there is no second theme to
            switch to.

            Nord renders these square icon buttons at 36x36, under the 40px
            desktop / 44px touch floor for a hit target. The ::before bleeds the
            clickable area out to 44x44 without affecting layout. Neighbours sit
            8px apart, so -4px per side makes the two areas meet exactly and
            never overlap — the largest non-colliding extension. */}
        <nord-dropdown>
          <nord-button
            className="relative before:absolute before:-inset-1"
            slot="toggle"
            square
            variant="plain"
            aria-label="Notifications"
            hideDropdownIcon
          >
            <nord-icon name="navigation-notifications" />
          </nord-button>
          <nord-dropdown-group
            heading={
              unreadCount > 0
                ? `Notifications (${unreadCount} unread)`
                : "Notifications"
            }
          >
            {notifications.length === 0 ? (
              <nord-dropdown-item disabled>No notifications</nord-dropdown-item>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <nord-dropdown-item
                  key={n.id}
                  onClick={() => {
                    if (!n.read) void markRead(n.id);
                    if (n.link) router.push(n.link);
                  }}
                >
                  {n.title}
                </nord-dropdown-item>
              ))
            )}
          </nord-dropdown-group>
          {notifications.length > 0 && (
            <nord-dropdown-item onClick={() => void markAllRead()}>
              Mark all as read
            </nord-dropdown-item>
          )}
        </nord-dropdown>

        <nord-dropdown>
          <nord-button slot="toggle" variant="plain">
            <nord-avatar slot="start" size="s" name={user?.name ?? "User"} />
            <span className="hidden sm:inline" suppressHydrationWarning>
              {user?.name ?? ""}
            </span>
          </nord-button>
          <nord-dropdown-group heading={user?.email ?? undefined}>
            <nord-dropdown-item onClick={() => router.push("/admin/settings")}>
              Settings
            </nord-dropdown-item>
          </nord-dropdown-group>
          <nord-dropdown-item onClick={handleSignOut}>
            Sign out
          </nord-dropdown-item>
        </nord-dropdown>
      </div>
    </nord-header>
  );
}
