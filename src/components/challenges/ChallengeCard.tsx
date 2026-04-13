import Link from "next/link";
import type { ChallengeListItem } from "@/lib/queries/challenges";

interface ChallengeCardProps {
  challenge: ChallengeListItem;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const isAdmin = challenge.type === "ADMIN";
  const isFree = challenge.entryFeeCents === 0;

  return (
    <div
      className="rounded-xl border p-4 flex items-start justify-between gap-4"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {isAdmin && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
            >
              ⭐ Featured
            </span>
          )}
          <h3 className="text-white font-medium truncate">{challenge.title}</h3>
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {challenge._count.markets} market{challenge._count.markets !== 1 ? "s" : ""} ·{" "}
          {isFree ? "Free" : `${challenge.entryFeeCents}¢ entry`} ·{" "}
          {challenge.payoutType === "WINNER_TAKES_ALL" ? "Winner takes all" : "Top 3 split"} ·{" "}
          {challenge._count.entries} joined
        </p>
        {challenge.creator && (
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            by {challenge.creator.username ?? challenge.creator.displayName ?? "anonymous"}
          </p>
        )}
      </div>
      <Link
        href={`/challenges/${challenge.inviteSlug}`}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
        style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
      >
        View
      </Link>
    </div>
  );
}
