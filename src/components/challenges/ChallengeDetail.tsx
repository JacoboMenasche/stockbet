"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeDetailData } from "@/lib/queries/challenges";

interface ChallengeDetailProps {
  data: NonNullable<ChallengeDetailData>;
  userId?: string;
}

export function ChallengeDetail({ data, userId }: ChallengeDetailProps) {
  const { challenge, userEntry } = data;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<Record<string, "YES" | "NO">>(() => {
    const initial: Record<string, "YES" | "NO"> = {};
    if (userEntry) {
      for (const p of userEntry.picks) {
        initial[p.marketId] = p.side as "YES" | "NO";
      }
    }
    return initial;
  });

  const isOpen = challenge.status === "OPEN";
  const hasJoined = !!userEntry;

  async function handleJoin() {
    setLoading(true);
    try {
      const res = await fetch(`/api/challenges/${challenge.inviteSlug}/join`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        let message = "Failed to join";
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

  async function handleSubmitPicks() {
    const pickList = Object.entries(picks).map(([marketId, side]) => ({ marketId, side }));
    if (pickList.length === 0) return alert("Select at least one pick");
    setLoading(true);
    try {
      const res = await fetch(`/api/challenges/${challenge.inviteSlug}/picks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: pickList }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        let message = "Failed to submit picks";
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

  return (
    <div className="space-y-6">
      {/* Markets + picks — only shown for PICKS mode */}
      {isOpen && hasJoined && challenge.scoringMode !== "TRADING_PNL" && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <h2 className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            Your Picks
          </h2>
          <div className="space-y-2">
            {challenge.markets.map(({ market }) => (
              <div key={market.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-white flex-1 min-w-0 truncate">{market.question}</span>
                <div className="flex gap-2 shrink-0">
                  {(["YES", "NO"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [market.id]: side }))}
                      className="px-3 py-1 rounded text-xs font-medium transition-all"
                      style={{
                        backgroundColor:
                          picks[market.id] === side
                            ? side === "YES" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"
                            : "rgba(255,255,255,0.06)",
                        color:
                          picks[market.id] === side
                            ? side === "YES" ? "#4ade80" : "#f87171"
                            : "rgba(255,255,255,0.4)",
                        border:
                          picks[market.id] === side
                            ? side === "YES" ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(248,113,113,0.3)"
                            : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSubmitPicks}
            disabled={loading}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
          >
            {loading ? "Saving..." : "Save Picks"}
          </button>
        </div>
      )}

      {isOpen && challenge.scoringMode === "TRADING_PNL" && hasJoined && (
        <div
          className="rounded-xl border p-4 text-sm"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
        >
          You&apos;ve joined. Place trades on the challenge markets — your realized P&amp;L will be your score at resolution.
        </div>
      )}

      {isOpen && !hasJoined && userId && (
        <button
          type="button"
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-medium disabled:opacity-40"
          style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
        >
          {loading
            ? "Joining..."
            : challenge.entryFeeCents > 0
            ? `Join for ${challenge.entryFeeCents}¢`
            : "Join (free)"}
        </button>
      )}

      {/* Leaderboard */}
      <div>
        <h2 className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
          Leaderboard · {challenge.entries.length} player{challenge.entries.length !== 1 ? "s" : ""}
        </h2>
        {challenge.entries.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            No one has joined yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {(["#", "Player", challenge.scoringMode === "TRADING_PNL" ? "P&L" : "Score", "Payout"] as const).map((h, i) => (
                  <th key={i} className="pb-2 text-left font-normal text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {challenge.entries.map((entry, i) => {
                const isMe = entry.userId === userId;
                return (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <td className="py-2 pr-3 text-xs tabular" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {entry.rank ?? i + 1}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-white" style={isMe ? { color: "#a78bfa" } : {}}>
                        {entry.user.username ?? entry.user.displayName ?? "anon"}
                        {isMe && " (you)"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {challenge.scoringMode === "TRADING_PNL"
                        ? challenge.status === "RESOLVED"
                          ? entry.score >= 0
                            ? `+$${(entry.score / 100).toFixed(2)}`
                            : `-$${Math.abs(entry.score / 100).toFixed(2)}`
                          : "—"
                        : challenge.status === "RESOLVED"
                        ? `${entry.score}/${challenge.markets.length}`
                        : `${entry.picks.length} pick${entry.picks.length !== 1 ? "s" : ""}`}
                    </td>
                    <td className="py-2 tabular" style={{ color: entry.payout > 0 ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                      {entry.payout > 0 ? `+${entry.payout}¢` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
