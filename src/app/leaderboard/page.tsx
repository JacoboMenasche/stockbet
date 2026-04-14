import { Suspense } from "react";
import { getLeaderboard } from "@/lib/queries/leaderboard";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";

interface PageProps {
  searchParams: Promise<{ window?: string }>;
}

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const { window: rawWindow } = await searchParams;
  const leaderboardWindow: "all" | "30d" = rawWindow === "30d" ? "30d" : "all";

  const rows = await getLeaderboard(leaderboardWindow);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-1">Leaderboard</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Top traders by return on investment
        </p>
      </div>

      <Suspense
        fallback={
          <div className="py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            Loading…
          </div>
        }
      >
        <LeaderboardTable rows={rows} window={leaderboardWindow} />
      </Suspense>
    </div>
  );
}
