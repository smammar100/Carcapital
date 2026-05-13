"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone, Sparkles } from "lucide-react";
import type { Listing, Vehicle } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, FieldGrid, InfoCard, PanelCard } from "./primitives";

interface ListingTabProps {
  vehicle: Vehicle;
}

/**
 * Listing tab — how this vehicle is presented to buyers. Two sub-sections:
 *   1. Info card with the "AutoTrader taxonomy" explainer
 *   2. Advert specification (Make → Model → Generation → Trim → Derivative)
 *   3. Vehicle description (AI-generated, regenerable)
 *   4. Website highlights — 5 bullet inputs, 40 chars each
 *
 * If no listing exists, prompts the user to create one from the Work List.
 */
export function ListingTab({ vehicle }: ListingTabProps) {
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);

  useEffect(() => {
    void listingService.getForVehicle(vehicle.id).then(setListing);
  }, [vehicle.id]);

  if (listing === undefined) {
    return (
      <PanelCard noHead>
        <Skeleton className="h-32 w-full" />
      </PanelCard>
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
    <div className="flex flex-col">
      <InfoCard
        icon={<Megaphone className="h-4.5 w-4.5" />}
        title="How your advert appears on AutoTrader, the website, and partner channels"
      >
        AutoTrader doesn&apos;t accept free-form data — every advert must map
        to their <strong>taxonomy</strong> (Make → Model → Generation → Trim →
        Derivative). Get this wrong and your advert is filtered out of search
        results entirely. Below: the structured taxonomy fields, an AI-generated
        description, and 5 <strong>website highlights</strong> that show as
        bullet points on listing cards.
      </InfoCard>

      <PanelCard
        title="Advert Specification"
        subtitle="Mapped to AutoTrader's product hierarchy"
        trailing={
          <Button variant="outline" size="sm">
            Preview
          </Button>
        }
      >
        <FieldGrid cols={4} className="gap-x-6 gap-y-4">
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
            {vehicle.engineSizeCC ? `${(vehicle.engineSizeCC / 1000).toFixed(1)}` : "—"}
          </Field>
          <Field label="Transmission">
            <span className="capitalize">{vehicle.transmission}</span>
          </Field>
          <Field label="Derivative" mono>
            {vehicle.variantCode ?? "—"}
          </Field>
        </FieldGrid>
      </PanelCard>

      <PanelCard
        title="Vehicle Description"
        subtitle={`${descChars.toLocaleString()} chars · regenerate any time`}
        trailing={
          <Button size="sm">
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#F5C518]" />
            Regenerate
          </Button>
        }
      >
        <div className="text-[13px] leading-relaxed text-foreground/80">
          {listing.description || (
            <span className="italic text-muted-foreground">
              No description yet — use Regenerate to draft one with AI.
            </span>
          )}
        </div>
      </PanelCard>

      <PanelCard
        title="Website Highlights"
        subtitle="40 chars max each · displayed on listing card"
      >
        <WebsiteHighlights existing={listing.specialFeatures} />
      </PanelCard>
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
          className="grid grid-cols-[30px_1fr_50px] items-center gap-3"
        >
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">
            {String(i + 1).padStart(2, "0")}
          </span>
          <Input
            defaultValue={value}
            placeholder="Add highlight…"
            maxLength={40}
            className="h-9 text-[13px]"
          />
          <span className="text-right font-mono text-[10.5px] text-muted-foreground">
            {value.length}/40
          </span>
        </div>
      ))}
    </div>
  );
}
