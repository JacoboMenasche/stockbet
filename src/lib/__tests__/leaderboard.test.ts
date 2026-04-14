import { describe, it, expect } from "vitest";
import { computeLeaderboard } from "@/lib/queries/leaderboard";

describe("computeLeaderboard", () => {
  it("computes ROI as realizedPL / costBasis * 100", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 200, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].roiPct).toBeCloseTo(20);
  });

  it("excludes users with fewer than 5 resolved positions", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 500, totalCostBasis: 1000, positionCount: 4 },
      { userId: "u2", displayName: "Bob",   totalRealizedPL: 100, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u2");
  });

  it("sorts by ROI descending", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 100, totalCostBasis: 1000, positionCount: 5 },
      { userId: "u2", displayName: "Bob",   totalRealizedPL: 400, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].userId).toBe("u2");
    expect(result[1].userId).toBe("u1");
  });

  it("assigns rank starting at 1", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 100, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].rank).toBe(1);
  });

  it("caps results at 50", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      userId: `u${i}`,
      displayName: `User ${i}`,
      totalRealizedPL: i * 10,
      totalCostBasis: 1000,
      positionCount: 5,
    }));
    const result = computeLeaderboard(rows);
    expect(result).toHaveLength(50);
    // Highest ROI rows should be retained (sorted descending before slicing)
    expect(result[0].userId).toBe("u59");
  });

  it("handles zero cost basis without throwing", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 0, totalCostBasis: 0, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].roiPct).toBe(0);
  });

  it("supports negative ROI", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: -300, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].roiPct).toBeCloseTo(-30);
  });
});
