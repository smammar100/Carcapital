"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  UserPlus,
  Search,
  Phone,
  Mail,
  AlertTriangle,
  Car,
  CalendarPlus,
  Clock,
  User as UserIcon,
  ArrowRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValidUkPhone } from "@/lib/formatters";
import { useAuth } from "@/contexts/auth-context";
import { leadService } from "@/lib/services/lead-service";
import { leadChannelService } from "@/lib/services/lead-channel-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import {
  inspectionService,
  type InspectionProgress,
} from "@/lib/services/inspection-service";
import { authService } from "@/lib/services/auth-service";
import { appointmentService } from "@/lib/services/appointment-service";
import { salesService } from "@/lib/services/sales-service";
import type {
  Lead,
  LeadChannel,
  LeadSource,
  LeadStatus,
  UUID,
  User,
  Vehicle,
} from "@/lib/types";
import { ChannelChip, ChannelDropdown } from "@/components/lead-channels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
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
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { VehiclePicker } from "@/components/shared/vehicle-picker";
import { LeadStatusCell } from "@/components/data-grid";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "@/lib/toast";

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  appointment_booked: "Appointment Booked",
  lost: "Lost",
};
// Pipeline order for the list + group separators.
const STATUS_ORDER: LeadStatus[] = [
  "new",
  "contacted",
  "appointment_booked",
  "lost",
];
const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-blue-500",
  contacted: "bg-violet-500",
  appointment_booked: "bg-amber-500",
  lost: "bg-rose-500",
};

interface LeadRow extends Lead {
  assigneeName: string;
}

const SOURCES: LeadSource[] = [
  "website",
  "phone",
  "walk_in",
  "autotrader",
  "ebay",
  "facebook",
  "referral",
  "other",
];

const createSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z
    .string()
    .min(1, "Phone number is required")
    .refine(isValidUkPhone, { message: "Enter a valid UK phone number (e.g. 07712 345678 or 020 7946 0958)" }),
  customerEmail: z.string().optional(),
  vehicleInterest: z.string().min(1),
  vehicleId: z.string(),
  leadChannelId: z.string().min(1, "Please pick a channel"),
  channelOtherReason: z.string().optional(),
  assignedTo: z.string().min(1),
  notes: z.string().optional(),
});
type CreateInput = z.input<typeof createSchema>;
type CreateOutput = z.output<typeof createSchema>;

// Allowed status targets shown in the Update-status dialog, with a short hint.
const STATUS_TARGETS: { value: LeadStatus; label: string; hint: string }[] = [
  { value: "new", label: "New", hint: "Fresh enquiry, not yet actioned" },
  { value: "contacted", label: "Contacted", hint: "Reached out, awaiting next step" },
  { value: "appointment_booked", label: "Appointment Booked", hint: "Schedules a test-drive on the calendar" },
  { value: "lost", label: "Lost", hint: "Dead lead, requires a reason" },
];

const normReg = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Best-effort match of a stock vehicle from a lead's free-text vehicle interest.
 * Tries the registration embedded in the text first (e.g. "Audi A3 (LX66 CZK)"),
 * then a unique make+model match. Returns the vehicle id or null.
 *
 * Considers any car still in the business, not just listed/ready ones — an
 * enquiry naming a car that's mid-inspection should still link to it, or the
 * lead silently loses its vehicle (GEN-72).
 */
function matchVehicleFromInterest(
  interest: string,
  vehicles: Vehicle[],
): string | null {
  if (!interest) return null;
  const eligible = vehicles.filter(
    (v) => v.status !== "sold" && v.status !== "returned",
  );
  const niReg = normReg(interest);
  const byReg = eligible.find(
    (v) => v.registration && niReg.includes(normReg(v.registration)),
  );
  if (byReg) return byReg.id;
  const ni = interest.toUpperCase();
  const byMakeModel = eligible.filter((v) =>
    ni.includes(`${v.make} ${v.model}`.toUpperCase()),
  );
  return byMakeModel.length === 1 ? byMakeModel[0].id : null;
}

// Pull a human-readable message out of an unknown thrown value (Error,
// Supabase PostgrestError, or anything else) — avoids "[object Object]".
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

export default function LeadsPage() {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const phoneId = `${baseId}-phone`;
  const emailId = `${baseId}-email`;
  const vehicleId_ = `${baseId}-vehicle`;
  const vehicleInterestId = `${baseId}-vehicle-interest`;
  const channelId = `${baseId}-channel`;
  const assignId = `${baseId}-assign`;
  const notesId = `${baseId}-notes`;
  const stVehicleFieldId = `${baseId}-st-vehicle`;
  const stDateId = `${baseId}-st-date`;
  const stTimeId = `${baseId}-st-time`;
  const stSpecialId = `${baseId}-st-special`;
  const stReasonId = `${baseId}-st-reason`;
  const { user, company } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspectionProgress, setInspectionProgress] = useState<
    Map<string, InspectionProgress>
  >(new Map());
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<LeadChannel[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // Master-detail selection (replaces the old drill modal).
  const [selectedId, setSelectedId] = useState<UUID | null>(null);
  const [creatingDeal, setCreatingDeal] = useState(false);
  // Stable "now" captured at load — keeps the age memo pure.
  const [nowTs, setNowTs] = useState<number | null>(null);

  // The role-based "New Lead" CTA navigates here with ?new=1 — auto-open the
  // create dialog so the CTA lands the user straight in the create flow.
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams]);

  const create = useForm<CreateInput, unknown, CreateOutput>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      vehicleInterest: "",
      vehicleId: "none",
      leadChannelId: "",
      channelOtherReason: "",
      assignedTo: "",
      notes: "",
    },
  });

  // ── Create-lead draft autosave ──────────────────────────────────────────
  // An in-progress lead is easy to lose: anything that remounts the page
  // (an expired session, a hard refresh, a crash, closing the tab by
  // mistake) takes the typed enquiry with it, and the caller is usually
  // still on the phone. Mirror the invoice draft behaviour, but write on
  // every keystroke rather than on a 10s timer -- a dialog can disappear
  // between ticks, and losing the last few seconds of typing is the exact
  // complaint this is meant to answer.
  //
  // Keyed by user as well as company: a draft holds a named customer's phone
  // and email, so on a shared forecourt machine it must not surface for
  // whoever logs in next.
  const draftKey =
    company && user ? `cc-lead-draft:${company.id}:${user.id}` : null;
  const draftRestoredRef = useRef(false);

  // Restore when the dialog opens, not on mount: after the kind of remount
  // this protects against, the dialog is closed and the user reopens it.
  useEffect(() => {
    if (!createOpen || !draftKey) return;
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(draftKey);
    } catch {
      return; // private mode / storage disabled
    }
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Partial<CreateInput>;
      // Keep the resolved assignedTo default when the draft has none.
      const current = create.getValues();
      create.reset({ ...current, ...d, assignedTo: d.assignedTo || current.assignedTo });
      toast("Draft restored: your unsaved lead was still here");
    } catch {
      /* ignore corrupt draft */
    }
  }, [createOpen, draftKey, create]);

  // Allow a later reopen to restore again once the dialog has closed.
  useEffect(() => {
    if (!createOpen) draftRestoredRef.current = false;
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen || !draftKey) return;
    const sub = create.watch((values) => {
      // Never persist an untouched form -- that would resurrect a bare
      // assignedTo default as a "draft" on the next open.
      const hasContent = Boolean(
        values.customerName?.trim() ||
          values.customerPhone?.trim() ||
          values.customerEmail?.trim() ||
          values.vehicleInterest?.trim() ||
          values.notes?.trim(),
      );
      try {
        if (hasContent) localStorage.setItem(draftKey, JSON.stringify(values));
        else localStorage.removeItem(draftKey);
      } catch {
        /* quota or disabled storage -- autosave is best-effort */
      }
    });
    return () => sub.unsubscribe();
  }, [createOpen, draftKey, create]);

  const clearDraft = useCallback(() => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* nothing to do */
    }
  }, [draftKey]);

  // ── Update-status dialog state ──────────────────────────────────────────
  const [statusOpen, setStatusOpen] = useState(false);
  const [stTarget, setStTarget] = useState<LeadStatus>("contacted");
  const [stDate, setStDate] = useState(new Date().toISOString().slice(0, 10));
  const [stTime, setStTime] = useState("10:00");
  const [stSpecial, setStSpecial] = useState("");
  const [stVehicleId, setStVehicleId] = useState("none");
  const [stReason, setStReason] = useState("");
  const [stBusy, setStBusy] = useState(false);
  const [stError, setStError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      leadService.getAll(company.id),
      vehicleService.getAll(company.id),
      authService.getUsersForCompany(company.id),
      leadChannelService.getEnabled(company.id),
    ]).then(([l, v, u, c]) => {
      setLeads(l);
      setVehicles(v);
      setUsers(u);
      setChannels(c);
      setNowTs(Date.now());
      const sales = u.find((x) => x.role === "sales");
      if (sales) create.setValue("assignedTo", sales.id);
      // Inspection state for every car, in one query — a lead can be raised
      // against a car mid-inspection, so the flag has to render in a list
      // without 50 round trips (GEN-72).
      void inspectionService
        .getProgressForVehicles(v.map((x) => x.id), company.id)
        .then(setInspectionProgress)
        .catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  // Filter (status + source + search) then order by pipeline status + recency.
  const filtered = useMemo<LeadRow[] | null>(() => {
    if (!leads) return null;
    const q = search.trim().toLowerCase();
    let out = leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (q) {
        const hay =
          `${l.customerName} ${l.customerPhone} ${l.vehicleInterest}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const s =
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (s !== 0) return s;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return out.map((l) => ({
      ...l,
      assigneeName: users.find((u) => u.id === l.assignedTo)?.name ?? "—",
    }));
  }, [leads, statusFilter, sourceFilter, search, users]);

  // Keep selection valid as filters/data change.
  useEffect(() => {
    if (!filtered) return;
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((l) => l.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo<LeadRow | null>(
    () => filtered?.find((l) => l.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const channelById = useMemo<Map<UUID, LeadChannel>>(
    () => new Map(channels.map((c) => [c.id, c])),
    [channels],
  );

  // Vehicles that can still be advertised — the pickable set for the status
  // dialog. `items` lets the Select render the friendly label for a *preset*
  // value (base-ui can't resolve it from an unopened list otherwise).
  // A buyer can enquire about a car long before it has finished inspection —
  // blocking the lead just loses the enquiry (GEN-72). Everything still in the
  // business is offerable; only cars that have left it are not.
  const eligibleVehicles = useMemo(
    () =>
      vehicles.filter(
        (v) => v.status !== "sold" && v.status !== "returned",
      ),
    [vehicles],
  );

  function ageOf(createdAt: string): string {
    if (nowTs === null) return "";
    const d = Math.floor(
      (nowTs - new Date(createdAt).getTime()) / 86_400_000,
    );
    return d <= 0 ? "today" : `${d}d`;
  }

  async function onCreate(values: CreateOutput) {
    if (!user || !company) return;
    const channel = channels.find((c) => c.id === values.leadChannelId);
    const LEGACY_SOURCES: readonly LeadSource[] = [
      "website",
      "phone",
      "walk_in",
      "autotrader",
      "ebay",
      "facebook",
      "referral",
      "other",
    ];
    const slugAsSource = channel?.slug as LeadSource | undefined;
    const source: LeadSource =
      slugAsSource && LEGACY_SOURCES.includes(slugAsSource)
        ? slugAsSource
        : "other";

    const reason = values.channelOtherReason?.trim();
    const notes =
      channel?.slug === "other" && reason
        ? `Channel: ${reason}${values.notes ? `\n\n${values.notes}` : ""}`
        : values.notes || null;

    await leadService.create(
      {
        companyId: company.id,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail || null,
        vehicleInterest: values.vehicleInterest,
        vehicleId: values.vehicleId === "none" ? null : values.vehicleId,
        source,
        leadChannelId: values.leadChannelId,
        assignedTo: values.assignedTo,
        notes: notes || null,
      },
      user.id,
    );
    toast.success("Lead created");
    setCreateOpen(false);
    create.reset();
    clearDraft();
    setLeads(await leadService.getAll(company.id));
  }

  function openStatusDialog() {
    if (!selected) return;
    // Default to the natural next step from the current status.
    const next: Record<LeadStatus, LeadStatus> = {
      new: "contacted",
      contacted: "appointment_booked",
      appointment_booked: "appointment_booked",
      lost: "contacted",
    };
    setStTarget(next[selected.status]);
    setStDate(new Date().toISOString().slice(0, 10));
    setStTime("10:00");
    setStSpecial("");
    // Pre-fill the stock vehicle from the lead's known vehicle of interest so
    // the user doesn't re-pick what we already know.
    setStVehicleId(
      selected.vehicleId ??
        matchVehicleFromInterest(selected.vehicleInterest, vehicles) ??
        "none",
    );
    setStReason("");
    setStError(null);
    setStatusOpen(true);
  }

  async function submitStatus() {
    if (!user || !company || !selected || stBusy) return;
    setStError(null);

    // ── Appointment Booked → schedule a real appointment (auto-adds to the
    // Sales appointment calendar) which also flips the lead to that status. ──
    if (stTarget === "appointment_booked") {
      const vehicleId =
        selected.vehicleId ?? (stVehicleId !== "none" ? stVehicleId : null);
      if (!vehicleId) {
        setStError("Pick a stock vehicle: an appointment is booked against a car.");
        return;
      }
      if (!stDate || !stTime) {
        setStError("Date and time are required to book the appointment.");
        return;
      }
      setStBusy(true);
      try {
        // Link the vehicle to the lead first if it wasn't already.
        if (!selected.vehicleId) {
          await leadService.update(selected.id, { vehicleId });
        }
        await appointmentService.create({
          companyId: company.id,
          vehicleId,
          leadId: selected.id,
          customerName: selected.customerName,
          customerPhone: selected.customerPhone,
          customerEmail: selected.customerEmail ?? "",
          date: stDate,
          time: stTime,
          specialRequirements: stSpecial || null,
          createdBy: user.id,
        });
        toast.success("Appointment booked, added to the calendar ✓");
        setLeads(await leadService.getAll(company.id));
        setStatusOpen(false);
      } catch (e) {
        setStError(`Couldn't book the appointment: ${errMsg(e)}`);
      } finally {
        setStBusy(false);
      }
      return;
    }

    // ── Lost → require a full reason (kept on record). ──
    if (stTarget === "lost") {
      const reason = stReason.trim();
      if (reason.length < 5) {
        setStError("Please enter a full reason (at least a few words) for the record.");
        return;
      }
      setStBusy(true);
      try {
        await leadService.changeStatus(selected.id, "lost", user.id, {
          lostReason: reason,
        });
        toast.success("Lead marked Lost, reason saved");
        setLeads(await leadService.getAll(company.id));
        setStatusOpen(false);
      } catch (e) {
        setStError(`Couldn't update status: ${errMsg(e)}`);
      } finally {
        setStBusy(false);
      }
      return;
    }

    // ── New / Contacted → simple audited status change. ──
    setStBusy(true);
    try {
      await leadService.changeStatus(selected.id, stTarget, user.id);
      toast.success(`Lead moved to ${stTarget === "new" ? "New" : "Contacted"}`);
      setLeads(await leadService.getAll(company.id));
      setStatusOpen(false);
    } catch (e) {
      setStError(`Couldn't update status: ${errMsg(e)}`);
    } finally {
      setStBusy(false);
    }
  }

  async function handleCreateDeal() {
    if (!user || !company || !selected || !selected.vehicleId) return;
    if (creatingDeal) return;
    setCreatingDeal(true);
    try {
      const { existing } = await salesService.create({
        companyId: company.id,
        vehicleId: selected.vehicleId,
        leadId: selected.id,
        customerName: selected.customerName,
        customerPhone: selected.customerPhone,
        customerEmail: selected.customerEmail ?? null,
        sellingAgent: selected.assignedTo,
      });
      if (existing) {
        toast.info("Deal already exists for this vehicle, opening pipeline");
      } else {
        toast.success("Deal ready, opening pipeline");
      }
      router.push("/sales/pipeline");
    } finally {
      setCreatingDeal(false);
    }
  }

  const selectedVehicle = selected?.vehicleId
    ? vehicles.find((v) => v.id === selected.vehicleId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Every new buyer enquiry in one list. Capture, assign, and follow up
            so no lead goes cold.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <form onSubmit={create.handleSubmit(onCreate)} className="contents">
              <DialogHeader>
                <DialogTitle>Create Lead</DialogTitle>
                <DialogDescription>
                  Capture a new buyer enquiry and assign it for follow-up.
                </DialogDescription>
              </DialogHeader>
              <DialogPanel className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={nameId}>Name</Label>
                    <Input id={nameId} {...create.register("customerName")} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={phoneId}>Phone</Label>
                    <Input id={phoneId} {...create.register("customerPhone")} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={emailId}>Email</Label>
                  <Input id={emailId} type="email" {...create.register("customerEmail")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={vehicleId_}>Vehicle</Label>
                  {/* Reg search, not a 120-car scroll (GEN-79). */}
                  <VehiclePicker
                    id={vehicleId_}
                    vehicles={eligibleVehicles}
                    value={
                      eligibleVehicles.find(
                        (v) => v.id === create.watch("vehicleId"),
                      ) ?? null
                    }
                    emptyOptionLabel="None / free text"
                    placeholder="Search by reg, or leave blank for free text"
                    onChange={(veh) => {
                      create.setValue("vehicleId", veh?.id ?? "none");
                      if (veh) {
                        create.setValue(
                          "vehicleInterest",
                          `${veh.make} ${veh.model} (${veh.registration})`,
                        );
                      }
                    }}
                    renderMeta={(v) => {
                      const p = inspectionProgress.get(v.id);
                      return p && !p.complete && p.started ? (
                        <span className="shrink-0 text-2xs text-amber-600 dark:text-amber-400">
                          insp {p.done}/{p.total}
                        </span>
                      ) : null;
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={vehicleInterestId}>Vehicle interest</Label>
                  <Input id={vehicleInterestId} {...create.register("vehicleInterest")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={channelId}>
                    Lead Channel <span className="text-destructive">*</span>
                  </Label>
                  <ChannelDropdown
                    id={channelId}
                    channels={channels}
                    value={create.watch("leadChannelId") || undefined}
                    onValueChange={(id) =>
                      create.setValue("leadChannelId", id, {
                        shouldValidate: true,
                      })
                    }
                    placeholder="Where did this lead come from?"
                    invalid={!!create.formState.errors.leadChannelId}
                  />
                  {create.formState.errors.leadChannelId ? (
                    <p className="text-xs text-destructive">
                      {create.formState.errors.leadChannelId.message}
                    </p>
                  ) : null}
                  {channels.find(
                    (c) => c.id === create.watch("leadChannelId"),
                  )?.slug === "other" ? (
                    <Input
                      {...create.register("channelOtherReason")}
                      placeholder="How did they hear about us?"
                    />
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={assignId}>Assign to</Label>
                  <Select
                    items={Object.fromEntries(users.map((u) => [u.id, u.name]))}
                    value={create.watch("assignedTo")}
                    onValueChange={(v) => create.setValue("assignedTo", v)}
                  >
                    <SelectTrigger id={assignId}>
                      <SelectValue placeholder="Pick a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={notesId}>Notes</Label>
                  <Textarea id={notesId} {...create.register("notes")} className="min-h-16" />
                </div>
              </DialogPanel>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    clearDraft();
                    create.reset();
                    setCreateOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={create.formState.isSubmitting}
                >
                  {create.formState.isSubmitting ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!filtered ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[480px] rounded-xl" />
          <Skeleton className="h-[480px] rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
          {/* LEFT — search, status + source filters, scrollable lead list */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone or vehicle…"
                  aria-label="Search leads"
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                {/* items map: without it the closed trigger renders the raw
                    value ("all") instead of its label (GEN-47). */}
                <Select
                  items={{
                    all: "All statuses",
                    ...Object.fromEntries(
                      STATUS_ORDER.map((s) => [s, LEAD_STATUS_LABEL[s]]),
                    ),
                  }}
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as LeadStatus | "all")
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {LEAD_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  items={{
                    all: "All sources",
                    ...Object.fromEntries(
                      SOURCES.map((s) => [
                        s,
                        s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()),
                      ]),
                    ),
                  }}
                  value={sourceFilter}
                  onValueChange={(v) => setSourceFilter(v as LeadSource | "all")}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="No leads"
                description="Adjust your filters, or capture a new enquiry."
              />
            ) : (
              <div
                role="listbox"
                aria-label="Leads"
                className="flex max-h-[calc(100dvh-15rem)] flex-col gap-1.5 overflow-y-auto pr-1"
              >
                {filtered.map((l) => {
                  const isActive = l.id === selectedId;
                  const ch = l.leadChannelId
                    ? channelById.get(l.leadChannelId)
                    : null;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => setSelectedId(l.id)}
                      className={cn(
                        "flex w-full shrink-0 items-center gap-2.5 rounded-lg border bg-card p-2.5 text-left transition-colors",
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <Avatar size="sm">
                        <AvatarFallback className="text-2xs">
                          {getInitials(l.customerName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {l.customerName}
                          </span>
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              STATUS_DOT[l.status],
                            )}
                          />
                        </div>
                        <span className="truncate text-xs text-muted-foreground">
                          {l.vehicleInterest}
                        </span>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          {ch ? (
                            <ChannelChip channel={ch} compact />
                          ) : (
                            <span className="text-2xs capitalize text-muted-foreground">
                              {l.source.replace("_", " ")}
                            </span>
                          )}
                          <span className="shrink-0 text-2xs text-muted-foreground">
                            {ageOf(l.createdAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — full follow-up panel for the selected lead */}
          <div className="lg:sticky lg:top-4">
            {!selected ? (
              <div className="flex h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card text-center text-muted-foreground">
                <UserPlus className="size-6" />
                <p className="text-sm">Select a lead to follow up.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar size="lg">
                      <AvatarFallback>
                        {getInitials(selected.customerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-lg font-semibold leading-tight">
                        {selected.customerName}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <a
                          href={`tel:${selected.customerPhone.replace(/\s+/g, "")}`}
                          className="inline-flex items-center gap-1.5 hover:text-foreground"
                        >
                          <Phone className="size-3.5" />
                          {selected.customerPhone}
                        </a>
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="size-3.5" />
                          {selected.customerEmail ?? "no email"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <LeadStatusCell status={selected.status} />
                </div>

                {selectedVehicle ? (
                  <VehicleImage
                    vehicle={selectedVehicle}
                    variant="card"
                    className="w-full max-w-[260px]"
                  />
                ) : null}

                {/* Inspection flag — a lead may be raised against a car
                    that's still being checked (GEN-72), so say so here rather
                    than blocking it at creation. Shows nothing once the
                    inspection is clean. */}
                {(() => {
                  if (!selected.vehicleId) return null;
                  const p = inspectionProgress.get(selected.vehicleId);
                  if (!p || p.complete) return null;
                  // A car the business already put on sale, with no inspection
                  // ever raised in the app, isn't "incomplete" — it predates
                  // this workflow. Warning on those would fire for almost the
                  // whole forecourt and bury the cars that genuinely are
                  // mid-inspection.
                  const v = vehicles.find((x) => x.id === selected.vehicleId);
                  const preSale =
                    v?.status === "received" ||
                    v?.status === "inspection_pending" ||
                    v?.status === "being_prepared";
                  if (!p.started && !preSale) return null;
                  return (
                    <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <summary className="flex cursor-pointer items-center gap-2 font-medium">
                        <AlertTriangle className="size-4 shrink-0" />
                        {p.started
                          ? `Inspection incomplete: ${p.done} of ${p.total} checks signed off`
                          : "Inspection not started"}
                        <span className="ml-auto text-xs font-normal underline">
                          {p.outstanding.length} outstanding
                        </span>
                      </summary>
                      <ul className="mt-2 grid list-disc gap-0.5 pl-8 text-xs sm:grid-cols-2">
                        {p.outstanding.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  );
                })()}

                {/* Fields */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field icon={Car} label="Vehicle of interest">
                    {selected.vehicleInterest}
                  </Field>
                  <Field icon={ArrowRight} label="Channel">
                    {(() => {
                      const ch = selected.leadChannelId
                        ? channelById.get(selected.leadChannelId)
                        : null;
                      return ch ? (
                        <ChannelChip channel={ch} compact />
                      ) : (
                        <span className="capitalize">
                          {selected.source.replace("_", " ")}
                        </span>
                      );
                    })()}
                  </Field>
                  <Field icon={UserIcon} label="Assigned to">
                    {selected.assigneeName}
                  </Field>
                  <Field icon={Clock} label="Created">
                    {selected.createdAt.slice(0, 10)}
                    {ageOf(selected.createdAt)
                      ? ` · ${ageOf(selected.createdAt)} ago`
                      : ""}
                  </Field>
                  <div className="sm:col-span-2">
                    <Field icon={Mail} label="Notes">
                      {selected.notes ?? "—"}
                    </Field>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Primary conversion action — turns the lead into a
                        pipeline deal. Needs a linked vehicle; when absent we
                        keep it visible but disabled with a hint below. */}
                    <Button
                      type="button"
                      disabled={creatingDeal || !selected.vehicleId}
                      onClick={() => void handleCreateDeal()}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      {creatingDeal ? "Opening…" : "Create deal in pipeline"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openStatusDialog}
                    >
                      <ArrowRight className="mr-1.5 size-4" />
                      Update status
                    </Button>
                  </div>
                  {!selected.vehicleId ? (
                    <p className="text-xs text-muted-foreground">
                      Link a vehicle to this lead (via Update status) to create a
                      deal.
                    </p>
                  ) : null}
                  {selected.status === "appointment_booked" ? (
                    <p className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <CalendarPlus className="size-3.5" />
                      Appointment booked, see the Appointments calendar.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Update lead status — drives new → contacted → appointment → lost */}
      <Dialog
        open={statusOpen}
        onOpenChange={(o) => {
          if (!o && !stBusy) setStatusOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update lead status</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.customerName}, currently ${LEAD_STATUS_LABEL[selected.status]}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="grid gap-4">
            {/* Target status picker */}
            <div className="grid gap-2">
              {STATUS_TARGETS.map((t) => {
                const isCurrent = selected?.status === t.value;
                const active = stTarget === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setStTarget(t.value);
                      setStError(null);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", STATUS_DOT[t.value])} />
                      <span className="text-sm font-medium">{t.label}</span>
                      {isCurrent ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                          current
                        </span>
                      ) : null}
                    </span>
                    <span className="text-2xs text-muted-foreground">{t.hint}</span>
                  </button>
                );
              })}
            </div>

            {/* Conditional: Appointment Booked → date/time (+ vehicle if none) */}
            {stTarget === "appointment_booked" ? (
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  Books a test-drive appointment and adds it to the Appointments
                  calendar.
                </p>
                {selected && !selected.vehicleId ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor={stVehicleFieldId}>Stock vehicle <span className="text-destructive">*</span></Label>
                    <VehiclePicker
                      id={stVehicleFieldId}
                      vehicles={eligibleVehicles}
                      value={
                        eligibleVehicles.find((v) => v.id === stVehicleId) ??
                        null
                      }
                      onChange={(v) => setStVehicleId(v?.id ?? "none")}
                      placeholder="Search by reg to link a stock vehicle"
                    />
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={stDateId}>Date</Label>
                    <Input id={stDateId} type="date" value={stDate} onChange={(e) => setStDate(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={stTimeId}>Time</Label>
                    {/* Business books hourly appointment slots (09:00–17:00,
                        ending by 18:00). step=3600 nudges the picker to whole
                        hours; the calendar renders each as a 1-hour block. */}
                    <Input
                      id={stTimeId}
                      type="time"
                      value={stTime}
                      min="09:00"
                      max="17:00"
                      step={3600}
                      onChange={(e) => setStTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      1-hour slot · 09:00–17:00
                    </p>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={stSpecialId}>Special requirements</Label>
                  <Input id={stSpecialId} value={stSpecial} onChange={(e) => setStSpecial(e.target.value)} />
                </div>
              </div>
            ) : null}

            {/* Conditional: Lost → required reason */}
            {stTarget === "lost" ? (
              <div className="grid gap-1.5">
                <Label htmlFor={stReasonId}>
                  Reason lost <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id={stReasonId}
                  value={stReason}
                  onChange={(e) => setStReason(e.target.value)}
                  placeholder="e.g. Bought elsewhere: found a cheaper Q3 at a rival dealer."
                  className="min-h-20"
                />
                <p className="text-2xs text-muted-foreground">
                  Saved to the lead record and the activity log.
                </p>
              </div>
            ) : null}

            {stError ? (
              <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {stError}
              </p>
            ) : null}
          </DialogPanel>
          <DialogFooter variant="bare">
            <Button type="button" variant="outline" onClick={() => setStatusOpen(false)} disabled={stBusy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitStatus()} disabled={stBusy}>
              {stBusy
                ? "Saving…"
                : stTarget === "appointment_booked"
                  ? "Book appointment"
                  : stTarget === "lost"
                    ? "Mark as Lost"
                    : "Update status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
