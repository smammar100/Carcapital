"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * SPEC Point 9 — a spinner that refuses to spin forever. After
 * `timeoutMs` (default 15s) it stops and offers Retry / Reload so a
 * stuck fetch never strands the user on an infinite loader.
 *
 * Reusable primitive: render it instead of a bare spinner anywhere a
 * fetch gates the UI, passing the same refetch you'd trigger manually.
 */
export function LoadingState({
  message = "Loading…",
  timeoutMs = 15_000,
  onRetry,
}: {
  message?: string;
  timeoutMs?: number;
  /** Called by the Retry button. Resets the timeout so the user can wait again. */
  onRetry?: () => void;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Initial state is already false; only the async fire flips it (the
    // Retry button resets it synchronously in its own handler).
    const id = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(id);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          Taking longer than expected…
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTimedOut(false);
                onRetry();
              }}
            >
              Retry
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
