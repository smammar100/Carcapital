/**
 * Build a Vehicle Detail link that stamps the current page as `?from=`, so
 * the detail page's Back button returns to wherever the user actually came
 * from instead of always falling back to Inventory (GEN-88).
 */
export function vehicleDetailHref(id: string, fromPathname: string): string {
  return `/vehicles/${id}?from=${encodeURIComponent(fromPathname)}`;
}
