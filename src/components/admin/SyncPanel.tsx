"use client";

import { useState } from "react";

export function SyncPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: string[]; errors: string[] } | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/sync", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data);
    }
  }

  return (
    <div>
      <h2 className="text-sm font-medium mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
        FMP Data Sync
      </h2>

      <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
        Refreshes stock prices for all companies from Financial Modeling Prep API.
      </p>

      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
        style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
      >
        {loading ? "Syncing…" : "Run Full Sync"}
      </button>

      {result && (
        <div className="mt-4 space-y-2">
          {result.updated.length > 0 && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ade80" }}
            >
              Updated {result.updated.length} companies: {result.updated.join(", ")}
            </div>
          )}
          {result.errors.length > 0 && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: "rgba(248,113,113,0.1)", color: "#f87171" }}
            >
              Errors for: {result.errors.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
