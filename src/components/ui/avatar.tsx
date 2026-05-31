"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "@/lib/utils";
import type React from "react";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const AVATAR_SIZE_CLASS: Record<AvatarSize, string> = {
  xs: "size-5 text-2xs",
  sm: "size-6 text-2xs",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-12 text-base",
  "2xl": "size-16 text-base",
};

export function Avatar({
  className,
  size,
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: AvatarSize;
}): React.ReactElement {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-background align-middle font-medium",
        size ? AVATAR_SIZE_CLASS[size] : "size-8 text-xs",
        className,
      )}
      data-slot="avatar"
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: AvatarPrimitive.Image.Props): React.ReactElement {
  return (
    <AvatarPrimitive.Image
      className={cn("size-full object-cover", className)}
      data-slot="avatar-image"
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props): React.ReactElement {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted",
        className,
      )}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

export { AvatarPrimitive };
