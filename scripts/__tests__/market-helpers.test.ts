import { describe, it, expect } from "vitest";
import { mapReleaseTime, determineWinningSide, buildMarketQuestion } from "../lib/market-helpers";
import { ReleaseTime, MetricType, Side } from "@prisma/client";

describe("mapReleaseTime", () => {
  it("maps bmo to PRE_MARKET", () => {
    expect(mapReleaseTime("bmo")).toBe(ReleaseTime.PRE_MARKET);
  });
  it("maps amc to POST_MARKET", () => {
    expect(mapReleaseTime("amc")).toBe(ReleaseTime.POST_MARKET);
  });
  it("maps unknown time to POST_MARKET", () => {
    expect(mapReleaseTime("dmh")).toBe(ReleaseTime.POST_MARKET);
  });
});

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
  it("builds EPS question", () => {
    expect(buildMarketQuestion("Apple", MetricType.EPS, "> $1.55")).toBe(
      "Will Apple EPS beat $1.55?"
    );
  });
  it("builds GROSS_MARGIN question", () => {
    expect(buildMarketQuestion("Apple", MetricType.GROSS_MARGIN, "> 47%")).toBe(
      "Will Apple gross margin exceed 47%?"
    );
  });
  it("builds REVENUE_GROWTH question", () => {
    expect(buildMarketQuestion("Apple", MetricType.REVENUE_GROWTH, "> 12%")).toBe(
      "Will Apple revenue growth exceed 12%?"
    );
  });
  it("builds OPERATING_MARGIN question", () => {
    expect(buildMarketQuestion("Apple", MetricType.OPERATING_MARGIN, "> 30%")).toBe(
      "Will Apple operating margin exceed 30%?"
    );
  });
});
