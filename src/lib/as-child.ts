import * as React from "react";

/**
 * Bridge between Radix's `asChild` pattern and Base UI's `render` prop.
 *
 * Existing call sites use:
 *   <Trigger asChild><Button>...</Button></Trigger>
 *
 * Base UI's equivalent is:
 *   <Trigger render={<Button>...</Button>} />
 *
 * Trigger wrappers accept both — the explicit `render` prop wins; otherwise
 * if `asChild` is true and `children` is a single React element, that element
 * becomes the render target.
 *
 * Note: Base UI's `render` accepts both `ReactElement` and a render function
 * (`(props, state) => ReactElement`). Typed as `any` here because each
 * primitive's render signature is generic over its own State; consumers
 * still get accurate types at the call site via the primitive's wrapper.
 */
// biome-ignore lint/suspicious/noExplicitAny: see file comment
export function resolveRender(
  asChild: boolean | undefined,
  children: React.ReactNode,
  render: any,
): { render: any; children: React.ReactNode } {
  if (render) return { render, children: undefined };
  if (asChild && React.isValidElement(children)) {
    return { render: children, children: undefined };
  }
  return { render: undefined, children };
}
