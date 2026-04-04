"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ammCost, ammNewPrices } from "@/lib/amm";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/cn";

interface BuyPanelProps {
  marketId: string;
  initialYesPrice: number;
  initialNoPrice: number;
  isOpen: boolean;
}

export function BuyPanel({
  marketId,
  initialYesPrice,
  initialNoPrice,
  isOpen,
}: BuyPanelProps) {
  const { update } = useSession();
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [shares, setShares] = useState(100);
  const [yesPrice, setYesPrice] = useState(initialYesPrice);
  const [noPrice, setNoPrice] = useState(initialNoPrice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentPrice = side === "YES" ? yesPrice : noPrice;
  const cost = ammCost(shares, currentPrice);
  const newPrices = ammNewPrices(shares, yesPrice, side);
  const newPrice = side === "YES" ? newPrices.yesPriceLatest : newPrices.noPriceLatest;
  const payout = shares * 100; // cents

  async function handleBuy() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res = await fetch(`/api/markets/${marketId}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, shares }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setYesPrice(data.yesPriceLatest);
    setNoPrice(data.noPriceLatest);
    await update({ cashBalanceCents: data.cashBalanceCents });
    setSuccessMsg(
      `Bought ${shares} ${side} shares for ${formatCents(cost)}. New price: ${data.yesPriceLatest}¢ Yes / ${data.noPriceLatest}¢ No.`
    );
  }

  return (
    <div
      className="rounded-xl border p-6"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <p
        className="text-xs uppercase tracking-wider mb-4"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        Place bet
      </p>

      {/* YES / NO toggle */}
      <div
        className="flex rounded-lg p-1 mb-5 gap-1"
        style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      >
        {(["YES", "NO"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-all",
              side === s
                ? s === "YES"
                  ? "text-white"
                  : "text-white"
                : "text-white/40 hover:text-white/70"
            )}
            style={
              side === s
                ? {
                    backgroundColor:
                      s === "YES" ? "rgba(0,194,168,0.2)" : "rgba(245,166,35,0.2)",
                    color: s === "YES" ? "var(--color-yes)" : "var(--color-no)",
                  }
                : undefined
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* Shares input */}
      <div className="mb-5">
        <label
          className="block text-xs mb-2"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Shares (min 10)
        </label>
        <input
          type="number"
          min={10}
          step={10}
          value={shares}
          onChange={(e) => setShares(Math.max(10, parseInt(e.target.value) || 10))}
          className="w-full rounded-lg px-3 py-2 text-sm text-white tabular outline-none focus:ring-1"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        />
      </div>

      {/* Live preview */}
      <div
        className="rounded-lg p-4 mb-5 space-y-2"
        style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
      >
        <div className="flex justify-between text-sm">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Cost</span>
          <span className="font-medium text-white tabular">{formatCents(cost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>New price</span>
          <span
            className="font-medium tabular"
            style={{ color: side === "YES" ? "var(--color-yes)" : "var(--color-no)" }}
          >
            {newPrice}¢
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Payout if correct</span>
          <span className="font-medium text-white tabular">{formatCents(payout)}</span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleBuy}
        disabled={!isOpen || loading}
        className="w-full py-3 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
        style={{
          backgroundColor:
            side === "YES" ? "rgba(0,194,168,0.15)" : "rgba(245,166,35,0.15)",
          color: side === "YES" ? "var(--color-yes)" : "var(--color-no)",
          border: `1px solid ${side === "YES" ? "rgba(0,194,168,0.3)" : "rgba(245,166,35,0.3)"}`,
        }}
      >
        {loading ? "Placing bet…" : isOpen ? `Buy ${side}` : "Market closed"}
      </button>

      {error && (
        <p className="text-xs mt-3" style={{ color: "var(--color-no)" }}>
          {error}
        </p>
      )}
      {successMsg && (
        <p className="text-xs mt-3" style={{ color: "var(--color-yes)" }}>
          {successMsg}
        </p>
      )}
    </div>
  );
}
