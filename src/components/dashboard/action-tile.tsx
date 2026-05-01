"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface ActionTileProps {
  label: string;
  href: string;
  icon: ReactNode;
  description: string;
}

export function ActionTile({
  label,
  href,
  icon,
  description,
}: ActionTileProps) {
  return (
    <Card className="overflow-hidden p-0 transition-colors hover:border-primary/50">
      <Link href={href} className="flex h-full flex-col gap-3 p-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </div>
        </div>
        <div className="flex items-center text-xs font-medium text-primary">
          Open
          <ArrowRight className="ml-1 h-3 w-3" />
        </div>
      </Link>
    </Card>
  );
}
