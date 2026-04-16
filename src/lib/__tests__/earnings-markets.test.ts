// src/lib/__tests__/earnings-markets.test.ts
import { describe, it, expect } from "vitest";
import { getQuarterlyEstimate, formatLargeNumber } from "@/lib/fmp";
import { computeEarningsCloseAt } from "@/lib/create-earnings-markets";
import { ReleaseTime } from "@prisma/client";

describe("getQuarterlyEstimate", () => {
  it("divides annual avg by 4", () => {
    expect(getQuarterlyEstimate(400_000_000_000)).toBeCloseTo(100_000_000_000);
  });

  it("handles EPS-scale numbers", () => {
    expect(getQuarterlyEstimate(7.38)).toBeCloseTo(1.845);
  });
});

describe("formatLargeNumber", () => {
  it("formats billions with B suffix", () => {
    expect(formatLargeNumber(94_300_000_000)).toBe("$94.3B");
  });

  it("formats millions with M suffix", () => {
    expect(formatLargeNumber(450_000_000)).toBe("$450.0M");
  });

  it("formats small numbers as dollars", () => {
    expect(formatLargeNumber(1.845)).toBe("$1.85");
  });
});

describe("computeEarningsCloseAt", () => {
  it("PRE_MARKET: returns 9:25 AM ET on reportDate day", () => {
    // April 16 2026 — EDT (UTC-4)
    const reportDate = new Date("2026-04-16T20:00:00Z"); // 4 PM ET
    const result = computeEarningsCloseAt(reportDate, ReleaseTime.PRE_MARKET);
    // 9:25 AM EDT = 13:25 UTC
    expect(result.toISOString()).toBe("2026-04-16T13:25:00.000Z");
  });

  it("POST_MARKET: returns 3:55 PM ET on reportDate day", () => {
    // April 16 2026 — EDT (UTC-4)
    const reportDate = new Date("2026-04-16T20:00:00Z");
    const result = computeEarningsCloseAt(reportDate, ReleaseTime.POST_MARKET);
    // 3:55 PM EDT = 19:55 UTC
    expect(result.toISOString()).toBe("2026-04-16T19:55:00.000Z");
  });

  it("handles EST (winter — UTC-5)", () => {
    // Jan 16 2026 — EST
    const reportDate = new Date("2026-01-16T20:00:00Z");
    const result = computeEarningsCloseAt(reportDate, ReleaseTime.PRE_MARKET);
    // 9:25 AM EST = 14:25 UTC
    expect(result.toISOString()).toBe("2026-01-16T14:25:00.000Z");
  });
});
