import { db } from "@/lib/db";
import { ChallengeStatus } from "@prisma/client";

export type ChallengeListItem = Awaited<ReturnType<typeof getChallengeList>>[number];
export type ChallengeDetailData = Awaited<ReturnType<typeof getChallengeDetail>>;

export async function getChallengeList() {
  return db.challenge.findMany({
    where: { status: ChallengeStatus.OPEN, isPublic: true },
    include: {
      creator: { select: { username: true, displayName: true } },
      _count: { select: { entries: true, markets: true } },
    },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }], // ADMIN sorts before USER alphabetically
  });
}

export async function getChallengeDetail(slug: string, userId?: string) {
  const challenge = await db.challenge.findUnique({
    where: { inviteSlug: slug },
    include: {
      creator: { select: { username: true, displayName: true } },
      markets: {
        include: {
          market: {
            select: {
              id: true,
              question: true,
              metricType: true,
              thresholdLabel: true,
              yesPriceLatest: true,
              noPriceLatest: true,
              status: true,
            },
          },
        },
      },
      entries: {
        include: {
          user: { select: { username: true, displayName: true } },
          picks: { select: { marketId: true, side: true, correct: true } },
        },
        orderBy: [{ rank: "asc" }, { score: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!challenge) return null;

  const userEntry = userId
    ? challenge.entries.find((e) => e.userId === userId) ?? null
    : null;

  return { challenge, userEntry };
}
