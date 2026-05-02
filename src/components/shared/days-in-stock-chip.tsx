import { cn } from "@/lib/utils";
import { getDaysInStockColor } from "@/lib/utils";

interface Props {
  days: number;
  className?: string;
}

export function DaysInStockChip({ days, className }: Props) {
  const tone = getDaysInStockColor(days);
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-9 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
        tone === "green" &&
          "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
        tone === "amber" &&
          "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
        tone === "red" &&
          "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
        className,
      )}
      title={`${days} days in stock`}
    >
      {days}d
    </span>
  );
}
