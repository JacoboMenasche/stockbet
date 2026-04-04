export const SENSITIVITY = 40; // shares per 1 cent of price movement

/**
 * Total cost in cents to buy `shares` when current price for that side is `currentPrice` cents.
 * Uses linear AMM: price rises by 1 cent per SENSITIVITY shares.
 * Formula: integral of (currentPrice + x/SENSITIVITY) from 0 to shares
 *        = shares * currentPrice + shares² / (2 * SENSITIVITY)
 */
export function ammCost(shares: number, currentPrice: number): number {
  return shares * currentPrice + Math.floor((shares * shares) / (2 * SENSITIVITY));
}

/**
 * New YES and NO prices after buying `shares` of `side`.
 * Buying YES raises yesPriceLatest; buying NO raises noPriceLatest.
 * Both prices are clamped to [1, 99] and always sum to 100.
 */
export function ammNewPrices(
  shares: number,
  currentYesPrice: number,
  side: "YES" | "NO"
): { yesPriceLatest: number; noPriceLatest: number } {
  const delta = Math.floor(shares / SENSITIVITY);
  if (side === "YES") {
    const newYes = Math.min(99, Math.max(1, currentYesPrice + delta));
    return { yesPriceLatest: newYes, noPriceLatest: 100 - newYes };
  } else {
    const currentNoPrice = 100 - currentYesPrice;
    const newNo = Math.min(99, Math.max(1, currentNoPrice + delta));
    return { yesPriceLatest: 100 - newNo, noPriceLatest: newNo };
  }
}
