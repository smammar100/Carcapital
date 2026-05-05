import { redirect } from "next/navigation";

/**
 * v4.1 spec moved the pipeline to /sales/pipeline. This route stays as a
 * redirect so any external bookmarks or stale links resolve cleanly.
 */
export default function SalesIndexPage(): never {
  redirect("/sales/pipeline");
}
