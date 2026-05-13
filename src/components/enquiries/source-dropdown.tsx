"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ENQUIRY_SOURCES, type EnquirySourceValue } from "@/lib/enquiry-constants";
import { cn } from "@/lib/utils";

interface SourceDropdownProps {
  value: EnquirySourceValue | "";
  onChange: (value: EnquirySourceValue) => void;
  placeholder?: string;
  invalid?: boolean;
}

/**
 * Searchable source picker. The list of 25 values lives in
 * `enquiry-constants.ts` — too long for a plain Select, so we follow the
 * same Command-inside-Popover combobox pattern used by the vehicle picker
 * in `new-warranty-dialog.tsx`.
 */
export function SourceDropdown({
  value,
  onChange,
  placeholder = "Choose source",
  invalid,
}: SourceDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = ENQUIRY_SOURCES.find((s) => s.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            invalid && "border-destructive",
          )}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search sources…" />
          <CommandList>
            <CommandEmpty>No sources match.</CommandEmpty>
            <CommandGroup>
              {ENQUIRY_SOURCES.map((s) => (
                <CommandItem
                  key={s.value}
                  value={`${s.label} ${s.value}`}
                  onSelect={() => {
                    onChange(s.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      s.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {s.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
