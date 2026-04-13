"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OpenOrder } from "@/lib/queries/portfolio";

export function OpenOrderRow({ order }: { order: OpenOrder }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const remaining = order.shares - order.filledShares;

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/markets/${order.marketId}/orders/${order.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{order.market.company.ticker}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
          {order.action} {order.side} · {order.price}¢ limit · {remaining} shares remaining
        </p>
      </div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="shrink-0 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {loading ? "…" : "Cancel"}
      </button>
    </div>
  );
}
