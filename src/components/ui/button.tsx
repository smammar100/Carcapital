"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";
import { resolveRender } from "@/lib/as-child";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

/**
 * Button — now backed by Nord's <nord-button> web component, behind the same
 * import path/API so the ~140 call sites keep working unchanged.
 *
 * Plain buttons render <nord-button>. The `render` / `asChild` escape hatch
 * (e.g. `<Button render={<Link/>}>`) keeps the Base UI path + the legacy
 * `buttonVariants` classes, so button-as-link / custom-element cases retain
 * client-side routing and compile-compatibility until migrated per section.
 */

// Kept for backwards compat: a few modules import `buttonVariants` to style
// links/badges as buttons. Still returns the legacy Tailwind classes (Nord
// tokens via globals.css), used only on the render/asChild passthrough path.
export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        default: "h-9 px-3 sm:h-8",
        icon: "size-9 sm:size-8",
        "icon-lg": "size-10 sm:size-9",
        "icon-sm": "size-8 sm:size-7",
        "icon-xl": "size-11 sm:size-10",
        "icon-xs": "size-7 sm:size-6",
        lg: "h-10 px-3.5 sm:h-9",
        sm: "h-8 gap-1.5 px-2.5 sm:h-7",
        xl: "h-11 px-4 text-base sm:h-10 sm:text-sm",
        xs: "h-7 gap-1 rounded-md px-2 text-sm sm:h-6 sm:text-xs",
      },
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "border-destructive bg-destructive text-white hover:bg-destructive/90",
        "destructive-outline": "border-input text-destructive-foreground hover:bg-destructive/4",
        ghost: "border-transparent text-foreground hover:bg-accent",
        link: "border-transparent text-foreground underline-offset-4 hover:underline",
        outline: "border-input bg-popover text-foreground hover:bg-accent/50",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90",
      },
    },
  },
);

type AppVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type AppSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

const VARIANT_MAP: Record<AppVariant, "default" | "primary" | "dashed" | "plain" | "danger"> = {
  default: "primary",
  secondary: "default",
  outline: "default",
  ghost: "plain",
  link: "plain",
  destructive: "danger",
  "destructive-outline": "danger",
};

const SIZE_MAP: Record<AppSize, "s" | "m" | "l"> = {
  default: "m",
  sm: "s",
  lg: "l",
  xl: "l",
  xs: "s",
  icon: "m",
  "icon-sm": "s",
  "icon-lg": "l",
  "icon-xl": "l",
  "icon-xs": "s",
};

const SQUARE_SIZES = new Set<AppSize>([
  "icon",
  "icon-sm",
  "icon-lg",
  "icon-xl",
  "icon-xs",
]);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  loading?: boolean;
  asChild?: boolean;
  /** Stretch the button to fill the available inline space (nord `expand`). */
  expand?: boolean;
}

export function Button(props: ButtonProps): React.ReactElement {
  // Escape hatch (render/asChild) goes through a separate component so the
  // useRender hook is never called conditionally (rules-of-hooks).
  if (props.asChild || props.render) {
    return <ButtonRender {...props} />;
  }

  const {
    className,
    variant = "default",
    size = "default",
    children,
    loading = false,
    disabled,
    expand,
    type,
    style,
    // strip props that don't forward to <nord-button>
    asChild: _asChild,
    render: _render,
    ...rest
  } = props;

  return (
    <nord-button
      variant={VARIANT_MAP[variant ?? "default"]}
      size={SIZE_MAP[size ?? "default"]}
      type={type ?? "button"}
      loading={loading}
      disabled={Boolean(loading || disabled)}
      square={SQUARE_SIZES.has(size ?? "default") || undefined}
      expand={expand || undefined}
      className={className}
      style={style}
      data-slot="button"
      suppressHydrationWarning
      {...(rest as React.HTMLAttributes<HTMLElement>)}
    >
      {children}
    </nord-button>
  );
}

/**
 * render / asChild path — keeps the Base UI useRender behaviour (e.g.
 * `<Button render={<Link/>}>`) so client-side routing and odd cases work, with
 * the legacy Tailwind button classes (Nord tokens via globals.css).
 */
function ButtonRender({
  className,
  variant = "default",
  size = "default",
  render,
  children,
  loading = false,
  disabled,
  asChild,
  expand: _expand,
  ...props
}: ButtonProps): React.ReactElement {
  const resolved = resolveRender(asChild, children, render);
  const defaultProps = {
    className: cn(buttonVariants({ size, variant }), className),
    "data-slot": "button",
    disabled: Boolean(loading || disabled),
    children: resolved.children,
  };
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render: resolved.render,
  });
}
