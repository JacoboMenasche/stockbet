import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OrderStatus, OrderAction, Side } from "@prisma/client";
import { getBestBid, getBestAsk, getMidPrice } from "@/lib/order-book";
import { PLATFORM_USER_ID } from "@/lib/matching-engine";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const { marketId } = await context.params;

  const market = await db.market.findUnique({
    where: { id: marketId },
    select: { yesPriceLatest: true, noPriceLatest: true },
  });
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const orders = await db.order.findMany({
    where: {
      marketId,
      status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] },
    },
    select: { id: true, userId: true, side: true, action: true, price: true, shares: true, filledShares: true },
    orderBy: { price: "asc" },
  });

  // Aggregate bids: Buy YES + Sell NO orders, grouped by YES-equivalent price
  const bidMap = new Map<number, { shares: number; isPlatform: boolean }>();
  for (const o of orders) {
    const isBid =
      (o.action === OrderAction.BUY && o.side === Side.YES) ||
      (o.action === OrderAction.SELL && o.side === Side.NO);
    if (!isBid || o.price === null) continue;
    const yesPrice = o.side === Side.YES ? o.price : 100 - o.price;
    const avail = o.shares - o.filledShares;
    if (avail <= 0) continue;
    const existing = bidMap.get(yesPrice) ?? { shares: 0, isPlatform: false };
    bidMap.set(yesPrice, {
      shares: existing.shares + avail,
      isPlatform: existing.isPlatform || o.userId === PLATFORM_USER_ID,
    });
  }

  // Aggregate asks: Sell YES + Buy NO orders, grouped by YES-equivalent price
  const askMap = new Map<number, { shares: number; isPlatform: boolean }>();
  for (const o of orders) {
    const isAsk =
      (o.action === OrderAction.SELL && o.side === Side.YES) ||
      (o.action === OrderAction.BUY && o.side === Side.NO);
    if (!isAsk || o.price === null) continue;
    const yesPrice = o.side === Side.YES ? o.price : 100 - o.price;
    const avail = o.shares - o.filledShares;
    if (avail <= 0) continue;
    const existing = askMap.get(yesPrice) ?? { shares: 0, isPlatform: false };
    askMap.set(yesPrice, {
      shares: existing.shares + avail,
      isPlatform: existing.isPlatform || o.userId === PLATFORM_USER_ID,
    });
  }

  const bids = Array.from(bidMap.entries())
    .map(([price, { shares, isPlatform }]) => ({ price, shares, isPlatform }))
    .sort((a, b) => b.price - a.price); // descending

  const asks = Array.from(askMap.entries())
    .map(([price, { shares, isPlatform }]) => ({ price, shares, isPlatform }))
    .sort((a, b) => a.price - b.price); // ascending

  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const midPrice = getMidPrice(bestBid, bestAsk, market.yesPriceLatest);

  return NextResponse.json({
    bids,
    asks,
    midPrice,
    lastTradePrice: market.yesPriceLatest,
    noPrice: market.noPriceLatest,
  });
}
