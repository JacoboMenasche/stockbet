import { describe, it, expect } from "vitest";
import {
  getBestBid,
  getBestAsk,
  getMidPrice,
  matchMarketBuy,
  matchMarketSell,
  limitCrossesImmediately,
  type BookEntry,
} from "@/lib/order-book";

describe("getBestBid", () => {
  it("returns the highest price from bids", () => {
    const bids: BookEntry[] = [
      { id: "a", userId: "u1", price: 45, available: 100 },
      { id: "b", userId: "u2", price: 62, available: 50 },
      { id: "c", userId: "u3", price: 50, available: 200 },
    ];
    expect(getBestBid(bids)).toBe(62);
  });

  it("returns null for an empty book", () => {
    expect(getBestBid([])).toBeNull();
  });
});

describe("getBestAsk", () => {
  it("returns the lowest price from asks", () => {
    const asks: BookEntry[] = [
      { id: "a", userId: "u1", price: 55, available: 500 },
      { id: "b", userId: "u2", price: 58, available: 150 },
      { id: "c", userId: "u3", price: 61, available: 300 },
    ];
    expect(getBestAsk(asks)).toBe(55);
  });

  it("returns null for an empty book", () => {
    expect(getBestAsk([])).toBeNull();
  });
});

describe("getMidPrice", () => {
  it("returns (bid + ask) / 2 rounded when both sides exist", () => {
    expect(getMidPrice(54, 60, 50)).toBe(57);
  });

  it("rounds 0.5 up", () => {
    expect(getMidPrice(45, 56, 50)).toBe(51); // (45+56)/2 = 50.5 → 51
  });

  it("falls back to lastTradePrice when bid is null", () => {
    expect(getMidPrice(null, 60, 50)).toBe(50);
  });

  it("falls back to lastTradePrice when ask is null", () => {
    expect(getMidPrice(54, null, 50)).toBe(50);
  });

  it("falls back to lastTradePrice when both are null", () => {
    expect(getMidPrice(null, null, 42)).toBe(42);
  });
});

describe("matchMarketBuy", () => {
  const asks: BookEntry[] = [
    { id: "a1", userId: "seller1", price: 55, available: 500 },
    { id: "a2", userId: "seller2", price: 58, available: 150 },
    { id: "a3", userId: "seller3", price: 61, available: 300 },
  ];

  it("fills entirely from the lowest ask when sufficient", () => {
    const { fills, remainingShares } = matchMarketBuy(100, asks);
    expect(fills).toHaveLength(1);
    expect(fills[0]).toEqual({ orderId: "a1", shares: 100, price: 55, counterpartyUserId: "seller1" });
    expect(remainingShares).toBe(0);
  });

  it("sweeps across multiple price levels", () => {
    const { fills, remainingShares } = matchMarketBuy(600, asks);
    expect(fills).toHaveLength(2);
    expect(fills[0]).toEqual({ orderId: "a1", shares: 500, price: 55, counterpartyUserId: "seller1" });
    expect(fills[1]).toEqual({ orderId: "a2", shares: 100, price: 58, counterpartyUserId: "seller2" });
    expect(remainingShares).toBe(0);
  });

  it("returns remaining shares when book is exhausted", () => {
    const { fills, remainingShares } = matchMarketBuy(1100, asks);
    expect(fills).toHaveLength(3);
    expect(remainingShares).toBe(150); // 1100 - 500 - 150 - 300 = 150
  });

  it("returns empty fills and full remaining for an empty book", () => {
    const { fills, remainingShares } = matchMarketBuy(100, []);
    expect(fills).toHaveLength(0);
    expect(remainingShares).toBe(100);
  });
});

describe("matchMarketSell", () => {
  const bids: BookEntry[] = [
    { id: "b1", userId: "buyer1", price: 62, available: 200 },
    { id: "b2", userId: "buyer2", price: 54, available: 100 },
    { id: "b3", userId: "buyer3", price: 45, available: 500 },
  ];

  it("fills from the highest bid first", () => {
    const { fills, remainingShares } = matchMarketSell(100, bids);
    expect(fills).toHaveLength(1);
    expect(fills[0]).toEqual({ orderId: "b1", shares: 100, price: 62, counterpartyUserId: "buyer1" });
    expect(remainingShares).toBe(0);
  });

  it("sweeps multiple levels when needed", () => {
    const { fills, remainingShares } = matchMarketSell(350, bids);
    expect(fills[0]).toEqual({ orderId: "b1", shares: 200, price: 62, counterpartyUserId: "buyer1" });
    expect(fills[1]).toEqual({ orderId: "b2", shares: 100, price: 54, counterpartyUserId: "buyer2" });
    expect(fills[2]).toEqual({ orderId: "b3", shares: 50, price: 45, counterpartyUserId: "buyer3" });
    expect(remainingShares).toBe(0);
  });

  it("returns remaining when book exhausted", () => {
    const { fills, remainingShares } = matchMarketSell(1000, bids);
    expect(remainingShares).toBe(200); // 1000 - 200 - 100 - 500 = 200
  });
});

describe("limitCrossesImmediately", () => {
  it("limit BUY crosses when best ask <= buy price", () => {
    expect(limitCrossesImmediately("BUY", 60, 45, 55)).toBe(true);
    expect(limitCrossesImmediately("BUY", 60, 45, 60)).toBe(true); // exact match
    expect(limitCrossesImmediately("BUY", 60, 45, 61)).toBe(false);
  });

  it("limit SELL crosses when best bid >= sell price", () => {
    expect(limitCrossesImmediately("SELL", 50, 54, 60)).toBe(true);
    expect(limitCrossesImmediately("SELL", 50, 50, 60)).toBe(true); // exact match
    expect(limitCrossesImmediately("SELL", 50, 49, 60)).toBe(false);
  });

  it("returns false when the relevant side is null", () => {
    expect(limitCrossesImmediately("BUY", 60, null, null)).toBe(false);
    expect(limitCrossesImmediately("SELL", 50, null, null)).toBe(false);
  });
});
