"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { daysUntil } from "@/lib/format";
import type { WatchlistItem } from "@/lib/queries/portfolio";

interface WatchlistTableProps {
  initialItems: WatchlistItem[];
}

export function WatchlistTable({ initialItems }: WatchlistTableProps) {
  const [items, setItems] = useState(initialItems);

  async function handleRemove(marketId: string) {
    setItems((prev) => prev.filter((i) => i.marketId !== marketId));
    await fetch(`/api/watchlist/${marketId}`, { method: "DELETE" });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No bookmarks yet. Add markets from the market detail page.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["Market", "Ticker", "YES", "NO", "Days left", ""].map((h, i) => (
              <th
                key={i}
                className="pb-3 text-left font-normal"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <td className="py-3 pr-4">
                <Link
                  href={`/markets/${item.marketId}`}
                  className="text-white hover:underline line-clamp-2 max-w-xs block"
                >
                  {item.market.question}
                </Link>
              </td>
              <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                {item.market.company.ticker}
              </td>
              <td className="py-3 pr-4 tabular font-medium" style={{ color: "var(--color-yes)" }}>
                {item.market.yesPriceLatest}¢
              </td>
              <td className="py-3 pr-4 tabular font-medium" style={{ color: "var(--color-no)" }}>
                {item.market.noPriceLatest}¢
              </td>
              <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                {daysUntil(item.market.earningsEvent.reportDate)}d
              </td>
              <td className="py-3">
                <button
                  type="button"
                  onClick={() => handleRemove(item.marketId)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
