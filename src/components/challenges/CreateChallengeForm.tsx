"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OpenMarket {
  id: string;
  question: string;
  company: { ticker: string };
}

interface CreateChallengeFormProps {
  openMarkets: OpenMarket[];
  isAdmin: boolean;
}

export function CreateChallengeForm({ openMarkets, isAdmin }: CreateChallengeFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(new Set());
  const [entryFeeCents, setEntryFeeCents] = useState(0);
  const [payoutType, setPayoutType] = useState<"WINNER_TAKES_ALL" | "TOP_THREE_SPLIT">("WINNER_TAKES_ALL");
  const [asAdmin, setAsAdmin] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [scoringMode, setScoringMode] = useState<"PICKS" | "TRADING_PNL">("PICKS");
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleMarket(id: string) {
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!title.trim()) return alert("Title is required");
    if (selectedMarkets.size === 0) return alert("Select at least one market");
    setLoading(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          marketIds: Array.from(selectedMarkets),
          entryFeeCents,
          payoutType,
          isAdmin: asAdmin,
          isPublic: asAdmin ? true : isPublic,
          scoringMode,
          startDate: scoringMode === "TRADING_PNL" && startDate ? startDate : null,
        }),
      });
      if (res.ok) {
        const { slug } = await res.json();
        router.push(`/challenges/${slug}`);
      } else {
        let message = "Failed to create challenge";
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {}
        alert(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Challenge Title
        </label>
        <input
          type="text"
          placeholder="e.g. Big Tech Thursday"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Select Markets ({selectedMarkets.size} selected)
        </label>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {openMarkets.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMarket(m.id)}
              className="w-full text-left rounded-lg px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: selectedMarkets.has(m.id) ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                border: selectedMarkets.has(m.id) ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.06)",
                color: selectedMarkets.has(m.id) ? "#a78bfa" : "rgba(255,255,255,0.6)",
              }}
            >
              <span className="font-medium mr-2">{m.company.ticker}</span>
              {m.question}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Entry Fee (¢)
          </label>
          <input
            type="number"
            min={0}
            value={entryFeeCents}
            onChange={(e) => setEntryFeeCents(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Payout Type
          </label>
          <select
            value={payoutType}
            onChange={(e) => setPayoutType(e.target.value as "WINNER_TAKES_ALL" | "TOP_THREE_SPLIT")}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={inputStyle}
          >
            <option value="WINNER_TAKES_ALL" style={{ backgroundColor: "#1a1a2e" }}>Winner takes all</option>
            <option value="TOP_THREE_SPLIT" style={{ backgroundColor: "#1a1a2e" }}>Top 3 split (60/30/10)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Scoring Mode
        </label>
        <select
          value={scoringMode}
          onChange={(e) => setScoringMode(e.target.value as "PICKS" | "TRADING_PNL")}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={inputStyle}
        >
          <option value="PICKS" style={{ backgroundColor: "#1a1a2e" }}>Picks (YES / NO)</option>
          <option value="TRADING_PNL" style={{ backgroundColor: "#1a1a2e" }}>Trading P&amp;L</option>
        </select>
      </div>

      {scoringMode === "TRADING_PNL" && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Start Date (optional — for multi-day challenges)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={inputStyle}
          />
        </div>
      )}

      {!asAdmin && (
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            Visibility
          </label>
          <div className="flex gap-3">
            {(["private", "public"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setIsPublic(v === "public")}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: (isPublic ? v === "public" : v === "private")
                    ? "rgba(167,139,250,0.15)"
                    : "rgba(255,255,255,0.04)",
                  border: (isPublic ? v === "public" : v === "private")
                    ? "1px solid rgba(167,139,250,0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
                  color: (isPublic ? v === "public" : v === "private")
                    ? "#a78bfa"
                    : "rgba(255,255,255,0.4)",
                }}
              >
                {v === "private" ? "Private (invite link)" : "Public (anyone can join)"}
              </button>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={asAdmin}
            onChange={(e) => setAsAdmin(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs" style={{ color: "rgba(167,139,250,0.8)" }}>
            Create as Featured challenge (admin only — always public)
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
        style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
      >
        {loading ? "Creating..." : "Create Challenge"}
      </button>
    </div>
  );
}
