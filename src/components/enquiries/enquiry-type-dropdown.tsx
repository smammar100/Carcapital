"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENQUIRY_TYPES_ACTIVE,
  ENQUIRY_TYPES_LOST,
} from "@/lib/enquiry-constants";
import type { EnquiryType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EnquiryTypeDropdownProps {
  value: EnquiryType | "";
  onChange: (value: EnquiryType) => void;
  invalid?: boolean;
  id?: string;
}

/**
 * Grouped picker — "Active" types up top, "Lost — …" types below a
 * separator. Picking a Lost-X item should also auto-derive the
 * `status='lost'` + `lost_reason` server-side via the service layer
 * (see `enquiry-service.deriveStatus`); the form layer just feeds this
 * value straight through.
 */
export function EnquiryTypeDropdown({
  value,
  onChange,
  invalid,
  id,
}: EnquiryTypeDropdownProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as EnquiryType)}>
      <SelectTrigger
        id={id}
        aria-invalid={invalid}
        className={cn(invalid && "border-destructive")}
      >
        <SelectValue placeholder="Choose type" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-xs text-muted-foreground">
            Active
          </SelectLabel>
          {ENQUIRY_TYPES_ACTIVE.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel className="text-xs text-muted-foreground">
            Lost
          </SelectLabel>
          {ENQUIRY_TYPES_LOST.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
