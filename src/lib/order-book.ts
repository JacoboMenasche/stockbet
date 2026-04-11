export type BookEntry = {
  id: string;
  userId: string;
  price: number;     // YES-equivalent price, 1–99
  available: number; // shares - filledShares
};

export type Fill = {
  orderId: string;
  shares: number;
  price: number;
  counterpartyUserId: string;
};

/** Highest price anyone is willing to pay for YES (best bid). */
export function getBestBid(bids: BookEntry[]): number | null {
  if (bids.length === 0) return null;
  return Math.max(...bids.map((b) => b.price));
}

/** Lowest price anyone is willing to sell YES for (best ask). */
export function getBestAsk(asks: BookEntry[]): number | null {
  if (asks.length === 0) return null;
  return Math.min(...asks.map((a) => a.price));
}

/** Mid price for display. Falls back to lastTradePrice if either side is empty. */
export function getMidPrice(
  bestBid: number | null,
  bestAsk: number | null,
  lastTradePrice: number
): number {
  if (bestBid !== null && bestAsk !== null) {
    return Math.round((bestBid + bestAsk) / 2);
  }
  return lastTradePrice;
}

/**
 * Match a market BUY against asks (sweeps lowest price first).
 * Returns fills array and any remaining unfilled shares.
 */
export function matchMarketBuy(
  shares: number,
  asks: BookEntry[]
): { fills: Fill[]; remainingShares: number } {
  const sorted = [...asks].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  const fills: Fill[] = [];
  let remaining = shares;

  for (const ask of sorted) {
    if (remaining <= 0) break;
    const filled = Math.min(remaining, ask.available);
    fills.push({ orderId: ask.id, shares: filled, price: ask.price, counterpartyUserId: ask.userId });
    remaining -= filled;
  }

  return { fills, remainingShares: remaining };
}

/**
 * Match a market SELL against bids (sweeps highest price first).
 * Returns fills array and any remaining unfilled shares.
 */
export function matchMarketSell(
  shares: number,
  bids: BookEntry[]
): { fills: Fill[]; remainingShares: number } {
  const sorted = [...bids].sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
  const fills: Fill[] = [];
  let remaining = shares;

  for (const bid of sorted) {
    if (remaining <= 0) break;
    const filled = Math.min(remaining, bid.available);
    fills.push({ orderId: bid.id, shares: filled, price: bid.price, counterpartyUserId: bid.userId });
    remaining -= filled;
  }

  return { fills, remainingShares: remaining };
}

/**
 * Returns true if a limit order would match immediately on arrival.
 * Limit BUY crosses if bestAsk <= buyPrice.
 * Limit SELL crosses if bestBid >= sellPrice.
 */
export function limitCrossesImmediately(
  action: "BUY" | "SELL",
  price: number,
  bestBid: number | null,
  bestAsk: number | null
): boolean {
  if (action === "BUY") return bestAsk !== null && bestAsk <= price;
  return bestBid !== null && bestBid >= price;
}
