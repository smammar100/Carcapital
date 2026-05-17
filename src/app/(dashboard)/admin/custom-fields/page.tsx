"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  ArchiveRestore,
  ListPlus,
  Pencil,
  Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  customFieldService,
  slugifyFieldKey,
} from "@/lib/services/custom-field-service";
import type { CustomFieldDefinition, CustomFieldType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency (£)" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multi_select", label: "Multi-select" },
];

interface Draft {
  id: string | null;
  label: string;
  fieldType: CustomFieldType;
  optionsText: string;
  required: boolean;
  showInMasterSheet: boolean;
  showInArrivalForm: boolean;
}

const EMPTY: Draft = {
  id: null,
  label: "",
  fieldType: "text",
  optionsText: "",
  required: false,
  showInMasterSheet: false,
  showInArrivalForm: false,
};

const needsOptions = (t: CustomFieldType) =>
  t === "dropdown" || t === "multi_select";

export default function CustomFieldsPage() {
  const { user, company } = useAuth();
  const canManage = user?.isSuperUser === true;
  const [fields, setFields] = useState<CustomFieldDefinition[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!company) return;
    setFields(await customFieldService.getAll(company.id));
  }

  useEffect(() => {
    if (!company) return;
    void customFieldService.getAll(company.id).then(setFields);
  }, [company]);

  const active = useMemo(
    () => (fields ?? []).filter((f) => f.archivedAt === null),
    [fields],
  );

  function openEdit(f: CustomFieldDefinition) {
    setDraft({
      id: f.id,
      label: f.label,
      fieldType: f.fieldType,
      optionsText: (f.options ?? []).join("\n"),
      required: f.required,
      showInMasterSheet: f.showInMasterSheet,
      showInArrivalForm: f.showInArrivalForm,
    });
  }

  async function handleSave() {
    if (!company || !draft) return;
    if (!draft.label.trim()) {
      toast.error("Label is required");
      return;
    }
    const options = needsOptions(draft.fieldType)
      ? draft.optionsText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
    if (needsOptions(draft.fieldType) && (!options || options.length === 0)) {
      toast.error("Add at least one option for a dropdown / multi-select");
      return;
    }
    setBusy(true);
    try {
      if (draft.id) {
        const res = await customFieldService.update(draft.id, {
          label: draft.label,
          options,
          required: draft.required,
          showInMasterSheet: draft.showInMasterSheet,
          showInArrivalForm: draft.showInArrivalForm,
        });
        if (!res) {
          toast.error("Couldn't save — is migration 0003 applied?");
          return;
        }
        toast.success("Custom field updated");
      } else {
        const res = await customFieldService.create({
          companyId: company.id,
          label: draft.label,
          fieldType: draft.fieldType,
          options,
          required: draft.required,
          showInMasterSheet: draft.showInMasterSheet,
          showInArrivalForm: draft.showInArrivalForm,
          createdBy: user?.id ?? null,
        });
        if (!res) {
          toast.error("Couldn't create — is migration 0003 applied?");
          return;
        }
        toast.success("Custom field created");
      }
      await reload();
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(
    f: CustomFieldDefinition,
    key: "showInMasterSheet" | "showInArrivalForm" | "required",
  ) {
    const patch =
      key === "required"
        ? { required: !f.required }
        : key === "showInMasterSheet"
          ? { showInMasterSheet: !f.showInMasterSheet }
          : { showInArrivalForm: !f.showInArrivalForm };
    await customFieldService.update(f.id, patch);
    await reload();
  }

  async function archive(f: CustomFieldDefinition) {
    if (f.archivedAt) await customFieldService.unarchive(f.id);
    else await customFieldService.archive(f.id);
    await reload();
    toast.success(f.archivedAt ? "Field restored" : "Field archived");
  }

  async function reorder(index: number, dir: -1 | 1) {
    const list = active;
    const target = list[index + dir];
    const self = list[index];
    if (!target || !self) return;
    await Promise.all([
      customFieldService.update(self.id, {
        displayOrder: target.displayOrder,
      }),
      customFieldService.update(target.id, {
        displayOrder: self.displayOrder,
      }),
    ]);
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Custom Fields
          </h1>
          <p className="text-sm text-muted-foreground">
            Add your own vehicle columns — no developer needed. Show them on
            the Master Sheet and / or the Add Vehicle form.
          </p>
        </div>
        {canManage && (
          <Dialog
            open={draft !== null}
            onOpenChange={(o) => {
              if (!o) setDraft(null);
              else if (draft === null) setDraft({ ...EMPTY });
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 h-4 w-4" /> Add Field
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {draft?.id ? "Edit Custom Field" : "Add Custom Field"}
                </DialogTitle>
              </DialogHeader>
              {draft && (
                <div className="grid gap-3">
                  <div>
                    <Label>Label</Label>
                    <Input
                      value={draft.label}
                      onChange={(e) =>
                        setDraft({ ...draft, label: e.target.value })
                      }
                      placeholder="e.g. Previous Owner Notes"
                    />
                    {draft.label.trim() && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Key:{" "}
                        <code className="font-mono">
                          {draft.id
                            ? "(immutable)"
                            : slugifyFieldKey(draft.label)}
                        </code>
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={draft.fieldType}
                      onValueChange={(v) =>
                        setDraft({ ...draft, fieldType: v as CustomFieldType })
                      }
                      disabled={draft.id !== null}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {draft.id !== null && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Field type cannot be changed after creation to
                        preserve existing data.
                      </p>
                    )}
                  </div>
                  {needsOptions(draft.fieldType) && (
                    <div>
                      <Label>Options (one per line)</Label>
                      <Textarea
                        value={draft.optionsText}
                        onChange={(e) =>
                          setDraft({ ...draft, optionsText: e.target.value })
                        }
                        className="min-h-20"
                        placeholder={"Family\nSport\nLuxury"}
                      />
                    </div>
                  )}
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
                    <label className="flex items-center justify-between text-sm">
                      Required
                      <Switch
                        checked={draft.required}
                        onCheckedChange={(v) =>
                          setDraft({ ...draft, required: v })
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between text-sm">
                      Show in Master Sheet
                      <Switch
                        checked={draft.showInMasterSheet}
                        onCheckedChange={(v) =>
                          setDraft({ ...draft, showInMasterSheet: v })
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between text-sm">
                      Show in Add Vehicle form
                      <Switch
                        checked={draft.showInArrivalForm}
                        onCheckedChange={(v) =>
                          setDraft({ ...draft, showInArrivalForm: v })
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={busy}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canManage && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          View only — custom field definitions can be changed by an
          administrator.
        </div>
      )}

      {!fields ? (
        <Skeleton className="h-64" />
      ) : fields.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="No custom fields yet"
          description="Add columns like Auction Lot Number or Category Tag to tailor the Master Sheet."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-center font-medium">Required</th>
                <th className="px-3 py-2 text-center font-medium">
                  Master Sheet
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  Arrival Form
                </th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((f, i) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    {canManage && (
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={i === 0}
                          onClick={() => void reorder(i, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={i === active.length - 1}
                          onClick={() => void reorder(i, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{f.label}</div>
                    <code className="text-[11px] text-muted-foreground">
                      {f.fieldKey}
                    </code>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="capitalize">
                      {f.fieldType.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={f.required}
                      disabled={!canManage}
                      onCheckedChange={() => void toggle(f, "required")}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={f.showInMasterSheet}
                      disabled={!canManage}
                      onCheckedChange={() =>
                        void toggle(f, "showInMasterSheet")
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={f.showInArrivalForm}
                      disabled={!canManage}
                      onCheckedChange={() =>
                        void toggle(f, "showInArrivalForm")
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(f)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => void archive(f)}
                            title="Archive"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {fields.some((f) => f.archivedAt !== null) && (
            <div className="border-t bg-muted/20 px-3 py-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Archived
              </p>
              <div className="flex flex-wrap gap-2">
                {fields
                  .filter((f) => f.archivedAt !== null)
                  .map((f) => (
                    <span
                      key={f.id}
                      className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs"
                    >
                      {f.label}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void archive(f)}
                          title="Restore"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ArchiveRestore className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
