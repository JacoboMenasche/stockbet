import { cn } from "@/lib/cn";

interface YesNoPriceProps {
  yesPrice: number;  // cents 1–99
  noPrice: number;
  className?: string;
}

export function YesNoPrice({ yesPrice, noPrice, className }: YesNoPriceProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold tabular"
        style={{
          backgroundColor: "rgba(120, 190, 105, 0.15)",
          color: "rgba(140, 210, 120, 0.95)",
          border: "1px solid rgba(120, 190, 105, 0.25)",
        }}
      >
        YES <span className="font-bold">{yesPrice}¢</span>
      </div>
      <div
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold tabular"
        style={{
          backgroundColor: "rgba(190, 70, 55, 0.15)",
          color: "rgba(210, 90, 75, 0.95)",
          border: "1px solid rgba(190, 70, 55, 0.25)",
        }}
      >
        NO <span className="font-bold">{noPrice}¢</span>
      </div>
    </div>
  );
}
