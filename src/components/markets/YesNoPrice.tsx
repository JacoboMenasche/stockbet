import { cn } from "@/lib/cn";

interface YesNoPriceProps {
  yesPrice: number;  // cents 1–99
  noPrice: number;
  className?: string;
}

/**
 * Compact side-by-side Yes / No price display used in feed rows.
 * "64¢ Yes · 36¢ No"
 */
export function YesNoPrice({ yesPrice, noPrice, className }: YesNoPriceProps) {
  return (
    <div className={cn("flex items-center gap-2 tabular text-sm font-medium", className)}>
      <span className="font-medium" style={{ color: "#00C2A8" }}>
        {yesPrice}¢
      </span>
      <span className="text-white/25 text-xs">Yes</span>
      <span className="text-white/15">·</span>
      <span className="font-medium" style={{ color: "#F5A623" }}>
        {noPrice}¢
      </span>
      <span className="text-white/25 text-xs">No</span>
    </div>
  );
}
