"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { daysUntil } from "@/lib/format";
import type { WatchlistGroup } from "@/lib/queries/portfolio";

interface CompanyWatchlistTableProps {
  initialItems: WatchlistGroup[];
}

export function CompanyWatchlistTable({ initialItems }: CompanyWatchlistTableProps) {
  const [items, setItems] = useState(initialItems);

  async function handleRemove(item: WatchlistGroup) {
    const prev = items;
    setItems((current) => current.filter((i) => i.companyId !== item.companyId));
    try {
      if (item.bookmarkType === "company") {
        const res = await fetch(`/api/company-watchlist/${item.companyId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Request failed");
      } else {
        await Promise.all(
          item.markets.map(async (m) => {
            const res = await fetch(`/api/watchlist/${m.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Request failed");
          })
        );
      }
    } catch {
      setItems(prev);
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No watchlist items yet. Watch companies or individual bets to track them here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.companyId}>
          {/* Company header */}
          <div
            className="flex items-center justify-between py-2 mb-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3">
              <Link
                href={`/company/${item.company.ticker}`}
                className="text-white font-medium hover:underline"
              >
                {item.company.name}
              </Link>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {item.company.ticker}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(item)}
              title={`Remove ${item.company.name} from watchlist`}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Markets under this company */}
          {item.markets.length === 0 ? (
            <p className="text-xs py-3 pl-2" style={{ color: "rgba(255,255,255,0.25)" }}>
              No open markets.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {["Market", "YES", "NO", "Days left"].map((h) => (
                    <th
                      key={h}
                      className="pb-2 text-left font-normal text-xs"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.markets.map((m) => (
                  <tr
                    key={m.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <td className="py-2 pr-4">
                      <Link
                        href={`/markets/${m.id}`}
                        className="text-white hover:underline line-clamp-2 max-w-sm block"
                      >
                        {m.question}
                      </Link>
                    </td>
                    <td
                      className="py-2 pr-4 tabular font-medium"
                      style={{ color: "var(--color-yes)" }}
                    >
                      {m.yesPriceLatest}¢
                    </td>
                    <td
                      className="py-2 pr-4 tabular font-medium"
                      style={{ color: "var(--color-no)" }}
                    >
                      {m.noPriceLatest}¢
                    </td>
                    <td className="py-2 tabular" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {daysUntil(m.earningsEvent.reportDate)}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
