"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

interface NordCheckboxFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * RHF-bound <nord-checkbox>. Reads `checked` off the change event (Nord's
 * change event bubbles → React's delegated onChange fires).
 */
export function NordCheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  disabled,
}: NordCheckboxFieldProps<T>): React.ReactElement {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <nord-checkbox
          label={label}
          hint={hint}
          name={field.name}
          checked={Boolean(field.value)}
          required={required || undefined}
          disabled={disabled || undefined}
          error={fieldState.error?.message}
          onChange={(e) =>
            field.onChange((e.target as HTMLInputElement).checked)
          }
          onBlur={field.onBlur}
          suppressHydrationWarning
        />
      )}
    />
  );
}
