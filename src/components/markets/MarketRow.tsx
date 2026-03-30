"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { CountdownChip } from "./CountdownChip";
import { ContractLine, ContractLineProps } from "./ContractLine";
import { formatVolume, formatDate, daysUntil } from "@/lib/format";

export interface MarketRowProps {
  ticker: string;
  companyName: string;
  reportDate: Date;
  totalVolume: bigint | number;
  contracts: ContractLineProps[];
  defaultExpanded?: boolean;
}

export function MarketRow({
  ticker,
  companyName,
  reportDate,
  totalVolume,
  contracts,
  defaultExpanded = false,
}: MarketRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const days = daysUntil(reportDate);

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        expanded
          ? "border-white/10 bg-white/[0.03]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]"
      )}
    >
      {/* Company header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* Ticker + name */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {/* Ticker badge */}
          <span
            className="inline-flex items-center justify-center h-8 w-14 rounded-md text-xs font-semibold tracking-wider shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}
          >
            {ticker}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{companyName}</p>
            <p className="text-2xs text-white/35 mt-0.5">
              Reports {formatDate(reportDate)} ·{" "}
              <span>{contracts.length} {contracts.length === 1 ? "contract" : "contracts"} available</span>
            </p>
          </div>
        </div>

        {/* Countdown */}
        <CountdownChip days={days} />

        {/* Volume */}
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-sm tabular text-white/70 font-medium">
            {formatVolume(totalVolume)}
          </p>
          <p className="text-2xs text-white/30">Total volume</p>
        </div>

        {/* Chevron */}
        <ChevronRight
          className={cn(
            "h-4 w-4 text-white/30 shrink-0 transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />
      </button>

      {/* Contracts list */}
      {expanded && (
        <div
          className="border-t px-1 pb-2"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {/* Column headers */}
          <div className="flex items-center gap-4 px-4 py-2">
            <span className="flex-1 text-2xs text-white/25 uppercase tracking-wider">
              Contract
            </span>
            <span className="w-20 text-2xs text-white/25 uppercase tracking-wider">
              Trend
            </span>
            <span className="w-28 text-2xs text-white/25 uppercase tracking-wider">
              Price
            </span>
            <span className="w-20 text-right text-2xs text-white/25 uppercase tracking-wider">
              Volume
            </span>
            <span className="w-4" />
          </div>
          {contracts.map((c) => (
            <ContractLine key={c.marketId} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}
