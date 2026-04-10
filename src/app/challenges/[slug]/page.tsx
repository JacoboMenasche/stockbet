import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getChallengeDetail } from "@/lib/queries/challenges";
import { ChallengeDetail } from "@/components/challenges/ChallengeDetail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ChallengeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const data = await getChallengeDetail(slug, session?.user?.id);

  if (!data) notFound();

  const { challenge } = data;
  const isFree = challenge.entryFeeCents === 0;
  const totalPot = challenge.entryFeeCents * challenge.entries.length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {challenge.type === "ADMIN" && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
            >
              ⭐ Featured
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
          >
            {challenge.status}
          </span>
        </div>
        <h1 className="text-2xl font-medium text-white mt-2">{challenge.title}</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          {isFree ? "Free entry" : `${challenge.entryFeeCents}¢ entry`}
          {totalPot > 0 && ` · ${totalPot}¢ pot`}
          {" · "}
          {challenge.payoutType === "WINNER_TAKES_ALL" ? "Winner takes all" : "Top 3 split"}
        </p>
      </div>

      <ChallengeDetail data={data} userId={session?.user?.id} />
    </div>
  );
}
