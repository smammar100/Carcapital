"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  changeCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function PermissionsGridSaveBar({
  changeCount,
  saving,
  onSave,
  onDiscard,
}: Props) {
  if (changeCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${changeCount} unsaved permission changes`}
      className="sticky bottom-4 z-10 mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-2.5 shadow-lg"
      data-testid="permissions-save-bar"
    >
      <span className="text-sm font-medium tabular-nums">
        {changeCount} unsaved change{changeCount === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onDiscard}
          disabled={saving}
          data-testid="permissions-discard"
        >
          Discard
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
          data-testid="permissions-save"
        >
          {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
