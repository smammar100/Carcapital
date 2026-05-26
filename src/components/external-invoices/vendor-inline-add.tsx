"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vendorService } from "@/lib/services/vendor-service";
import type { UUID, Vendor } from "@/lib/types";

interface Props {
  companyId: UUID;
  onCreated: (vendor: Vendor) => void;
  className?: string;
  /**
   * F-D4 — caller passes its current vendor list so we can short-circuit
   * the round-trip when the user retypes an existing name. Optional —
   * the DB unique index is the authoritative guard.
   */
  existingVendors?: Vendor[];
}

const SPECIALITIES = [
  "mechanical",
  "bodywork",
  "tyres",
  "electrical",
  "mot",
  "general",
] as const;

/**
 * Spec v3.0 · Module D.6 — inline "+ Add new vendor" inside the
 * external-invoice form. Captures name (required) + speciality + phone,
 * then calls `onCreated(vendor)` so the parent can select it.
 */
export function VendorInlineAdd({
  companyId,
  onCreated,
  className,
  existingVendors,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [speciality, setSpeciality] = useState<string>("general");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Vendor name is required");
      return;
    }
    // F-D4: client-side pre-check against the parent's known vendor list.
    // The DB unique index (vendors_unique_name_per_company) is the
    // authoritative guard, but a pre-check spares the round-trip and gives
    // a friendlier message when we can detect the collision locally.
    const lowerTrimmed = trimmed.toLowerCase();
    const dup = (existingVendors ?? []).find(
      (v) => v.name.trim().toLowerCase() === lowerTrimmed,
    );
    if (dup) {
      toast.error(`A vendor named "${dup.name}" already exists`);
      onCreated(dup);
      setName("");
      setPhone("");
      setSpeciality("general");
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const v = await vendorService.upsert({
        companyId,
        name: trimmed,
        phone: phone.trim(),
        speciality: speciality as Vendor["speciality"],
        active: true,
      });
      toast.success(`Added ${v.name}`);
      onCreated(v);
      // Reset + close
      setName("");
      setPhone("");
      setSpeciality("general");
      setOpen(false);
    } catch (err) {
      const obj = err as { message?: string; code?: string };
      // F-D4 — friendly message when the DB unique index rejects.
      // Postgres unique-violation SQLSTATE is 23505.
      const isUnique =
        obj?.code === "23505" ||
        /duplicate key|already exists|unique/i.test(obj?.message ?? "");
      toast.error(
        isUnique
          ? `A vendor named "${trimmed}" already exists`
          : (obj?.message ?? "Could not add vendor"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={className}>
          <Plus className="mr-1 size-3.5" />
          Add new vendor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New vendor</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ali's Garage"
              autoFocus
            />
          </div>
          <div>
            <Label>Speciality</Label>
            <Select value={speciality} onValueChange={setSpeciality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPECIALITIES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="02085711234"
              inputMode="tel"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Add vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
