"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";

type Tab = "BUY_YES" | "SELL_YES" | "BUY_NO";
type OrderType = "MARKET" | "LIMIT";

interface TradePanelProps {
  marketId: string;
  isOpen: boolean;
  bestAsk: number;  // current best ask (cost estimate for market buy)
  bestBid: number;  // current best bid (proceeds estimate for market sell)
}

export function TradePanel({ marketId, isOpen, bestAsk, bestBid }: TradePanelProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("BUY_YES");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [shares, setShares] = useState(100);
  const [limitPrice, setLimitPrice] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isBuy = tab === "BUY_YES" || tab === "BUY_NO";
  const side: "YES" | "NO" = tab === "BUY_NO" ? "NO" : "YES";
  const action: "BUY" | "SELL" = tab === "SELL_YES" ? "SELL" : "BUY";

  const estimatedPrice = orderType === "LIMIT" ? limitPrice : (isBuy ? bestAsk : bestBid);
  const estimatedTotal = estimatedPrice * shares;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const endpoint = action === "BUY"
      ? `/api/markets/${marketId}/buy`
      : `/api/markets/${marketId}/sell`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side,
          action,
          orderType,
          shares,
          ...(orderType === "LIMIT" ? { price: limitPrice } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Order failed");
        return;
      }

      const verb = action === "BUY" ? "Bought" : "Sold";
      if (data.filledShares > 0) {
        setSuccessMsg(
          `${verb} ${data.filledShares} ${side} @ avg ${data.avgFillPrice}¢. ` +
          `New price: ${data.newYesPrice}¢ YES`
        );
      } else {
        setSuccessMsg(`Limit order placed at ${limitPrice}¢ — waiting for a match.`);
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const tabConfig: { key: Tab; label: string; color: string; bg: string }[] = [
    { key: "BUY_YES", label: "Buy YES", color: "var(--color-yes)", bg: "rgba(0,194,168,0.15)" },
    { key: "SELL_YES", label: "Sell YES", color: "var(--color-no)", bg: "rgba(245,166,35,0.15)" },
    { key: "BUY_NO", label: "Buy NO", color: "var(--color-no)", bg: "rgba(245,166,35,0.15)" },
  ];

  const activeTab = tabConfig.find((t) => t.key === tab)!;

  return (
    <div
      className="rounded-xl border p-6"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <p className="text-xs uppercase tracking-wider mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
        Trade
      </p>

      {/* Tab selector */}
      <div className="flex rounded-lg p-1 mb-4 gap-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        {tabConfig.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setError(null); setSuccessMsg(null); }}
            className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
            style={
              tab === t.key
                ? { backgroundColor: t.bg, color: t.color }
                : { color: "rgba(255,255,255,0.4)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Market / Limit toggle */}
      <div className="flex gap-2 mb-4">
        {(["MARKET", "LIMIT"] as const).map((ot) => (
          <button
            key={ot}
            type="button"
            onClick={() => setOrderType(ot)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={
              orderType === ot
                ? { backgroundColor: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }
                : { backgroundColor: "transparent", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }
            }
          >
            {ot}
          </button>
        ))}
      </div>

      {/* Shares */}
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Shares
        </label>
        <input
          type="number"
          min={1}
          value={shares}
          onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>

      {/* Limit price (only shown for limit orders) */}
      {orderType === "LIMIT" && (
        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Limit Price (¢)
          </label>
          <input
            type="number"
            min={1}
            max={99}
            value={limitPrice}
            onChange={(e) => setLimitPrice(Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>
      )}

      {/* Estimate */}
      <div className="rounded-lg p-3 mb-4 space-y-1.5" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
        <div className="flex justify-between text-xs">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>
            {isBuy ? "Est. cost" : "Est. proceeds"}
          </span>
          <span className="text-white tabular">{formatCents(estimatedTotal)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Payout if correct</span>
          <span className="text-white tabular">{formatCents(shares * 100)}</span>
        </div>
        {orderType === "MARKET" && (
          <div className="flex justify-between text-xs">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Fills at</span>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              {isBuy ? `best ask (${bestAsk}¢)` : `best bid (${bestBid}¢)`}
            </span>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isOpen || loading}
        className="w-full py-3 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
        style={{ backgroundColor: activeTab.bg, color: activeTab.color, border: `1px solid ${activeTab.color}33` }}
      >
        {loading
          ? "Placing order…"
          : !isOpen
          ? "Market closed"
          : orderType === "MARKET"
          ? `${activeTab.label} — ${shares} shares`
          : `Place limit ${action} at ${limitPrice}¢`}
      </button>

      {error && <p className="text-xs mt-3" style={{ color: "var(--color-no)" }}>{error}</p>}
      {successMsg && <p className="text-xs mt-3" style={{ color: "var(--color-yes)" }}>{successMsg}</p>}
    </div>
  );
}
