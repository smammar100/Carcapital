"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  Avatar,
  ActionButton,
  Breadcrumbs,
  Breadcrumb,
  Menu,
  MenuItem,
  MenuTrigger,
  MenuSection,
  Header,
  Heading,
  NotificationBadge,
  Popover,
  DialogTrigger,
  Dialog,
  SearchField,
  Text,
  Divider,
} from "@react-spectrum/s2";
import Bell from "@react-spectrum/s2/icons/Bell";
import Building from "@react-spectrum/s2/icons/Building";
import Settings from "@react-spectrum/s2/icons/Settings";
import LogOut from "@react-spectrum/s2/icons/Leave";
import User from "@react-spectrum/s2/icons/User";
import { titleFromPath } from "./sidebar-config";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications } from "@/contexts/notifications-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [searchValue, setSearchValue] = useState("");

  async function onSearchSubmit(value: string) {
    const trimmed = value.trim();
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
      {/* Page title (replaces shadcn Breadcrumb) */}
      <Breadcrumbs size="M">
        <Breadcrumb id="current">{titleFromPath(pathname)}</Breadcrumb>
      </Breadcrumbs>

      {/* Search — Spectrum SearchField, max 320px, pinned right of breadcrumb */}
      <div style={{ marginLeft: "auto", maxWidth: 320, width: "100%" }}>
        <SearchField
          aria-label="Search registration or stock ID"
          placeholder="Search reg or stock ID…"
          value={searchValue}
          onChange={setSearchValue}
          onSubmit={onSearchSubmit}
        />
      </div>

      {/* Right cluster — bell + profile */}
      <div
        className="flex items-center"
        style={{ gap: "var(--space-3)", marginLeft: "var(--space-3)" }}
      >
        <NotificationsButton
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
        />
        <ProfileMenu user={user} onSignOut={handleSignOut} />
      </div>
    </div>
  );
}

function NotificationsButton({
  notifications,
  unreadCount,
  onMarkAllRead,
}: {
  notifications: ReturnType<typeof useNotifications>["notifications"];
  unreadCount: number;
  onMarkAllRead: () => void | Promise<void>;
}) {
  return (
    <DialogTrigger>
      <ActionButton aria-label="Notifications" isQuiet>
        <Bell />
        {unreadCount > 0 && <NotificationBadge value={unreadCount} />}
      </ActionButton>
      <Popover placement="bottom end">
        <Dialog size="S">
          <Header>
            <Heading>Notifications</Heading>
          </Header>
          <div
            style={{
              padding: "var(--space-3)",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {notifications.length === 0 ? (
              <Text>No notifications</Text>
            ) : (
              <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
                {notifications.slice(0, 5).map((n) => (
                  <a
                    key={n.id}
                    href={n.link ?? "#"}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--space-2)",
                      padding: "var(--space-2)",
                      textDecoration: "none",
                      borderRadius: 4,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        marginTop: 6,
                        height: 6,
                        width: 6,
                        flexShrink: 0,
                        borderRadius: "50%",
                        background:
                          n.type === "urgent"
                            ? "#e34850"
                            : n.type === "warning"
                              ? "#f5a623"
                              : n.type === "success"
                                ? "#2d9d78"
                                : "#2680eb",
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {n.title}
                      </div>
                      <p
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: "var(--muted-foreground, #6b7280)",
                        }}
                      >
                        {n.body}
                      </p>
                      <p
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: "var(--muted-foreground, #6b7280)",
                        }}
                      >
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
          <Divider size="S" />
          <div style={{ padding: "var(--space-3)" }}>
            <ActionButton onPress={() => void onMarkAllRead()}>
              Mark all as read
            </ActionButton>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function ProfileMenu({
  user,
  onSignOut,
}: {
  user: ReturnType<typeof useAuth>["user"];
  onSignOut: () => void;
}) {
  return (
    <MenuTrigger>
      <ActionButton aria-label="Profile menu" isQuiet>
        <Avatar size={28}>{user ? getInitials(user.name) : "—"}</Avatar>
      </ActionButton>
      <Menu
        onAction={(key) => {
          if (key === "signout") onSignOut();
        }}
      >
        <MenuSection>
          <MenuItem id="header" isDisabled>
            <Text slot="label">{user?.name ?? "—"}</Text>
            <Text slot="description">{user?.email ?? ""}</Text>
          </MenuItem>
        </MenuSection>
        <MenuSection>
          <MenuItem id="org" isDisabled>
            <Building />
            <Text slot="label">My Organization</Text>
          </MenuItem>
          <MenuItem id="profile" isDisabled>
            <User />
            <Text slot="label">My Profile</Text>
          </MenuItem>
          <MenuItem id="settings" isDisabled>
            <Settings />
            <Text slot="label">Settings</Text>
          </MenuItem>
        </MenuSection>
        <MenuSection>
          <MenuItem id="signout">
            <LogOut />
            <Text slot="label">Log Out</Text>
          </MenuItem>
        </MenuSection>
      </Menu>
    </MenuTrigger>
  );
}
