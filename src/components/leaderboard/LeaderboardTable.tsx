"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/queries/leaderboard";

interface Props {
  rows: LeaderboardRow[];
  window: "all" | "30d";
}

export function LeaderboardTable({ rows, window }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setWindow(w: "all" | "30d") {
    const params = new URLSearchParams(searchParams.toString());
    if (w === "all") {
      params.delete("window");
    } else {
      params.set("window", w);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/leaderboard?${params.toString()}` as any);
  }

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-2 mb-6">
        {(["all", "30d"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              window === w
                ? "text-white font-medium"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            )}
            style={
              window === w
                ? { backgroundColor: "rgba(255,255,255,0.07)" }
                : undefined
            }
          >
            {w === "all" ? "All time" : "30 days"}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            Not enough data yet — come back once more trades have resolved.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {/* Column headers */}
          <div
            className="grid grid-cols-[3rem_1fr_8rem_8rem_6rem] px-4 py-3 border-b text-xs uppercase tracking-wider"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            <span>#</span>
            <span>Trader</span>
            <span className="text-right">ROI</span>
            <span className="text-right">Total P&amp;L</span>
            <span className="text-right">Trades</span>
          </div>

          {rows.map((row) => (
            <div
              key={row.userId}
              className="grid grid-cols-[3rem_1fr_8rem_8rem_6rem] px-4 py-3 border-b last:border-b-0 items-center"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
            >
              {/* Rank */}
              <span
                className="text-sm tabular font-medium"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {row.rank}
              </span>

              {/* Name */}
              <span className="text-sm text-white truncate">
                {row.displayName ?? "Anonymous"}
              </span>

              {/* ROI */}
              <span
                className="text-sm tabular font-medium text-right"
                style={{
                  color:
                    row.roiPct > 0
                      ? "var(--color-yes)"
                      : row.roiPct < 0
                      ? "var(--color-no)"
                      : "rgba(255,255,255,0.4)",
                }}
              >
                {row.roiPct > 0 ? "+" : ""}
                {row.roiPct.toFixed(1)}%
              </span>

              {/* Total P&L */}
              <span
                className="text-sm tabular text-right"
                style={{
                  color:
                    row.totalRealizedPL > 0
                      ? "var(--color-yes)"
                      : row.totalRealizedPL < 0
                      ? "var(--color-no)"
                      : "rgba(255,255,255,0.4)",
                }}
              >
                {row.totalRealizedPL >= 0 ? "+" : ""}
                {formatCents(row.totalRealizedPL)}
              </span>

              {/* Trade count */}
              <span
                className="text-sm tabular text-right"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {row.positionCount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
