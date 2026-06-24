import { redirect } from "next/navigation";

// The standalone Listings page was merged into the Work List — it only showed
// a read-only subset (live adverts) that the Work List already covers via its
// status filter and advert preview. Kept as a redirect so old links/bookmarks
// still resolve.
export default function ListingsPage() {
  redirect("/advert/work-list");
}
