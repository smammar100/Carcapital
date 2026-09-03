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
 * Base UI's `render` accepts both a `ReactElement` and a render function
 * (`(props, state) => ReactElement`), and each primitive's render signature is
 * generic over its own State. The helper is generic over the caller's render
 * type so the primitive's own prop type flows through unchanged, and the
 * `asChild` branch only ever adds a `ReactElement` to it.
 */
export function resolveRender<Render>(
  asChild: boolean | undefined,
  children: React.ReactNode,
  render: Render | undefined,
): { render: Render | React.ReactElement | undefined; children: React.ReactNode } {
  if (render) return { render, children: undefined };
  if (asChild && React.isValidElement(children)) {
    return { render: children, children: undefined };
  }
  return { render: undefined, children };
}
