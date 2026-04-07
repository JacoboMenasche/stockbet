import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.question !== undefined) data.question = body.question;
  if (body.threshold !== undefined) data.threshold = body.threshold;
  if (body.thresholdLabel !== undefined) data.thresholdLabel = body.thresholdLabel;
  if (body.yesPriceLatest !== undefined) data.yesPriceLatest = body.yesPriceLatest;
  if (body.noPriceLatest !== undefined) data.noPriceLatest = body.noPriceLatest;
  if (body.consensusEstimate !== undefined) data.consensusEstimate = body.consensusEstimate;

  const market = await db.market.update({
    where: { id },
    data,
    include: { company: true },
  });

  return NextResponse.json(market);
}
