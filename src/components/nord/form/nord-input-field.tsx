"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import type { Input as NordInput } from "@nordhealth/components";

interface NordInputFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  hint?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "tel" | "url" | "search" | "number";
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  hideLabel?: boolean;
  autoComplete?: NordInput["autocomplete"];
  size?: "s" | "m" | "l";
}

/**
 * RHF-bound <nord-input>. Surfaces Nord's native label/hint/error and wires the
 * value through a Controller. Uses `onInput` (per-keystroke) — Nord's input
 * event bubbles, so React's delegated handler fires normally.
 */
export function NordInputField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  placeholder,
  type = "text",
  required,
  disabled,
  readonly,
  hideLabel,
  autoComplete,
  size,
}: NordInputFieldProps<T>): React.ReactElement {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <nord-input
          expand
          label={label}
          hint={hint}
          placeholder={placeholder}
          type={type}
          name={field.name}
          value={(field.value ?? "") as string}
          required={required || undefined}
          disabled={disabled || undefined}
          readonly={readonly || undefined}
          hideLabel={hideLabel || undefined}
          autocomplete={autoComplete}
          size={size}
          error={fieldState.error?.message}
          onInput={(e) =>
            field.onChange((e.target as HTMLInputElement).value)
          }
          onBlur={field.onBlur}
          suppressHydrationWarning
        />
      )}
    />
  );
}
