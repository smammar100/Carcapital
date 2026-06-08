"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

export interface NordSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface NordSelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  options: NordSelectOption[];
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  size?: "s" | "m" | "l";
}

/**
 * RHF-bound <nord-select>. Options are real <option> children (Nord's select
 * wraps a native select), so this is the clean replacement for the Base UI
 * Select composition in forms.
 */
export function NordSelectField<T extends FieldValues>({
  control,
  name,
  options,
  label,
  hint,
  placeholder,
  required,
  disabled,
  hideLabel,
  size,
}: NordSelectFieldProps<T>): React.ReactElement {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <nord-select
          expand
          label={label}
          hint={hint}
          name={field.name}
          value={(field.value ?? "") as string}
          required={required || undefined}
          disabled={disabled || undefined}
          hideLabel={hideLabel || undefined}
          size={size}
          error={fieldState.error?.message}
          onChange={(e) =>
            field.onChange((e.target as HTMLSelectElement).value)
          }
          onBlur={field.onBlur}
          suppressHydrationWarning
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </nord-select>
      )}
    />
  );
}
