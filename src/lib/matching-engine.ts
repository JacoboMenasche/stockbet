import { db } from "@/lib/db";
import { OrderAction, OrderStatus, OrderType, Side } from "@prisma/client";
import {
  BookEntry,
  Fill,
  getBestBid,
  getBestAsk,
  getMidPrice,
  matchMarketBuy,
  matchMarketSell,
  limitCrossesImmediately,
} from "@/lib/order-book";

// ─── Constants ───────────────────────────────────────────────────────────────

export const PLATFORM_USER_ID = "platform";
const SEED_BID_PRICE = 45;
const SEED_ASK_PRICE = 55;
const SEED_SHARES = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

type DbOrder = {
  id: string;
  userId: string;
  side: Side;
  action: OrderAction;
  price: number | null;
  shares: number;
  filledShares: number;
};

export interface PlaceOrderParams {
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  action: "BUY" | "SELL";
  orderType: "LIMIT" | "MARKET";
  shares: number;
  price?: number; // required for LIMIT
}

export interface PlaceOrderResult {
  orderId: string;
  filledShares: number;
  avgFillPrice: number;
  status: string;
  newYesPrice: number;
  newNoPrice: number;
}

// ─── Normalization helpers ────────────────────────────────────────────────────

/**
 * Convert an order's stored price to the YES-equivalent price used in the book.
 * Buy YES at P  → YES bid at P
 * Sell YES at P → YES ask at P
 * Buy NO at P   → YES ask at (100-P)   [buyer of NO = seller of YES equiv]
 * Sell NO at P  → YES bid at (100-P)   [seller of NO = buyer of YES equiv]
 */
function toYesEquivPrice(side: Side, price: number): number {
  return side === Side.YES ? price : 100 - price;
}

/**
 * Extract YES bids from open orders:
 * - Buy YES orders (willing to buy YES)
 * - Sell NO orders (equivalent to buying YES)
 */
function extractBids(orders: DbOrder[]): BookEntry[] {
  return orders
    .filter(
      (o) =>
        (o.action === OrderAction.BUY && o.side === Side.YES) ||
        (o.action === OrderAction.SELL && o.side === Side.NO)
    )
    .map((o) => ({
      id: o.id,
      userId: o.userId,
      price: toYesEquivPrice(o.side, o.price!),
      available: o.shares - o.filledShares,
    }))
    .filter((e) => e.available > 0);
}

/**
 * Extract YES asks from open orders:
 * - Sell YES orders (willing to sell YES)
 * - Buy NO orders (equivalent to selling YES)
 */
function extractAsks(orders: DbOrder[]): BookEntry[] {
  return orders
    .filter(
      (o) =>
        (o.action === OrderAction.SELL && o.side === Side.YES) ||
        (o.action === OrderAction.BUY && o.side === Side.NO)
    )
    .map((o) => ({
      id: o.id,
      userId: o.userId,
      price: toYesEquivPrice(o.side, o.price!),
      available: o.shares - o.filledShares,
    }))
    .filter((e) => e.available > 0);
}

// ─── Position helper ──────────────────────────────────────────────────────────

async function upsertPosition(
  tx: any,
  userId: string,
  marketId: string,
  side: Side,
  sharesDelta: number, // positive = add, negative = reduce
  fillPrice: number
) {
  const existing = await tx.position.findUnique({
    where: { marketId_userId_side: { marketId, userId, side } },
  });

  if (existing) {
    const newShares = existing.shares + sharesDelta;
    if (newShares <= 0) {
      await tx.position.delete({
        where: { marketId_userId_side: { marketId, userId, side } },
      });
    } else {
      const newAvgCost =
        sharesDelta > 0
          ? Math.round(
              (existing.shares * existing.avgCostCents + sharesDelta * fillPrice) / newShares
            )
          : existing.avgCostCents;
      await tx.position.update({
        where: { marketId_userId_side: { marketId, userId, side } },
        data: {
          shares: newShares,
          avgCostCents: newAvgCost,
          currentPrice: fillPrice,
          unrealizedPL: newShares * (fillPrice - newAvgCost),
        },
      });
    }
  } else if (sharesDelta > 0) {
    await tx.position.create({
      data: {
        marketId,
        userId,
        side,
        shares: sharesDelta,
        avgCostCents: fillPrice,
        currentPrice: fillPrice,
        unrealizedPL: 0,
      },
    });
  }
}

// ─── placeOrder ───────────────────────────────────────────────────────────────

export async function placeOrder({
  userId,
  marketId,
  side,
  action,
  orderType,
  shares,
  price,
}: PlaceOrderParams): Promise<PlaceOrderResult> {
  // Validate inputs
  if (shares < 1) throw new Error("Minimum 1 share");
  if (orderType === "LIMIT") {
    if (!price || price < 1 || price > 99) throw new Error("Limit price must be 1–99");
  }

  const market = await db.market.findUnique({
    where: { id: marketId },
    select: { status: true, yesPriceLatest: true, noPriceLatest: true },
  });
  if (!market) throw new Error("Market not found");
  if (market.status !== "OPEN") throw new Error("Market is not open for trading");

  // Sellers must have a position to sell
  if (action === "SELL") {
    const pos = await db.position.findUnique({
      where: { marketId_userId_side: { marketId, userId, side: side as Side } },
      select: { shares: true },
    });
    if (!pos || pos.shares < shares) {
      throw new Error(`You have no ${side} shares to sell`);
    }
  }

  // Load all open orders from other users for matching
  const dbOrders = await db.order.findMany({
    where: {
      marketId,
      status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] },
      NOT: { userId },
    },
    select: {
      id: true, userId: true, side: true, action: true,
      price: true, shares: true, filledShares: true,
    },
  });

  const bids = extractBids(dbOrders as DbOrder[]);
  const asks = extractAsks(dbOrders as DbOrder[]);

  // Determine if this order is "buying YES" from the book's perspective
  const isBuyingYes =
    (side === "YES" && action === "BUY") || (side === "NO" && action === "SELL");

  const bookToMatch = isBuyingYes ? asks : bids;
  const matchFn = isBuyingYes ? matchMarketBuy : matchMarketSell;

  let fills: Fill[] = [];
  let remainingShares = shares;

  if (orderType === "MARKET") {
    const result = matchFn(shares, bookToMatch);
    fills = result.fills;
    remainingShares = result.remainingShares;
    if (fills.length === 0) {
      throw new Error("No liquidity available — try a limit order");
    }
  } else {
    // Limit order: match immediately if it crosses the spread
    const yesPrice = toYesEquivPrice(side as Side, price!);
    const bookAction = isBuyingYes ? "BUY" : "SELL";
    if (limitCrossesImmediately(bookAction, yesPrice, getBestBid(bids), getBestAsk(asks))) {
      const result = matchFn(shares, bookToMatch);
      fills = result.fills;
      remainingShares = result.remainingShares;
    }
    // remainingShares rest in the book
  }

  const filledCount = fills.reduce((s, f) => s + f.shares, 0);
  const totalFillCost = fills.reduce((s, f) => s + f.price * f.shares, 0);
  const avgFillPrice =
    filledCount > 0 ? Math.round(totalFillCost / filledCount) : (price ?? market.yesPriceLatest);

  // For resting limit BUY orders, reserve the balance upfront
  const restingReservation =
    orderType === "LIMIT" && action === "BUY" && remainingShares > 0
      ? price! * remainingShares
      : 0;
  const totalBuyerDebit = totalFillCost + restingReservation;

  if (action === "BUY") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { cashBalanceCents: true },
    });
    if (!user || Number(user.cashBalanceCents) < totalBuyerDebit) {
      throw new Error("Insufficient balance");
    }
  }

  const orderStatus: OrderStatus =
    remainingShares === 0
      ? OrderStatus.FILLED
      : filledCount > 0
      ? OrderStatus.PARTIALLY_FILLED
      : OrderStatus.OPEN;

  const result = await db.$transaction(async (tx) => {
    // Create the order record
    const order = await tx.order.create({
      data: {
        marketId,
        userId,
        side: side as Side,
        action: action as OrderAction,
        orderType: orderType as OrderType,
        price: price ?? null,
        shares,
        filledShares: filledCount,
        status: orderStatus,
      },
    });

    // Process each fill
    for (const fill of fills) {
      const counterOrder = (dbOrders as DbOrder[]).find((o) => o.id === fill.orderId)!;
      const newCounterFilled = counterOrder.filledShares + fill.shares;
      const newCounterStatus =
        newCounterFilled >= counterOrder.shares
          ? OrderStatus.FILLED
          : OrderStatus.PARTIALLY_FILLED;

      // Trade record — buyOrderId is always the YES-buyer's order
      await tx.trade.create({
        data: {
          marketId,
          buyOrderId: isBuyingYes ? order.id : fill.orderId,
          sellOrderId: isBuyingYes ? fill.orderId : order.id,
          side: Side.YES,
          price: fill.price,
          shares: fill.shares,
        },
      });

      // Update counterparty order
      await tx.order.update({
        where: { id: fill.orderId },
        data: { filledShares: newCounterFilled, status: newCounterStatus },
      });

      if (isBuyingYes) {
        // We are the buyer; counterparty is a YES seller or NO buyer (ask side)
        // Credit the counterparty for their sale
        await tx.user.update({
          where: { id: fill.counterpartyUserId },
          data: { cashBalanceCents: { increment: BigInt(fill.price * fill.shares) } },
        });
        // Counterparty's position decreases (they sold)
        await upsertPosition(tx, fill.counterpartyUserId, marketId,
          counterOrder.side, -fill.shares, fill.price);
      } else {
        // We are the seller; counterparty is a YES buyer or NO seller (bid side)
        // Counterparty had reserved balance — they already paid, now we credit seller (us)
        await tx.user.update({
          where: { id: userId },
          data: { cashBalanceCents: { increment: BigInt(fill.price * fill.shares) } },
        });
        // Counterparty's position increases (they bought)
        await upsertPosition(tx, fill.counterpartyUserId, marketId,
          counterOrder.side, fill.shares, fill.price);
      }
    }

    // Debit the buyer (fills + resting reservation)
    if (action === "BUY" && totalBuyerDebit > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { cashBalanceCents: { decrement: BigInt(totalBuyerDebit) } },
      });
    }

    // Update our own position for filled shares
    if (filledCount > 0) {
      await upsertPosition(
        tx, userId, marketId, side as Side,
        action === "BUY" ? filledCount : -filledCount,
        avgFillPrice
      );
    }

    // Update market last trade price
    if (fills.length > 0) {
      const lastFill = fills[fills.length - 1];
      const newYes = Math.min(99, Math.max(1, isBuyingYes ? lastFill.price : 100 - lastFill.price));
      await tx.market.update({
        where: { id: marketId },
        data: {
          yesPriceLatest: newYes,
          noPriceLatest: 100 - newYes,
          totalVolume: { increment: BigInt(totalFillCost) },
          volume24h: { increment: BigInt(totalFillCost) },
        },
      });
    }

    return order;
  });

  const updatedMarket = await db.market.findUnique({
    where: { id: marketId },
    select: { yesPriceLatest: true, noPriceLatest: true },
  });

  return {
    orderId: result.id,
    filledShares: filledCount,
    avgFillPrice,
    status: orderStatus,
    newYesPrice: updatedMarket?.yesPriceLatest ?? market.yesPriceLatest,
    newNoPrice: updatedMarket?.noPriceLatest ?? market.noPriceLatest,
  };
}

// ─── seedMarket ───────────────────────────────────────────────────────────────

/**
 * Post platform limit orders for a new market: bid at 45¢ and ask at 55¢,
 * 500 shares each. Creates the platform user if it doesn't exist.
 */
export async function seedMarket(marketId: string): Promise<void> {
  await db.user.upsert({
    where: { id: PLATFORM_USER_ID },
    update: {},
    create: {
      id: PLATFORM_USER_ID,
      email: "platform@internal",
      cashBalanceCents: BigInt(0),
    },
  });

  await db.order.createMany({
    data: [
      {
        marketId,
        userId: PLATFORM_USER_ID,
        side: Side.YES,
        action: OrderAction.BUY,
        orderType: OrderType.LIMIT,
        price: SEED_BID_PRICE,
        shares: SEED_SHARES,
        filledShares: 0,
        status: OrderStatus.OPEN,
      },
      {
        marketId,
        userId: PLATFORM_USER_ID,
        side: Side.YES,
        action: OrderAction.SELL,
        orderType: OrderType.LIMIT,
        price: SEED_ASK_PRICE,
        shares: SEED_SHARES,
        filledShares: 0,
        status: OrderStatus.OPEN,
      },
    ],
  });
}

// ─── cancelMarketOrders ───────────────────────────────────────────────────────

/**
 * Cancel all open orders for a market and refund reserved balance to buyers.
 * Called at resolution before payouts.
 */
export async function cancelMarketOrders(marketId: string): Promise<void> {
  const openOrders = await db.order.findMany({
    where: {
      marketId,
      status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] },
    },
    select: { id: true, userId: true, action: true, price: true, shares: true, filledShares: true },
  });

  if (openOrders.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const order of openOrders) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });

      // Refund reserved balance for resting BUY limit orders
      if (order.action === OrderAction.BUY && order.price !== null && order.userId !== PLATFORM_USER_ID) {
        const unfilledShares = order.shares - order.filledShares;
        if (unfilledShares > 0) {
          const refund = order.price * unfilledShares;
          await tx.user.update({
            where: { id: order.userId },
            data: { cashBalanceCents: { increment: BigInt(refund) } },
          });
        }
      }
    }
  });
}
