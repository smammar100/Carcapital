"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePostcodeLookup } from "@/hooks/use-postcode-lookup";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface PostcodeLookupFieldProps {
  postcode: string;
  onPostcodeChange: (value: string) => void;
  addressLines: string[];
  onAddressLinesChange: (lines: string[]) => void;
  postcodeError?: string;
}

/**
 * Postcode + 4 address line inputs, with a Lookup button that pings the
 * `customerService.lookupAddressByPostcode` stub. On success it fills
 * the four lines but leaves them editable — never lock the user out of
 * correcting the canned data.
 */
export function PostcodeLookupField({
  postcode,
  onPostcodeChange,
  addressLines,
  onAddressLinesChange,
  postcodeError,
}: PostcodeLookupFieldProps) {
  const { lookup, isLoading } = usePostcodeLookup();
  const [touched, setTouched] = useState(false);

  // Make sure the 4 lines exist so the controlled inputs don't flicker
  // between "" and undefined.
  const lines = [0, 1, 2, 3].map((i) => addressLines[i] ?? "");

  function setLine(index: number, value: string) {
    const next = [...lines];
    next[index] = value;
    onAddressLinesChange(next);
  }

  async function handleLookup() {
    setTouched(true);
    if (!postcode.trim()) {
      notify.warning("Enter a postcode first");
      return;
    }
    const result = await lookup(postcode);
    if (!result) {
      notify.info("No address found for that postcode — enter manually");
      return;
    }
    onAddressLinesChange([
      result.line1,
      result.line2,
      result.line3,
      result.line4,
    ]);
    notify.success("Address filled — review and adjust if needed");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-1">
        <Label htmlFor="postcode">Postcode</Label>
        <Input
          id="postcode"
          value={postcode}
          onChange={(e) => onPostcodeChange(e.target.value)}
          placeholder="e.g. UB1 3DZ"
          aria-invalid={!!postcodeError}
          className={cn(postcodeError && "border-destructive")}
        />
        {postcodeError && touched && (
          <p className="mt-1 text-xs text-destructive">{postcodeError}</p>
        )}
      </div>
      <div className="flex items-end sm:col-span-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleLookup}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {isLoading ? "Looking up…" : "Lookup address"}
        </Button>
      </div>
      <div className="sm:col-span-3">
        <Label>Address</Label>
        <div className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <Input
              key={i}
              value={line}
              onChange={(e) => setLine(i, e.target.value)}
              placeholder={`Address line ${i + 1}`}
              aria-label={`Address line ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
