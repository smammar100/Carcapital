"use client";

/**
 * Global command palette — Ctrl/Cmd+K anywhere in the dashboard.
 *
 * Three sections:
 *  - Navigate: sidebar routes, filtered by the same capability gates as the
 *    sidebar itself (SIDEBAR_GROUPS.requiredAnyOf via usePermissions).
 *  - Quick actions: create flows, capability-gated.
 *  - Vehicles: live search by registration / make / model. Queries Supabase
 *    directly from the client — RLS scopes results to the user's company.
 *
 * Built on cmdk. cmdk handles fuzzy matching for the static items; vehicle
 * rows are server-filtered, so they bypass cmdk's filter via forceMount-style
 * value keys that always match the current query.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Car, CornerDownLeft, Plus, UserPlus } from "lucide-react";
import { SIDEBAR_GROUPS } from "@/components/layout/sidebar-config";
import { usePermissions } from "@/hooks/use-permissions";
import { createClient } from "@/lib/supabase/client";
import type { Capability } from "@/lib/capabilities";

interface VehicleHit {
  id: string;
  registration: string;
  make: string | null;
  model: string | null;
}

interface QuickAction {
  label: string;
  href: string;
  icon: typeof Plus;
  requiredAnyOf: Capability[];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Add vehicle",
    href: "/inventory/add-vehicle",
    icon: Plus,
    requiredAnyOf: ["inventory:add"],
  },
  {
    label: "New lead",
    href: "/sales/leads",
    icon: UserPlus,
    requiredAnyOf: ["sales:create_lead"],
  },
];

export function CommandPalette() {
  const router = useRouter();
  const { can, isSuperUser } = usePermissions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [vehicles, setVehicles] = useState<VehicleHit[]>([]);
  const searchSeq = useRef(0);

  // Ctrl/Cmd+K toggles; Escape is handled by cmdk's dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const allowed = useCallback(
    (caps?: Capability[]) =>
      !caps || isSuperUser || caps.some((c) => can(c)),
    [can, isSuperUser],
  );

  const navItems = useMemo(
    () =>
      SIDEBAR_GROUPS.flatMap((g) =>
        g.items
          .filter((i) => allowed(i.requiredAnyOf))
          .map((i) => ({ ...i, group: g.label })),
      ),
    [allowed],
  );

  const actions = useMemo(
    () => QUICK_ACTIONS.filter((a) => allowed(a.requiredAnyOf)),
    [allowed],
  );

  // Debounced server-side vehicle search (RLS-scoped).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const seq = ++searchSeq.current;
    if (q.length < 2) {
      // Defer: setState synchronously inside an effect cascades renders.
      const clear = setTimeout(() => {
        if (seq === searchSeq.current) setVehicles([]);
      }, 0);
      return () => clearTimeout(clear);
    }
    const t = setTimeout(async () => {
      try {
        const supabase = createClient();
        const escaped = q.replace(/[%_,]/g, " ").trim();
        const { data } = await supabase
          .from("vehicles")
          .select("id, registration, make, model")
          .or(
            `registration.ilike.%${escaped}%,make.ilike.%${escaped}%,model.ilike.%${escaped}%`,
          )
          .limit(8);
        if (seq === searchSeq.current) {
          setVehicles((data ?? []) as unknown as VehicleHit[]);
        }
      } catch {
        if (seq === searchSeq.current) setVehicles([]);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
      label="Command palette"
      shouldFilter
      className="fixed left-1/2 top-24 z-[900] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-background shadow-2xl"
      overlayClassName="fixed inset-0 z-[900] bg-black/30 backdrop-blur-[2px]"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Search pages, actions, or a vehicle reg…"
        className="w-full border-b bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-96 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          No results.
        </Command.Empty>

        {actions.length > 0 && (
          <Command.Group
            heading="Actions"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {actions.map((a) => (
              <Command.Item
                key={a.href}
                value={`action ${a.label}`}
                onSelect={() => go(a.href)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-muted"
              >
                <a.icon className="h-4 w-4 text-muted-foreground" />
                {a.label}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group
          heading="Navigate"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {navItems.map((item) => (
            <Command.Item
              key={item.href}
              value={`${item.group ?? ""} ${item.label}`}
              onSelect={() => go(item.href)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-muted"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
              {item.group && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {item.group}
                </span>
              )}
            </Command.Item>
          ))}
        </Command.Group>

        {vehicles.length > 0 && (
          <Command.Group
            heading="Vehicles"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {vehicles.map((v) => (
              <Command.Item
                key={v.id}
                // Server-filtered rows must always survive cmdk's client
                // filter — include the live query in the value so it matches.
                value={`vehicle ${query} ${v.registration}`}
                onSelect={() => go(`/vehicles/${v.id}`)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-muted"
              >
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs font-semibold uppercase">
                  {v.registration}
                </span>
                <span className="text-muted-foreground">
                  {[v.make, v.model].filter(Boolean).join(" ")}
                </span>
                <CornerDownLeft className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
