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
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-medium tabular border",
        urgent
          ? "bg-[rgba(216,72,56,0.12)] text-[#D84838] border-[#d8483840]"
          : "bg-white/5 text-white/60 border-white/10",
        className
      )}
    >
      <Clock className="h-3 w-3 shrink-0" />
      {days === 0 ? "Today" : `${days}d`}
    </span>
  );
}
