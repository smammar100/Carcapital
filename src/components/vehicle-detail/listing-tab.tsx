"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone, Sparkles } from "lucide-react";
import type { Listing, Vehicle } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, FieldGrid, InfoCard, Panel } from "./primitives";

interface ListingTabProps {
  vehicle: Vehicle;
}

/**
 * Listing tab — how this vehicle is presented to buyers. Sections:
 *   1. Info card explaining AutoTrader taxonomy
 *   2. Advert specification field grid
 *   3. Vehicle description (AI-generated, regenerable)
 *   4. Website highlights — 5 bullet inputs (40 chars each)
 */
export function ListingTab({ vehicle }: ListingTabProps) {
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);

  useEffect(() => {
    void listingService.getForVehicle(vehicle.id).then(setListing);
  }, [vehicle.id]);

  if (listing === undefined) {
    return (
      <Panel title="Listing" subtitle="Loading…">
        <Skeleton className="h-32 w-full" />
      </Panel>
    );
  }

  if (listing === null) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Not listed yet"
        description="Vehicles in 'ready' status can be listed for sale."
        action={
          vehicle.status === "ready" ? (
            <Button asChild size="sm">
              <Link href="/advert/work-list">Go to Work List</Link>
            </Button>
          ) : null
        }
      />
    );
  }

  const descChars = listing.description?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <InfoCard
        icon={<Megaphone className="h-4 w-4" />}
        title="How your advert appears on AutoTrader, the website, and partner channels"
      >
        AutoTrader doesn&apos;t accept free-form data — every advert must map
        to their <strong>taxonomy</strong> (Make → Model → Generation → Trim →
        Derivative). Get this wrong and your advert is filtered out of search
        results entirely. Below: the structured taxonomy fields, an AI-generated
        description, and 5 <strong>website highlights</strong> that show as
        bullet points on listing cards.
      </InfoCard>

      <Panel
        title="Advert Specification"
        subtitle="Mapped to AutoTrader's product hierarchy"
        action={
          <Button variant="outline" size="sm">
            Preview
          </Button>
        }
      >
        <FieldGrid cols={4}>
          <Field label="Make">{vehicle.make}</Field>
          <Field label="Model">{vehicle.model}</Field>
          <Field label="Generation" muted>
            {vehicle.bodyType.toUpperCase()} ({vehicle.year - 2} – {vehicle.year + 5})
          </Field>
          <Field label="Trim">{vehicle.variantName ?? "—"}</Field>
          <Field label="Fuel Type">
            <span className="capitalize">{vehicle.fuelType}</span>
          </Field>
          <Field label="Engine Size">
            {vehicle.engineSizeCC
              ? `${(vehicle.engineSizeCC / 1000).toFixed(1)}`
              : "—"}
          </Field>
          <Field label="Transmission">
            <span className="capitalize">{vehicle.transmission}</span>
          </Field>
          <Field label="Derivative" numeric>
            {vehicle.variantCode ?? "—"}
          </Field>
        </FieldGrid>
      </Panel>

      <Panel
        title="Vehicle Description"
        subtitle={`${descChars.toLocaleString()} chars · regenerate any time`}
        action={
          <Button size="sm">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Regenerate
          </Button>
        }
      >
        <div className="text-sm leading-relaxed text-foreground/80">
          {listing.description || (
            <span className="italic text-muted-foreground">
              No description yet — use Regenerate to draft one with AI.
            </span>
          )}
        </div>
      </Panel>

      <Panel
        title="Website Highlights"
        subtitle="40 chars max each · displayed on listing card"
      >
        <WebsiteHighlights existing={listing.specialFeatures} />
      </Panel>
    </div>
  );
}

function WebsiteHighlights({ existing }: { existing: string }) {
  // `specialFeatures` is currently one delimited string in the schema —
  // split it for the 5-row UI, padding with empty slots.
  const initial = existing
    ? existing
        .split(/[•\n;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const slots = Array.from({ length: 5 }, (_, i) => initial[i] ?? "");
  return (
    <div className="grid gap-2.5">
      {slots.map((value, i) => (
        <div
          key={i}
          className="grid grid-cols-[28px_1fr_56px] items-center gap-3"
        >
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {String(i + 1).padStart(2, "0")}
          </span>
          <Input
            defaultValue={value}
            placeholder="Add highlight…"
            maxLength={40}
            className="h-9"
          />
          <span className="text-right text-xs tabular-nums text-muted-foreground">
            {value.length}/40
          </span>
        </div>
      ))}
    </div>
  );
}
