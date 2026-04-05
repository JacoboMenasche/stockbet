"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { daysUntil } from "@/lib/format";
import type { CompanyWatchlistItem } from "@/lib/queries/portfolio";

interface WatchlistTableProps {
  initialItems: CompanyWatchlistItem[];
}

export function WatchlistTable({ initialItems }: WatchlistTableProps) {
  const [items, setItems] = useState(initialItems);

  async function handleRemove(companyId: string) {
    setItems((prev) => prev.filter((i) => i.companyId !== companyId));
    await fetch(`/api/company-watchlist/${companyId}`, { method: "DELETE" });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No bookmarks yet. Add companies from the market detail page.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["Company", "Ticker", "Open Markets", "Next Earnings", ""].map((h, i) => (
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
          {items.map((item) => {
            const nextMarket = item.company.markets[0];
            return (
              <tr
                key={item.id}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/companies/${item.companyId}`}
                    className="text-white hover:underline line-clamp-2 max-w-xs block"
                  >
                    {item.company.name}
                  </Link>
                </td>
                <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {item.company.ticker}
                </td>
                <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {item.company.markets.length}
                </td>
                <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {nextMarket?.earningsEvent
                    ? `${daysUntil(nextMarket.earningsEvent.reportDate)}d`
                    : "—"}
                </td>
                <td className="py-3">
                  <button
                    type="button"
                    onClick={() => handleRemove(item.companyId)}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
