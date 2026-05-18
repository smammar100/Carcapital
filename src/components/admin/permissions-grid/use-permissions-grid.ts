"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { teamService } from "@/lib/services/team-service";
import { permissionService } from "@/lib/services/permission-service";
import type { Capability } from "@/lib/capabilities";
import type { User, UUID } from "@/lib/types";
import { toast } from "sonner";
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
      setLocalState((prev) => {
        const next = cloneMap(prev);
        const set = next.get(userId) ?? new Set<Capability>();
        if (set.has(cap)) set.delete(cap);
        else set.add(cap);
        next.set(userId, set);
        return next;
      });
    },
    [],
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
    if (!currentUser) return;
    const changedUserIds = new Set(pendingChanges.map((c) => c.userId));
    if (changedUserIds.size === 0) return;
    setSaving(true);
    try {
      for (const userId of changedUserIds) {
        const caps = [...(localState.get(userId) ?? new Set<Capability>())];
        await permissionService.setForUser(userId, caps, currentUser.id);
      }
      toast.success(
        `Saved permissions for ${changedUserIds.size} member${changedUserIds.size === 1 ? "" : "s"}`,
      );
      await reload();
    } catch {
      toast.error("Could not save permission changes");
    } finally {
      setSaving(false);
    }
  }, [currentUser, pendingChanges, localState, reload]);

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
