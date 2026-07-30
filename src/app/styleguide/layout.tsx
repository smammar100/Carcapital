import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = {
  title: "Styleguide · Car Capital UK",
  description:
    "The design system: colour tokens, type scale, surfaces and every UI component in its real states.",
};

export default function StyleguideLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
