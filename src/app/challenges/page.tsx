import Link from "next/link";
import { auth } from "@/auth";
import { getChallengeList } from "@/lib/queries/challenges";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const [session, challenges] = await Promise.all([
    auth(),
    getChallengeList(),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-white mb-1">Challenges</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Predict correctly on more markets than everyone else to win the pot
          </p>
        </div>
        {session && (
          <Link
            href="/challenges/create"
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
          >
            + Create
          </Link>
        )}
      </div>

      {challenges.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            No open challenges right now. Be the first to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
}
