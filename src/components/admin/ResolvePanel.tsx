"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Market {
  id: string;
  question: string;
  metricType: string;
  thresholdLabel: string;
  yesPriceLatest: number;
  noPriceLatest: number;
  status: string;
  company: { ticker: string; [key: string]: unknown };
  [key: string]: unknown;
}

interface ResolvePanelProps {
  markets: Market[];
}

export function ResolvePanel({ markets }: ResolvePanelProps) {
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actualValue, setActualValue] = useState("");
  const [actualLabel, setActualLabel] = useState("");
  const [winningSide, setWinningSide] = useState<"YES" | "NO">("YES");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleResolve(marketId: string) {
    if (!actualValue || !actualLabel) return;
    setLoading(true);
    setResult(null);
    const res = await fetch(`/api/admin/resolve/${marketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualValue: parseFloat(actualValue),
        actualLabel,
        winningSide,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(`Resolved! ${data.settledPositions} positions settled.`);
      setResolvingId(null);
      setActualValue("");
      setActualLabel("");
      router.refresh();
    } else {
      setResult(`Error: ${data.error}`);
    }
  }

  if (markets.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No markets ready to resolve.
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-medium mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
        Markets to Resolve
      </h2>

      {result && (
        <div
          className="rounded-lg px-4 py-2 mb-4 text-sm"
          style={{
            backgroundColor: result.startsWith("Error") ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
            color: result.startsWith("Error") ? "#f87171" : "#4ade80",
          }}
        >
          {result}
        </div>
      )}

      <div className="space-y-3">
        {markets.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border p-4"
            style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-white font-medium">{m.company.ticker}</span>
                <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {m.metricType} · {m.thresholdLabel}
                </span>
              </div>
              <div className="tabular text-sm">
                <span style={{ color: "var(--color-yes)" }}>{m.yesPriceLatest}¢</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}> / </span>
                <span style={{ color: "var(--color-no)" }}>{m.noPriceLatest}¢</span>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-3">{m.question}</p>

            {resolvingId === m.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Actual value (e.g. 48.5)"
                    value={actualValue}
                    onChange={(e) => setActualValue(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm text-white outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <input
                    type="text"
                    placeholder="Label (e.g. 48.5%)"
                    value={actualLabel}
                    onChange={(e) => setActualLabel(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm text-white outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <select
                    value={winningSide}
                    onChange={(e) => setWinningSide(e.target.value as "YES" | "NO")}
                    className="rounded-lg px-3 py-2 text-sm text-white outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <option value="YES">YES wins</option>
                    <option value="NO">NO wins</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleResolve(m.id)}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
                    style={{ backgroundColor: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
                  >
                    {loading ? "Resolving…" : "Resolve & Pay Out"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolvingId(null)}
                    className="px-4 py-2 rounded-lg text-xs font-medium"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setResolvingId(m.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
              >
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
