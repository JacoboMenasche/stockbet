import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { YesNoPrice } from "./YesNoPrice";
import { formatVolume } from "@/lib/format";

export interface ContractLineProps {
  marketId: string;
  question: string;
  metricLabel: string;       // e.g. "Gross margin"
  thresholdLabel: string;    // e.g. "> 47%"
  yesPrice: number;
  noPrice: number;
  volume24h: bigint | number;
  probabilitySnaps: { probability: number }[];
}

export function ContractLine({
  marketId,
  question,
  metricLabel,
  thresholdLabel,
  yesPrice,
  noPrice,
  volume24h,
  probabilitySnaps,
}: ContractLineProps) {
  return (
    <Link
      href={`/markets/${marketId}`}
      className="group flex items-center gap-4 px-4 py-3 rounded-lg transition-colors hover:bg-white/[0.04] cursor-pointer"
    >
      {/* Question text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">
          {question}
        </p>
        <p className="text-2xs text-white/35 mt-0.5">
          {metricLabel} · {thresholdLabel}
        </p>
      </div>

      {/* Sparkline */}
      <Sparkline data={probabilitySnaps} />

      {/* Yes/No prices */}
      <YesNoPrice yesPrice={yesPrice} noPrice={noPrice} className="shrink-0 w-28" />

      {/* Volume */}
      <div className="text-right shrink-0 w-20">
        <span className="text-sm tabular text-white/50">
          {formatVolume(volume24h)}
        </span>
        <p className="text-2xs text-white/25">vol 24h</p>
      </div>

      {/* Arrow */}
      <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
    </Link>
  );
}
