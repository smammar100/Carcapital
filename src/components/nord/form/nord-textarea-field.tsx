"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

interface NordTextareaFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  size?: "s" | "m" | "l";
  maxLength?: number;
}

/** RHF-bound <nord-textarea>. */
export function NordTextareaField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  placeholder,
  required,
  disabled,
  hideLabel,
  size,
  maxLength,
}: NordTextareaFieldProps<T>): React.ReactElement {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <nord-textarea
          expand
          label={label}
          hint={hint}
          placeholder={placeholder}
          name={field.name}
          value={(field.value ?? "") as string}
          required={required || undefined}
          disabled={disabled || undefined}
          hideLabel={hideLabel || undefined}
          size={size}
          maxLength={maxLength}
          error={fieldState.error?.message}
          onInput={(e) =>
            field.onChange((e.target as HTMLTextAreaElement).value)
          }
          onBlur={field.onBlur}
          suppressHydrationWarning
        />
      )}
    />
  );
}
