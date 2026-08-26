"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import type { AdvertData, Listing } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import {
  ADVERT_LIMITS,
  MAX_HIGHLIGHTS,
  highlightsError,
  limitError,
  normaliseHighlights,
} from "@/lib/advert-limits";
import { cn } from "@/lib/utils";

/**
 * Inline description + highlights editing on the Listing tab (GEN-103).
 *
 * The tab was read-only: every change bounced the user out to the full Advert
 * editor, which is right for composing an advert and heavy-handed for fixing
 * one typo in a bullet. This adds the quick path; the "Edit Advert" deep link
 * stays for real composition.
 *
 * Validation comes from the same `advert-limits` module the Advert editor
 * uses, so the two cannot disagree about what fits.
 */

interface DescriptionEditorProps {
  listing: Listing;
  canEdit: boolean;
  onSaved: () => void;
}

export function DescriptionEditor({
  listing,
  canEdit,
  onSaved,
}: DescriptionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(listing.description ?? "");
  const [saving, setSaving] = useState(false);

  const error = limitError("description", draft);

  async function save() {
    if (error) return;
    setSaving(true);
    try {
      await listingService.update(listing.id, { description: draft });
      toast.success("Description updated");
      setEditing(false);
      onSaved();
    } catch {
      toast.error("Could not save the description.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm leading-relaxed text-foreground/80">
          {listing.description || (
            <span className="italic text-muted-foreground">
              No description yet, add one in the Advert editor.
            </span>
          )}
        </div>
        {canEdit && (
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(listing.description ?? "");
                setEditing(true);
              }}
              aria-label="Edit description"
            >
              <Pencil className="size-3.5" />
              Edit description
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label="Description"
        rows={8}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-xs tabular-nums",
            error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {draft.length.toLocaleString()} / {ADVERT_LIMITS.description.toLocaleString()}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={saving || !!error}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface HighlightsEditorProps {
  listing: Listing;
  /** Highlights as currently displayed (may come from legacy specialFeatures). */
  current: string[];
  canEdit: boolean;
  onSaved: () => void;
}

export function HighlightsEditor({
  listing,
  current,
  canEdit,
  onSaved,
}: HighlightsEditorProps) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<string[]>(current);
  const [saving, setSaving] = useState(false);

  const error = highlightsError(rows);

  async function save() {
    if (error) return;
    setSaving(true);
    try {
      const advertData: AdvertData = {
        ...listing.advertData,
        highlights: normaliseHighlights(rows),
      };
      await listingService.update(listing.id, { advertData });
      toast.success("Highlights updated");
      setEditing(false);
      onSaved();
    } catch {
      toast.error("Could not save the highlights.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        {current.length > 0 ? (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {current.map((h, i) => (
              <li key={`${h}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-2xs font-semibold text-primary">
                  {i + 1}
                </span>
                {h}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No highlights yet, add up to {MAX_HIGHLIGHTS} in the Advert editor.
          </p>
        )}
        {canEdit && (
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRows(current.length > 0 ? current : [""]);
                setEditing(true);
              }}
              aria-label="Edit highlights"
            >
              <Pencil className="size-3.5" />
              Edit highlights
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-2xs font-semibold text-primary">
            {i + 1}
          </span>
          <Input
            aria-label={`Highlight ${i + 1}`}
            value={row}
            maxLength={ADVERT_LIMITS.highlight}
            onChange={(e) =>
              setRows((r) => r.map((v, j) => (j === i ? e.target.value : v)))
            }
          />
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Remove highlight ${i + 1}`}
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            disabled={saving}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}

      {rows.length < MAX_HIGHLIGHTS && (
        <div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRows((r) => [...r, ""])}
            aria-label="Add highlight"
            disabled={saving}
          >
            <Plus className="size-3.5" />
            Add highlight
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={saving || !!error}>
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
