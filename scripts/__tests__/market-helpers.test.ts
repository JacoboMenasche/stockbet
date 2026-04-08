import { describe, it, expect } from "vitest";
import { determineWinningSide, buildMarketQuestion } from "../lib/market-helpers";
import { MetricType, Side } from "@prisma/client";

describe("determineWinningSide", () => {
  it("returns YES when actual exceeds threshold", () => {
    expect(determineWinningSide(1.60, 1.55)).toBe(Side.YES);
  });
  it("returns NO when actual is below threshold", () => {
    expect(determineWinningSide(1.50, 1.55)).toBe(Side.NO);
  });
  it("returns NO when actual equals threshold (not strictly greater)", () => {
    expect(determineWinningSide(1.55, 1.55)).toBe(Side.NO);
  });
});

describe("buildMarketQuestion", () => {
  it("builds PRICE_DIRECTION question", () => {
    expect(buildMarketQuestion("Apple Inc.", MetricType.PRICE_DIRECTION, "Up/Down")).toBe(
      "Will Apple Inc. close higher than it opened today?"
    );
  });
  it("builds PRICE_TARGET question", () => {
    expect(buildMarketQuestion("Apple Inc.", MetricType.PRICE_TARGET, "$195.00")).toBe(
      "Will Apple Inc. close at or above $195.00 today?"
    );
  });
  it("builds PERCENTAGE_MOVE question", () => {
    expect(buildMarketQuestion("Apple Inc.", MetricType.PERCENTAGE_MOVE, ">2%")).toBe(
      "Will Apple Inc. move more than 2% today?"
    );
  });
});
