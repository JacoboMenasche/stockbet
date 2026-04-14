"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";

const StockChart = dynamic(
  () => import("./StockChart").then((mod) => mod.StockChart),
  { ssr: false }
);

type Range = "1W" | "1M" | "3M" | "YTD" | "1Y";

const RANGES: Range[] = ["1W", "1M", "3M", "YTD", "1Y"];

const RANGE_DAYS: Record<Range, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "YTD": 366,
  "1Y": 365,
};

function filterToRange(
  data: { date: string; close: number }[],
  range: Range
): { date: string; close: number }[] {
  if (range === "YTD") {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    return data.filter((d) => d.date >= yearStart);
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

function canDerive(cached: Range, requested: Range): boolean {
  if (cached === requested) return true;
  if (cached === "1Y") return true;
  if (cached === "YTD" && RANGE_DAYS[requested] <= RANGE_DAYS["YTD"]) return true;
  if (cached === "3M" && (requested === "1M" || requested === "1W")) return true;
  if (cached === "1M" && requested === "1W") return true;
  return false;
}

interface StockChartWithRangesProps {
  ticker: string;
}

export function StockChartWithRanges({ ticker }: StockChartWithRangesProps) {
  const [activeRange, setActiveRange] = useState<Range>("1M");
  const [data, setData] = useState<{ date: string; close: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [cache] = useState(() => new Map<Range, { date: string; close: number }[]>());

  const fetchRange = useCallback(
    async (range: Range) => {
      // Check if we have exact cache hit
      if (cache.has(range)) {
        setData(cache.get(range)!);
        return;
      }

      // Check if a larger cached range can derive the requested range
      for (const [cachedRange, cachedData] of cache.entries()) {
        if (canDerive(cachedRange, range)) {
          const filtered = filterToRange(cachedData, range);
          cache.set(range, filtered);
          setData(filtered);
          return;
        }
      }

      // Fetch from API
      setLoading(true);
      try {
        const res = await fetch(`/api/stock-prices/${ticker}?range=${range}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        const prices = json.prices as { date: string; close: number }[];
        cache.set(range, prices);
        setData(prices);
      } catch {
        // Keep current data on error
      }
      setLoading(false);
    },
    [ticker, cache]
  );

  // Fetch default range on mount
  useEffect(() => {
    fetchRange("1M");
  }, [fetchRange]);

  function switchRange(range: Range) {
    setActiveRange(range);
    fetchRange(range);
  }

  return (
    <div>
      {/* Range toggles */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => switchRange(r)}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
            style={{
              backgroundColor:
                activeRange === r
                  ? "rgba(167,139,250,0.2)"
                  : "rgba(255,255,255,0.04)",
              color:
                activeRange === r
                  ? "#a78bfa"
                  : "rgba(255,255,255,0.4)",
              border:
                activeRange === r
                  ? "1px solid rgba(167,139,250,0.3)"
                  : "1px solid rgba(255,255,255,0.09)",
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Chart */}
      <StockChart data={data} ticker={ticker} />
    </div>
  );
}
