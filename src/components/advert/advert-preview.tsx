"use client";

import { Check, Sparkles } from "lucide-react";
import type { AdvertData, Vehicle } from "@/lib/types";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { formatCurrency } from "@/lib/utils";

interface AdvertPreviewProps {
  vehicle: Vehicle;
  advert: AdvertData;
  description: string;
  price: number;
  photoUrl: string | null;
}

/**
 * Live listing-card preview — renders the advert as a buyer sees it on the
 * website / AutoTrader card, updating in real time from the editor's form
 * state. The standout upgrade over ClickDMS's plain stacked form.
 */
export function AdvertPreview({
  vehicle,
  advert,
  description,
  price,
  photoUrl,
}: AdvertPreviewProps) {
  const title = [
    advert.taxonomy.make ?? vehicle.make,
    advert.taxonomy.model ?? vehicle.model,
  ]
    .filter(Boolean)
    .join(" ");
  const sub =
    advert.taxonomy.derivative ??
    vehicle.derivative ??
    vehicle.variantName ??
    "";
  const highlights = advert.highlights.filter((h) => h.trim());
  const specLine = [
    vehicle.year,
    `${vehicle.mileage.toLocaleString("en-GB")} mi`,
    vehicle.transmission,
    vehicle.fuelType,
    vehicle.colour,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs/5">
      <div className="relative aspect-[16/10] w-full bg-muted">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <VehicleImage
            vehicle={vehicle}
            variant="card"
            className="h-full w-full"
          />
        )}
        {advert.attentionGrabber.trim() && (
          <span className="absolute left-2 top-2 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
            {advert.attentionGrabber}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="truncate text-xs text-muted-foreground">{sub}</div>
          </div>
          <div className="shrink-0 text-base font-semibold tabular-nums">
            {price ? formatCurrency(price) : "—"}
          </div>
        </div>

        {advert.keySellingPoint.trim() && (
          <div className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
            <Sparkles className="h-3 w-3" /> {advert.keySellingPoint}
          </div>
        )}

        <div className="text-[11px] capitalize text-muted-foreground">
          {specLine}
        </div>

        {highlights.length > 0 && (
          <ul className="mt-1 grid gap-0.5">
            {highlights.slice(0, 5).map((h, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                <span className="min-w-0">{h}</span>
              </li>
            ))}
          </ul>
        )}

        {description.trim() && (
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}

        {advert.features.length > 0 && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            + {advert.features.length} equipment feature
            {advert.features.length === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}
