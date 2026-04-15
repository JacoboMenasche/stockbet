"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { CountdownChip } from "./CountdownChip";
import { ContractLine, ContractLineProps } from "./ContractLine";
import { CompanyWatchlistButton } from "@/components/company/CompanyWatchlistButton";
import { formatVolume, formatDate, daysUntil } from "@/lib/format";

export interface MarketRowProps {
  ticker: string;
  companyName: string;
  reportDate: Date;
  totalVolume: bigint | number;
  contracts: ContractLineProps[];
  defaultExpanded?: boolean;
  companyId?: string;
  initialCompanyBookmarked?: boolean;
}

export function MarketRow({
  ticker,
  companyName,
  reportDate,
  totalVolume,
  contracts,
  defaultExpanded = false,
  companyId,
  initialCompanyBookmarked = false,
}: MarketRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const days = daysUntil(reportDate);

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors overflow-hidden",
        expanded
          ? "border-white/15 bg-white/[0.04]"
          : "border-white/[0.08] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]"
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
          <Link
            href={`/company/${ticker}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center h-8 w-14 rounded-md text-xs font-semibold tracking-wider shrink-0 hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "var(--color-brand-surface-strong)", color: "var(--color-text-muted)" }}
          >
            {ticker}
          </Link>
          <div className="min-w-0">
            <Link
              href={`/company/${ticker}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-white truncate hover:opacity-70 transition-opacity"
            >
              {companyName}
            </Link>
              <p className="text-2xs text-white/40 mt-0.5">
                {formatDate(reportDate)} ·{" "}
                <span>{contracts.length} {contracts.length === 1 ? "contract" : "contracts"}</span>
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

        {/* Company watchlist button */}
        {companyId && (
          <div onClick={(e) => e.stopPropagation()}>
            <CompanyWatchlistButton
              companyId={companyId}
              initialBookmarked={initialCompanyBookmarked}
            />
          </div>
        )}

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
          style={{ borderColor: "var(--color-border)" }}
        >
          {/* Column headers */}
          <div className="flex items-center gap-4 px-4 py-2.5">
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
