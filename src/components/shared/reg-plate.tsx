import { cn } from "@/lib/utils";
import { formatRegPlate } from "@/lib/utils";

interface Props {
  registration: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RegPlate({ registration, size = "md", className }: Props) {
  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] tracking-[0.08em]"
      : size === "lg"
        ? "px-3 py-1.5 text-base tracking-[0.12em]"
        : "px-2.5 py-1 text-xs tracking-[0.1em]";
  return (
    <span
      className={cn(
        "inline-block rounded-[3px] border border-yellow-700/40 bg-[#FFD400] font-mono font-bold uppercase text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]",
        sizeClasses,
        className,
      )}
    >
      {formatRegPlate(registration)}
    </span>
  );
}
