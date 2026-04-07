import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { marketId } = await context.params;
  const body = await req.json();
  const { actualValue, actualLabel, winningSide } = body;

  if (actualValue === undefined || !actualLabel || !winningSide) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (winningSide !== "YES" && winningSide !== "NO") {
    return NextResponse.json({ error: "winningSide must be YES or NO" }, { status: 400 });
  }

  const market = await db.market.findUnique({ where: { id: marketId } });
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }
  if (market.status === "RESOLVED") {
    return NextResponse.json({ error: "Market already resolved" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const resolution = await tx.resolution.create({
      data: {
        marketId,
        actualValue,
        actualLabel,
        winningSide,
        sourceFiling: "admin-manual-resolution",
      },
    });

    await tx.market.update({
      where: { id: marketId },
      data: { status: "RESOLVED" },
    });

    const positions = await tx.position.findMany({
      where: { marketId },
    });

    for (const position of positions) {
      const won = position.side === winningSide;
      const totalCost = position.shares * position.avgCostCents;

      if (won) {
        const payout = position.shares * 100;
        const realizedPL = payout - totalCost;

        await tx.user.update({
          where: { id: position.userId },
          data: { cashBalanceCents: { increment: BigInt(payout) } },
        });

        await tx.position.update({
          where: { id: position.id },
          data: { realizedPL, currentPrice: 100, unrealizedPL: 0 },
        });
      } else {
        const realizedPL = -totalCost;

        await tx.position.update({
          where: { id: position.id },
          data: { realizedPL, currentPrice: 0, unrealizedPL: 0 },
        });
      }
    }

    await tx.resolution.update({
      where: { id: resolution.id },
      data: { payoutsIssuedAt: new Date() },
    });

    return { resolution, settledPositions: positions.length };
  });

  return NextResponse.json(result);
}
