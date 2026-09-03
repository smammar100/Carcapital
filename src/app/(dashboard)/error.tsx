"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  // Next 16.2 renamed the recovery prop reset → unstable_retry (re-fetches
  // + re-renders the segment, not just a state reset).
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-600">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-base font-semibold">Something went wrong</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => unstable_retry()}>
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Reload page
        </Button>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
