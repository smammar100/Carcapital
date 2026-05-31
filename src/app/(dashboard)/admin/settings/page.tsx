"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { activityService } from "@/lib/services/activity-service";
import {
  FINANCE_PROVIDERS,
  INSPECTION_ITEMS,
  VAT_RATE,
} from "@/lib/constants";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, company } = useAuth();
  const [name, setName] = useState(company?.name ?? "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [vat, setVat] = useState(company?.vatNumber ?? "");
  const [stockPrefix, setStockPrefix] = useState(company?.stockIdPrefix ?? "");
  const [defaultProvider, setDefaultProvider] = useState("next_gear");
  const [defaultVat, setDefaultVat] = useState(String(VAT_RATE));

  async function handleSave() {
    // v1: company settings are read-only on the Company entity. We log the
    // intent so the activity feed shows the change; real persistence comes
    // with Supabase.
    if (!user || !company) return;
    await activityService.log({
      companyId: company.id,
      userId: user.id,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: "Company settings updated",
      metadata: { name, address, vatNumber: vat, stockIdPrefix: stockPrefix },
    });
    toast.success("Settings saved (mock — no persistence)");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company profile, defaults, and inspection checklist.
        </p>
      </div>
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
          <TabsTrigger value="inspection">Inspection Checklist</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-3">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
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
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={handleSave}>Save</Button>
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
              <Button onClick={() => toast.success("Defaults saved (mock)")}>
                Save
              </Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="inspection" className="mt-3">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Status options</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {INSPECTION_ITEMS.map((item) => (
                  <TableRow key={item.number}>
                    <TableCell>{item.number}</TableCell>
                    <TableCell className="font-medium">{item.item}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.statusOptions.join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
