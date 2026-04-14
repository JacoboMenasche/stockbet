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
    <div className="app-container max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Leaderboard</h1>
        <p className="page-subtitle">
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
