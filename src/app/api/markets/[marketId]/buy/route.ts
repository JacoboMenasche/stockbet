import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ammCost, ammNewPrices } from "@/lib/amm";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  let body: { side: unknown; shares: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { side, shares } = body;

  if (side !== "YES" && side !== "NO") {
    return NextResponse.json({ error: "side must be YES or NO" }, { status: 400 });
  }
  if (!Number.isInteger(shares) || (shares as number) < 10) {
    return NextResponse.json({ error: "Minimum 10 shares" }, { status: 400 });
  }

  const sharesNum = shares as number;
  const sideEnum = side as "YES" | "NO";

  const market = await db.market.findUnique({
    where: { id: marketId },
    select: { id: true, status: true, yesPriceLatest: true, noPriceLatest: true },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }
  if (market.status !== "OPEN") {
    return NextResponse.json({ error: "Market is not open for trading" }, { status: 400 });
  }

  const currentPrice = sideEnum === "YES" ? market.yesPriceLatest : market.noPriceLatest;
  const cost = ammCost(sharesNum, currentPrice);
  const newPrices = ammNewPrices(sharesNum, market.yesPriceLatest, sideEnum);
  const newCurrentPrice = sideEnum === "YES" ? newPrices.yesPriceLatest : newPrices.noPriceLatest;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cashBalanceCents: true },
  });

  if (!user || Number(user.cashBalanceCents) < cost) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: session.user.id },
      data: { cashBalanceCents: { decrement: BigInt(cost) } },
      select: { cashBalanceCents: true },
    });

    const order = await tx.order.create({
      data: {
        marketId: market.id,
        userId: session.user.id,
        side: sideEnum,
        price: currentPrice,
        shares: sharesNum,
        filledShares: sharesNum,
        status: "FILLED",
      },
    });

    await tx.trade.create({
      data: {
        marketId: market.id,
        buyOrderId: order.id,
        sellOrderId: null,
        side: sideEnum,
        price: currentPrice,
        shares: sharesNum,
      },
    });

    const existing = await tx.position.findUnique({
      where: {
        marketId_userId_side: {
          marketId: market.id,
          userId: session.user.id,
          side: sideEnum,
        },
      },
    });

    let position;
    if (existing) {
      const totalShares = existing.shares + sharesNum;
      const newAvgCost = Math.floor(
        (existing.shares * existing.avgCostCents + cost) / totalShares
      );
      const unrealizedPL = totalShares * (newCurrentPrice - newAvgCost);
      position = await tx.position.update({
        where: { id: existing.id },
        data: {
          shares: totalShares,
          avgCostCents: newAvgCost,
          currentPrice: newCurrentPrice,
          unrealizedPL,
        },
      });
    } else {
      const avgCostCents = Math.floor(cost / sharesNum);
      position = await tx.position.create({
        data: {
          marketId: market.id,
          userId: session.user.id,
          side: sideEnum,
          shares: sharesNum,
          avgCostCents,
          currentPrice: newCurrentPrice,
          unrealizedPL: 0,
        },
      });
    }

    await tx.market.update({
      where: { id: market.id },
      data: {
        yesPriceLatest: newPrices.yesPriceLatest,
        noPriceLatest: newPrices.noPriceLatest,
        totalVolume: { increment: BigInt(cost) },
        volume24h: { increment: BigInt(cost) },
      },
    });

    return { updatedUser, position, newPrices };
  });

  return NextResponse.json({
    cashBalanceCents: Number(result.updatedUser.cashBalanceCents),
    yesPriceLatest: result.newPrices.yesPriceLatest,
    noPriceLatest: result.newPrices.noPriceLatest,
    position: {
      shares: result.position.shares,
      avgCostCents: result.position.avgCostCents,
      currentPrice: result.position.currentPrice,
      unrealizedPL: result.position.unrealizedPL,
    },
  });
}
