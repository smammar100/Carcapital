import { redirect } from "next/navigation";

/**
 * The warranty module split into In-House / External / Claims tabs.
 * `/warranties` itself just redirects to the default landing page.
 */
export default function WarrantiesPage() {
  redirect("/warranties/in-house");
}
