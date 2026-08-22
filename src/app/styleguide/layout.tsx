import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = {
  title: "Styleguide · Genaro",
  description:
    "The Genaro design system: colour tokens, type scale, spacing, the six rules and every component at the size it is used at.",
};

export default function StyleguideLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
