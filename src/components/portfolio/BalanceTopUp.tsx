"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Wallet, Plus } from "lucide-react";
import { formatCents } from "@/lib/format";

interface BalanceTopUpProps {
  initialCashBalanceCents: number;
  initialNextTopUpAt: string | null;
}

function useCountdown(target: Date | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;

    function tick() {
      const ms = target!.getTime() - Date.now();
      if (ms <= 0) {
        setLabel(null);
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(`Available in ${h}h ${m}m`);
    }

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [target]);

  return label;
}

export function BalanceTopUp({
  initialCashBalanceCents,
  initialNextTopUpAt,
}: BalanceTopUpProps) {
  const { update } = useSession();
  const [balance, setBalance] = useState(initialCashBalanceCents);
  const [nextTopUpAt, setNextTopUpAt] = useState<Date | null>(
    initialNextTopUpAt ? new Date(initialNextTopUpAt) : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countdown = useCountdown(nextTopUpAt);

  async function handleTopUp() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/balance/topup", { method: "POST" });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      if (res.status === 429 && data.nextTopUpAt) {
        setNextTopUpAt(new Date(data.nextTopUpAt));
      } else {
        setError(data.error ?? "Something went wrong.");
      }
      return;
    }

    setBalance(data.cashBalanceCents);
    setNextTopUpAt(new Date(data.nextTopUpAt));
    await update({ cashBalanceCents: data.cashBalanceCents });
  }

  const canTopUp = !countdown && !loading;

  return (
    <div
      className="rounded-xl border p-6 mb-6"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <p
        className="text-xs uppercase tracking-wider mb-3"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        Play money balance
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(0,194,168,0.1)" }}
          >
            <Wallet className="h-5 w-5" style={{ color: "var(--color-yes)" }} />
          </div>
          <span
            className="text-2xl font-semibold tabular"
            style={{ color: "var(--color-yes)" }}
          >
            {formatCents(balance)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleTopUp}
          disabled={!canTopUp}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
          style={{
            backgroundColor: canTopUp
              ? "rgba(0,194,168,0.15)"
              : "rgba(255,255,255,0.05)",
            color: canTopUp ? "var(--color-yes)" : "rgba(255,255,255,0.35)",
            border: `1px solid ${canTopUp ? "rgba(0,194,168,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {loading ? (
            "Adding…"
          ) : countdown ? (
            countdown
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add $1,000
            </>
          )}
        </button>
      </div>

      {error && (
        <p
          className="text-xs mt-3"
          style={{ color: "var(--color-no)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
