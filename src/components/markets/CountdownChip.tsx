import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";

interface CountdownChipProps {
  days: number;
  className?: string;
}

export function CountdownChip({ days, className }: CountdownChipProps) {
  const urgent = days <= 3;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium tabular",
        urgent
          ? "bg-[rgba(245,166,35,0.12)] text-[#F5A623]"
          : "bg-white/5 text-white/60",
        className
      )}
    >
      <Clock className="h-3 w-3 shrink-0" />
      {days === 0 ? "Today" : `${days}d`}
    </span>
  );
}
