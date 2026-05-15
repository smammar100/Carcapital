"use client";

import { ArrowLeft, ClipboardList, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Customer } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StepActionsProps {
  /** Null = the user chose Create-new on the previous step. */
  selectedCustomer: Customer | null;
  onPickQuick: () => void;
  onPickFull: () => void;
  onBack: () => void;
}

/**
 * The "Quick vs. Full" choice surface, shown after a customer is selected
 * (or after Create-new is chosen). Two big cards — the same two-card
 * pattern used by the warranty dialog's type selector. Quick is the
 * recommended path (left card, accent border on hover); Full is for
 * when the user has time to capture the full profile.
 */
export function StepActions({
  selectedCustomer,
  onPickQuick,
  onPickFull,
  onBack,
}: StepActionsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md bg-primary/5 px-3 py-2 text-sm">
        {selectedCustomer ? (
          <>
            <span className="text-muted-foreground">Continuing for: </span>
            <span className="font-medium">
              {selectedCustomer.firstName} {selectedCustomer.lastName}
            </span>
            {selectedCustomer.mobilePhone && (
              <span className="ml-2 text-xs text-muted-foreground">
                {selectedCustomer.mobilePhone}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Continuing as: </span>
            <span className="font-medium">New customer</span>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          icon={Zap}
          title="Quick"
          subtitle="≈ 30 seconds"
          description="Just the essentials — name, contact, source, type. Use for hot leads where you need to dial out fast."
          onClick={onPickQuick}
          accent="primary"
        />
        <ActionCard
          icon={ClipboardList}
          title="Full"
          subtitle="≈ 2 minutes"
          description="Capture the full customer profile with address, marketing preferences, and finance interest."
          onClick={onPickFull}
          accent="muted"
        />
      </div>

      <div>
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to search
        </Button>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  subtitle,
  description,
  onClick,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  description: string;
  onClick: () => void;
  accent: "primary" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border p-4 text-left transition-colors",
        accent === "primary"
          ? "border-border hover:border-primary hover:bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            accent === "primary" ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">· {subtitle}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}
