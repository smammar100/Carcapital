"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { teamService } from "@/lib/services/team-service";
import { permissionService } from "@/lib/services/permission-service";
import { invalidate } from "@/lib/cache";
import { capabilitiesForRoles } from "@/lib/roles";
import type { Capability } from "@/lib/capabilities";
import type { User, UUID } from "@/lib/types";
import { toast } from "@/lib/toast";
import type { PendingChange, PermissionsMap } from "./types";

function cloneMap(src: PermissionsMap): PermissionsMap {
  const out: PermissionsMap = new Map();
  for (const [k, v] of src) out.set(k, new Set(v));
  return out;
}

export interface UsePermissionsGrid {
  users: User[] | null;
  localState: PermissionsMap;
  serverState: PermissionsMap;
  pendingChanges: PendingChange[];
  toggleCapability: (userId: UUID, cap: Capability) => void;
  save: () => Promise<void>;
  discard: () => void;
  reload: () => Promise<void>;
  loading: boolean;
  saving: boolean;
}

/**
 * Loads every team member plus their effective capability set, keeps a
 * working copy in local state, and diffs it against the server ground
 * truth so the grid can highlight unsaved cells and batch-save per user.
 */
export function usePermissionsGrid(): UsePermissionsGrid {
  const { user: currentUser, company } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [serverState, setServerState] = useState<PermissionsMap>(new Map());
  const [localState, setLocalState] = useState<PermissionsMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    // Bust the team:/auth: caches first so a member who accepted an invite
    // since this grid last loaded shows up without a hard refresh (the
    // accept-join insert happens server-side, outside this client's cache).
    invalidate("team:");
    const list = await teamService.getAll(company.id);
    const server = await permissionService.effectiveCapabilitiesForUsers(list);
    setUsers(list);
    setServerState(server);
    setLocalState(cloneMap(server));
    setLoading(false);
  }, [company]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleCapability = useCallback(
    (userId: UUID, cap: Capability) => {
      // Role-derived caps are implied, not editable here — toggling one off
      // would do nothing (the role still grants it) and snap back on reload.
      const target = users?.find((u) => u.id === userId);
      if (target && capabilitiesForRoles(target.roles).has(cap)) return;
      setLocalState((prev) => {
        const next = cloneMap(prev);
        const set = next.get(userId) ?? new Set<Capability>();
        if (set.has(cap)) set.delete(cap);
        else set.add(cap);
        next.set(userId, set);
        return next;
      });
    },
    [users],
  );

  const pendingChanges = useMemo<PendingChange[]>(() => {
    const changes: PendingChange[] = [];
    for (const [userId, localCaps] of localState) {
      const serverCaps = serverState.get(userId) ?? new Set<Capability>();
      const seen = new Set<Capability>();
      for (const cap of localCaps) {
        seen.add(cap);
        if (!serverCaps.has(cap))
          changes.push({ userId, capability: cap, next: true });
      }
      for (const cap of serverCaps) {
        if (!seen.has(cap))
          changes.push({ userId, capability: cap, next: false });
      }
    }
    return changes;
  }, [localState, serverState]);

  const discard = useCallback(() => {
    setLocalState(cloneMap(serverState));
  }, [serverState]);

  const save = useCallback(async () => {
    if (!currentUser || !users) return;
    const changedUserIds = new Set(pendingChanges.map((c) => c.userId));
    if (changedUserIds.size === 0) return;
    const usersById = new Map(users.map((u) => [u.id, u]));
    setSaving(true);
    // The grid's local set is the EFFECTIVE set (role caps ∪ explicit grants).
    // We must persist only the explicit-grant delta — writing the role-derived
    // caps as grants would freeze them, so a later role change couldn't revoke
    // them. So send `localCaps − roleCaps` to setForUser.
    let saved = 0;
    const failed: string[] = [];
    for (const userId of changedUserIds) {
      const target = usersById.get(userId);
      const roleCaps = target
        ? capabilitiesForRoles(target.roles)
        : new Set<Capability>();
      const explicitGrants = [
        ...(localState.get(userId) ?? new Set<Capability>()),
      ].filter((cap) => !roleCaps.has(cap));
      try {
        await permissionService.setForUser(
          userId,
          explicitGrants,
          currentUser.id,
        );
        saved += 1;
      } catch {
        failed.push(target?.name ?? userId);
      }
    }
    setSaving(false);

    if (failed.length === 0) {
      toast.success(
        `Saved permissions for ${saved} member${saved === 1 ? "" : "s"}`,
      );
    } else if (saved === 0) {
      toast.error("Could not save permission changes");
    } else {
      toast.error(
        `Saved ${saved}, but failed for: ${failed.join(", ")}`,
      );
    }
    await reload();
  }, [currentUser, users, pendingChanges, localState, reload]);

  // Guard against losing unsaved edits on tab close / navigation.
  useEffect(() => {
    if (pendingChanges.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingChanges.length]);

  return {
    users,
    localState,
    serverState,
    pendingChanges,
    toggleCapability,
    save,
    discard,
    reload,
    loading,
    saving,
  };
}
