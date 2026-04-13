import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getChallengeList } from "@/lib/queries/challenges";
import { createChallenge } from "@/lib/challenges";
import { ChallengeType, PayoutType, ScoringMode } from "@prisma/client";

export async function GET() {
  const challenges = await getChallengeList();
  return NextResponse.json(challenges);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, marketIds, entryFeeCents, payoutType, isAdmin, isPublic, scoringMode, startDate } = body as {
    title?: unknown;
    marketIds?: unknown;
    entryFeeCents?: unknown;
    payoutType?: unknown;
    isAdmin?: unknown;
    isPublic?: unknown;
    scoringMode?: unknown;
    startDate?: unknown;
  };

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Array.isArray(marketIds) || marketIds.length === 0) {
    return NextResponse.json({ error: "marketIds must be a non-empty array" }, { status: 400 });
  }
  if (!marketIds.every((id) => typeof id === "string" && id.length > 0)) {
    return NextResponse.json({ error: "each marketId must be a non-empty string" }, { status: 400 });
  }
  if (typeof entryFeeCents !== "number" || entryFeeCents < 0 || !Number.isInteger(entryFeeCents)) {
    return NextResponse.json({ error: "entryFeeCents must be a non-negative integer" }, { status: 400 });
  }
  if (payoutType !== "WINNER_TAKES_ALL" && payoutType !== "TOP_THREE_SPLIT") {
    return NextResponse.json({ error: "payoutType must be WINNER_TAKES_ALL or TOP_THREE_SPLIT" }, { status: 400 });
  }
  if (scoringMode !== undefined && scoringMode !== "PICKS" && scoringMode !== "TRADING_PNL") {
    return NextResponse.json({ error: "scoringMode must be PICKS or TRADING_PNL" }, { status: 400 });
  }
  if (startDate !== undefined && startDate !== null) {
    if (typeof startDate !== "string" || isNaN(Date.parse(startDate as string))) {
      return NextResponse.json({ error: "startDate must be a valid ISO date string or null" }, { status: 400 });
    }
  }

  // Check admin status for ADMIN type
  let type: ChallengeType = ChallengeType.USER;
  if (isAdmin === true) {
    const adminUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
    if (adminUser && adminEmails.includes(adminUser.email)) {
      type = ChallengeType.ADMIN;
    }
  }

  try {
    const challenge = await createChallenge({
      title: title.trim(),
      creatorId: session.user.id,
      type,
      entryFeeCents: entryFeeCents as number,
      payoutType: payoutType as PayoutType,
      marketIds: marketIds as string[],
      isPublic: isPublic === true,
      scoringMode: (scoringMode as ScoringMode | undefined) ?? ScoringMode.PICKS,
      startDate: startDate ? new Date(startDate as string) : null,
    });
    return NextResponse.json({ slug: challenge.inviteSlug }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
