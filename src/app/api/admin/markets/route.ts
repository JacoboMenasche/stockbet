import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { companyId, earningsEventId, question, metricType, threshold, thresholdLabel, consensusEstimate } = body;

  if (!companyId || !question || !metricType || threshold === undefined || !thresholdLabel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const market = await db.market.create({
    data: {
      companyId,
      earningsEventId: earningsEventId ?? null,
      question,
      metricType,
      threshold,
      thresholdLabel,
      consensusEstimate: consensusEstimate ?? null,
      status: "OPEN",
      yesPriceLatest: 50,
      noPriceLatest: 50,
      betDate: today,
    },
    include: { company: true },
  });

  return NextResponse.json(market);
}
