"use client";

import { useEffect, useState, useCallback } from "react";

interface BookLevel {
  price: number;
  shares: number;
  isPlatform: boolean;
}

interface OrderBookData {
  bids: BookLevel[];
  asks: BookLevel[];
  midPrice: number;
  lastTradePrice: number;
  noPrice: number;
}

interface OrderBookProps {
  marketId: string;
}

export function OrderBook({ marketId }: OrderBookProps) {
  const [book, setBook] = useState<OrderBookData | null>(null);

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/orderbook`);
      if (res.ok) setBook(await res.json());
    } catch {}
  }, [marketId]);

  useEffect(() => {
    fetchBook();
    const id = setInterval(fetchBook, 5000);
    return () => clearInterval(id);
  }, [fetchBook]);

  if (!book) {
    return (
      <div
        className="rounded-xl border p-4 animate-pulse"
        style={{ borderColor: "rgba(255,255,255,0.08)", height: 180 }}
      />
    );
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <p className="text-xs font-medium mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        Order Book
      </p>

      {/* Asks reversed so lowest ask is closest to mid */}
      <div className="space-y-0.5 mb-1">
        {[...book.asks.slice(0, 5)].reverse().map((a) => (
          <div
            key={a.price}
            className="flex justify-between text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "rgba(248,113,113,0.06)" }}
          >
            <span style={{ color: a.isPlatform ? "rgba(248,113,113,0.4)" : "#f87171" }}>
              {a.price}¢
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{a.shares.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Mid price */}
      <div
        className="flex justify-between items-center px-2 py-1.5 my-1 rounded"
        style={{ backgroundColor: "rgba(167,139,250,0.08)" }}
      >
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Mid</span>
        <span className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
          {book.midPrice}¢ YES · {book.noPrice}¢ NO
        </span>
      </div>

      {/* Bids */}
      <div className="space-y-0.5 mt-1">
        {book.bids.slice(0, 5).map((b) => (
          <div
            key={b.price}
            className="flex justify-between text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "rgba(74,222,128,0.06)" }}
          >
            <span style={{ color: b.isPlatform ? "rgba(74,222,128,0.4)" : "#4ade80" }}>
              {b.price}¢
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{b.shares.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
