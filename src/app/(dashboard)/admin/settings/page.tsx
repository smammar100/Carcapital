"use client";

import { useRef, useState } from "react";
import { ShieldX, ImageIcon, Upload, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  companyService,
  type LogoKind,
} from "@/lib/services/company-service";
import { EmptyState } from "@/components/shared/empty-state";
import { PipelineStageSettings } from "@/components/admin/pipeline-stage-settings";
import { InspectionChecklistSettings } from "@/components/admin/inspection-checklist-settings";
import { FINANCE_PROVIDERS, VAT_RATE } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";

export default function SettingsPage() {
  const { user, company, revalidate } = useAuth();
  const { can, isSuperUser, isLoading } = usePermissions();
  const canManage = isSuperUser || can("admin:manage_settings");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(company?.name ?? "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [vat, setVat] = useState(company?.vatNumber ?? "");
  const [stockPrefix, setStockPrefix] = useState(company?.stockIdPrefix ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(
    company?.logoUrl ?? null,
  );
  const [logoMarkUrl, setLogoMarkUrl] = useState<string | null>(
    company?.logoMarkUrl ?? null,
  );
  const [hoursStart, setHoursStart] = useState(
    company?.workingHoursStart ?? "09:00",
  );
  const [hoursEnd, setHoursEnd] = useState(
    company?.workingHoursEnd ?? "18:00",
  );
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingMark, setUploadingMark] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState("next_gear");
  const [defaultVat, setDefaultVat] = useState(String(VAT_RATE));

  async function handleLogoSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: LogoKind,
  ) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file || !company) return;
    const setUploading = kind === "mark" ? setUploadingMark : setUploadingLogo;
    const setUrl = kind === "mark" ? setLogoMarkUrl : setLogoUrl;
    setUploading(true);
    try {
      const url = await companyService.uploadLogo(file, company.id, kind);
      setUrl(url);
      toast.success("Uploaded — click Save to apply it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload image");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!user || !company) return;
    if (hoursEnd <= hoursStart) {
      toast.error("Working hours end must be after the start time");
      return;
    }
    setSaving(true);
    try {
      await companyService.update(
        company.id,
        {
          name,
          address,
          vatNumber: vat,
          stockIdPrefix: stockPrefix,
          logoUrl: logoUrl ?? "",
          logoMarkUrl: logoMarkUrl ?? "",
          workingHoursStart: hoursStart,
          workingHoursEnd: hoursEnd,
        },
        user.id,
      );
      // Refresh the auth-context company so the sidebar mark + invoice logo
      // pick up the change without a full reload.
      await revalidate();
      toast.success("Company settings saved");
    } catch (err) {
      console.error("[settings] save failed:", err);
      toast.error("Couldn't save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company profile, defaults, and inspection checklist.
        </p>
      </div>
      {!isLoading && !canManage ? (
        <EmptyState
          icon={ShieldX}
          title="You don't have access"
          description="Editing company settings requires the Manage Settings capability."
        />
      ) : (
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
          <TabsTrigger value="inspection">Inspection Checklist</TabsTrigger>
          <TabsTrigger value="pipeline">Sales Pipeline</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-3">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <LogoField
              label="Full logo"
              hint="Shown on generated invoices (logo + wordmark). PNG or JPG — large images are automatically resized."
              url={logoUrl}
              previewClassName="h-16 w-24"
              uploading={uploadingLogo}
              onSelect={(e) => void handleLogoSelect(e, "full")}
              onClear={() => setLogoUrl(null)}
            />
            <LogoField
              label="Logo mark"
              hint="Square icon shown in the sidebar. Falls back to the initials when unset. PNG or JPG."
              url={logoMarkUrl}
              previewClassName="h-16 w-16"
              uploading={uploadingMark}
              onSelect={(e) => void handleLogoSelect(e, "mark")}
              onClear={() => setLogoMarkUrl(null)}
            />
            <div className="sm:col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <Label>VAT number</Label>
              <Input value={vat} onChange={(e) => setVat(e.target.value)} />
            </div>
            <div>
              <Label>Stock ID prefix</Label>
              <Input
                value={stockPrefix}
                onChange={(e) => setStockPrefix(e.target.value)}
                maxLength={4}
              />
            </div>
            <div>
              <Label>Working hours start</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Drives the visible range on the Appointment Book calendar.
              </p>
              <Input
                type="time"
                value={hoursStart}
                onChange={(e) => setHoursStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Working hours end</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Appointments can be booked up to one hour before this time.
              </p>
              <Input
                type="time"
                value={hoursEnd}
                onChange={(e) => setHoursEnd(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="defaults" className="mt-3">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <Label>Default finance provider</Label>
              <Select
                value={defaultProvider}
                onValueChange={setDefaultProvider}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCE_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default VAT rate</Label>
              <Input
                value={defaultVat}
                onChange={(e) => setDefaultVat(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button
                onClick={() =>
                  toast.success("Defaults applied for this session")
                }
              >
                Save
              </Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="inspection" className="mt-3">
          <InspectionChecklistSettings />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-3">
          <PipelineStageSettings />
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}

/** One logo uploader (preview + Upload/Replace + Remove). Owns its file input. */
function LogoField({
  label,
  hint,
  url,
  previewClassName,
  uploading,
  onSelect,
  onClear,
}: {
  label: string;
  hint: string;
  url: string | null;
  previewClassName: string;
  uploading: boolean;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="sm:col-span-2">
      <Label>{label}</Label>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-4">
        <div
          className={`grid shrink-0 place-items-center overflow-hidden rounded-md ${url ? "" : "border bg-muted/30"} ${previewClassName}`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={onSelect}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {uploading ? "Uploading…" : url ? "Replace" : "Upload"}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onClear}
              disabled={uploading}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
