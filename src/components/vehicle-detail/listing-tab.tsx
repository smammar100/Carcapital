"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import type { Listing, Vehicle } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, FieldGrid, Panel } from "./primitives";

interface ListingTabProps {
  vehicle: Vehicle;
}

/**
 * Listing tab (Variation A — refined record). A read-only summary of how this
 * vehicle is advertised: the AutoTrader taxonomy spec, the description, the
 * website highlights (as bullets) and selected equipment. Editing happens in
 * the Advert editor — the single "Edit Advert" action links there.
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
          <Button asChild size="sm">
            <Link href={`/vehicles/${vehicle.id}/advert`}>
              Open Advert editor
            </Link>
          </Button>
        }
      />
    );
  }

  const advert = listing.advertData;
  const tax = advert?.taxonomy ?? {};

  // Highlights: prefer the structured advertData; fall back to the legacy
  // delimited specialFeatures string. Drop blanks.
  const highlights = (
    advert?.highlights?.length
      ? advert.highlights
      : listing.specialFeatures.split(/[•\n;]/)
  )
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, 5);

  const features = advert?.features ?? [];
  const descChars = listing.description?.length ?? 0;
  const engineSize =
    tax.engineSize ||
    (vehicle.engineSizeCC ? `${(vehicle.engineSizeCC / 1000).toFixed(1)}` : "—");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900 dark:bg-violet-500/10 dark:text-violet-200">
        <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Mapped to AutoTrader&apos;s taxonomy: get it wrong and the advert is
          filtered out of search results entirely. This is how buyers see the
          car across AutoTrader, the website and partner channels.
        </span>
      </div>

      <Panel
        title="Advert Specification"
        subtitle="Mapped to AutoTrader's product hierarchy"
        action={
          <Button asChild size="sm">
            <Link href={`/vehicles/${vehicle.id}/advert`}>Edit Advert</Link>
          </Button>
        }
      >
        <FieldGrid cols={4}>
          <Field label="Make">{tax.make ?? vehicle.make}</Field>
          <Field label="Model">{tax.model ?? vehicle.model}</Field>
          <Field label="Generation" muted={!(tax.generation ?? vehicle.generation)}>
            {tax.generation ??
              vehicle.generation ??
              `${vehicle.bodyType.toUpperCase()} (${vehicle.year - 2} – ${vehicle.year + 5})`}
          </Field>
          <Field label="Trim">
            {tax.trim ?? vehicle.trim ?? vehicle.variantName ?? "—"}
          </Field>
          <Field label="Fuel Type">
            <span className="capitalize">{tax.fuelType ?? vehicle.fuelType}</span>
          </Field>
          <Field label="Engine Size">{engineSize}</Field>
          <Field label="Transmission">
            <span className="capitalize">
              {tax.transmission ?? vehicle.transmission}
            </span>
          </Field>
          <Field label="Derivative">
            {tax.derivative ?? vehicle.derivative ?? vehicle.variantCode ?? "—"}
          </Field>
        </FieldGrid>
      </Panel>

      <Panel
        title="Vehicle Description"
        subtitle={`${descChars.toLocaleString()} chars`}
      >
        <div className="text-sm leading-relaxed text-foreground/80">
          {listing.description || (
            <span className="italic text-muted-foreground">
              No description yet, add one in the Advert editor.
            </span>
          )}
        </div>
      </Panel>

      <Panel
        title="Website Highlights"
        subtitle="Shown as bullet points on the listing card"
      >
        {highlights.length > 0 ? (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-2xs font-semibold text-primary">
                  {i + 1}
                </span>
                {h}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No highlights yet, add up to 5 in the Advert editor.
          </p>
        )}
      </Panel>

      {features.length > 0 && (
        <Panel
          title="Equipment"
          subtitle={`${features.length} feature${features.length === 1 ? "" : "s"}`}
        >
          <div className="flex flex-wrap gap-1.5">
            {features.map((f) => (
              <span
                key={f}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
