"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { leadChannelService } from "@/lib/services/lead-channel-service";
import type { LeadChannel } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

/** "Facebook Marketplace" -> "facebook-marketplace". */
function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Settings > Lead Channels (GEN-117).
 *
 * The channels themselves were always data -- `lead_channels` has existed since
 * migration 0009, seeded with nine, and the service could already add, rename,
 * reorder and disable them. What was missing was anywhere to do it from, so in
 * practice a dealership could not record the channels it actually uses.
 *
 * Channels are never deleted, only disabled. Leads keep a reference to the
 * channel they came through, and advert reporting groups on it, so removing a
 * row would orphan historic leads and break those totals (see GEN-49). Disabling
 * hides it from the Create Lead dropdown while leaving past leads intact.
 */
export function LeadChannelSettings() {
  const { company, user } = useAuth();
  const [channels, setChannels] = useState<LeadChannel[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (!company) return;
    void leadChannelService.getAll(company.id).then(setChannels);
  }, [company]);

  async function reload() {
    if (!company) return;
    setChannels(await leadChannelService.getAll(company.id));
  }

  async function run(work: () => Promise<void>, success?: string) {
    setBusy(true);
    try {
      await work();
      await reload();
      if (success) toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that change");
    } finally {
      setBusy(false);
    }
  }

  function handleRename(channel: LeadChannel, label: string) {
    const next = label.trim();
    if (!user || !next || next === channel.label) return;
    void run(
      () => leadChannelService.update(channel.id, { label: next }, user.id).then(),
      "Channel renamed",
    );
  }

  function handleToggle(channel: LeadChannel, enabled: boolean) {
    if (!user) return;
    void run(
      () => leadChannelService.setEnabled(channel.id, enabled, user.id).then(),
      enabled ? "Channel enabled" : "Channel hidden from new leads",
    );
  }

  function handleMove(index: number, delta: number) {
    if (!user || !channels) return;
    const next = [...channels];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // Optimistic: the dropdown's order is the point of this control, so it
    // should move the moment it's clicked.
    setChannels(next);
    void run(
      () => leadChannelService.reorder(next.map((c) => c.id), user.id),
      "Order saved",
    );
  }

  function handleAdd() {
    const label = newLabel.trim();
    if (!user || !company || !label) return;
    const slug = slugify(label);
    if (!slug) {
      toast.error("Give the channel a name with at least one letter or number");
      return;
    }
    if (channels?.some((c) => c.slug === slug)) {
      toast.error(`There is already a "${label}" channel`);
      return;
    }
    void run(async () => {
      await leadChannelService.create(
        {
          companyId: company.id,
          slug,
          label,
          sortOrder: (channels?.length ?? 0) + 1,
        },
        user.id,
      );
      setNewLabel("");
    }, "Channel added");
  }

  if (!channels) return <Skeleton className="h-64" />;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold">Lead channels</h3>
        <p className="text-sm text-muted-foreground">
          Where your enquiries come from. These are the options on the Create
          Lead form, in the order shown here. Hiding a channel keeps it off new
          leads without changing the ones already recorded against it.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {channels.map((channel, i) => (
          <div
            key={channel.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-background p-2",
              !channel.enabled && "opacity-64",
            )}
          >
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Move up"
                disabled={busy || i === 0}
                onClick={() => handleMove(i, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Move down"
                disabled={busy || i === channels.length - 1}
                onClick={() => handleMove(i, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </div>

            <Input
              className="min-w-0 flex-1"
              defaultValue={channel.label}
              aria-label={`Rename ${channel.label}`}
              disabled={busy}
              onBlur={(e) => handleRename(channel, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />

            {channel.isSystem ? (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                Built in
              </span>
            ) : null}

            <label className="flex shrink-0 items-center gap-2 text-sm">
              <Switch
                checked={channel.enabled}
                disabled={busy}
                onCheckedChange={(v) => handleToggle(channel, v === true)}
                aria-label={`${channel.enabled ? "Hide" : "Show"} ${channel.label}`}
              />
              <span className="text-muted-foreground">
                {channel.enabled ? "Shown" : "Hidden"}
              </span>
            </label>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t pt-4">
        <div className="min-w-0 flex-1">
          <Label htmlFor="new-lead-channel">Add a channel</Label>
          <Input
            id="new-lead-channel"
            className="mt-1.5"
            placeholder="Facebook Marketplace"
            value={newLabel}
            disabled={busy}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
        </div>
        <Button type="button" disabled={busy || !newLabel.trim()} onClick={handleAdd}>
          {busy ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 size-3.5" />
          )}
          Add
        </Button>
      </div>
    </Card>
  );
}
