import { describe, it, expect } from "vitest";
import {
  scoreEntry,
  rankEntries,
  computePayouts,
  isEligibleForBonus,
  scorePnlEntries,
} from "@/lib/challenges";

describe("scoreEntry", () => {
  it("counts correct YES picks", () => {
    const picks = [
      { marketId: "m1", side: "YES" as const },
      { marketId: "m2", side: "NO" as const },
    ];
    const resolutions = new Map([["m1", "YES" as const], ["m2", "YES" as const]]);
    expect(scoreEntry(picks, resolutions)).toBe(1);
  });

  it("returns 0 for empty picks", () => {
    expect(scoreEntry([], new Map())).toBe(0);
  });

  it("counts all correct", () => {
    const picks = [
      { marketId: "m1", side: "YES" as const },
      { marketId: "m2", side: "NO" as const },
    ];
    const resolutions = new Map([["m1", "YES" as const], ["m2", "NO" as const]]);
    expect(scoreEntry(picks, resolutions)).toBe(2);
  });

  it("ignores picks for markets without resolution", () => {
    const picks = [{ marketId: "m1", side: "YES" as const }];
    expect(scoreEntry(picks, new Map())).toBe(0);
  });
});

describe("rankEntries", () => {
  it("ranks by score descending", () => {
    const now = new Date();
    const entries = [
      { id: "e1", score: 2, createdAt: now },
      { id: "e2", score: 5, createdAt: now },
      { id: "e3", score: 3, createdAt: now },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].id).toBe("e2");
    expect(ranked[1].id).toBe("e3");
    expect(ranked[2].id).toBe("e1");
  });

  it("breaks ties by earlier join time", () => {
    const earlier = new Date("2026-01-01T10:00:00Z");
    const later = new Date("2026-01-01T11:00:00Z");
    const entries = [
      { id: "e1", score: 3, createdAt: later },
      { id: "e2", score: 3, createdAt: earlier },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].id).toBe("e2");
    expect(ranked[1].id).toBe("e1");
  });

  it("assigns rank numbers starting at 1", () => {
    const now = new Date();
    const ranked = rankEntries([{ id: "e1", score: 1, createdAt: now }]);
    expect(ranked[0].rank).toBe(1);
  });
});

describe("computePayouts", () => {
  it("winner takes all pot", () => {
    const payouts = computePayouts(3, 900, "WINNER_TAKES_ALL");
    expect(payouts[0]).toBe(900);
    expect(payouts[1]).toBe(0);
    expect(payouts[2]).toBe(0);
  });

  it("top three split 60/30/10", () => {
    const payouts = computePayouts(3, 1000, "TOP_THREE_SPLIT");
    expect(payouts[0]).toBe(600);
    expect(payouts[1]).toBe(300);
    expect(payouts[2]).toBe(100);
  });

  it("top three split with only 2 entries: remainder goes to winner", () => {
    const payouts = computePayouts(2, 1000, "TOP_THREE_SPLIT");
    expect(payouts[0]).toBe(700); // 600 + 100 remainder
    expect(payouts[1]).toBe(300);
    expect(payouts.length).toBe(2);
  });

  it("returns all zeros when pot is 0 (free challenge)", () => {
    const payouts = computePayouts(5, 0, "WINNER_TAKES_ALL");
    expect(payouts.every((p) => p === 0)).toBe(true);
  });

  it("total distributed always equals total pot", () => {
    const pot = 777;
    const payouts = computePayouts(3, pot, "TOP_THREE_SPLIT");
    expect(payouts.reduce((a, b) => a + b, 0)).toBe(pot);
  });
});

describe("isEligibleForBonus", () => {
  it("requires minimum 5 picks", () => {
    expect(isEligibleForBonus(4, 4, null)).toBe(false);
  });

  it("requires >= 65% win rate", () => {
    expect(isEligibleForBonus(10, 6, null)).toBe(false); // 60%
    expect(isEligibleForBonus(10, 7, null)).toBe(true);  // 70%
  });

  it("allows if lastBonusAt is null", () => {
    expect(isEligibleForBonus(10, 7, null)).toBe(true);
  });

  it("blocks if bonus given within 7 days", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(isEligibleForBonus(10, 7, threeDaysAgo)).toBe(false);
  });

  it("allows if last bonus was more than 7 days ago", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isEligibleForBonus(10, 7, eightDaysAgo)).toBe(true);
  });
});

describe("scorePnlEntries", () => {
  it("assigns P&L from map to each entry", () => {
    const now = new Date();
    const entries = [
      { id: "e1", userId: "u1", createdAt: now },
      { id: "e2", userId: "u2", createdAt: now },
    ];
    const pnlByUser = new Map([
      ["u1", 500],
      ["u2", -100],
    ]);
    const scored = scorePnlEntries(entries, pnlByUser);
    expect(scored.find((e) => e.id === "e1")?.score).toBe(500);
    expect(scored.find((e) => e.id === "e2")?.score).toBe(-100);
  });

  it("defaults to 0 for users with no positions", () => {
    const now = new Date();
    const entries = [{ id: "e1", userId: "u1", createdAt: now }];
    const scored = scorePnlEntries(entries, new Map());
    expect(scored[0].score).toBe(0);
  });

  it("handles negative P&L", () => {
    const now = new Date();
    const entries = [{ id: "e1", userId: "u1", createdAt: now }];
    const pnlByUser = new Map([["u1", -300]]);
    const scored = scorePnlEntries(entries, pnlByUser);
    expect(scored[0].score).toBe(-300);
  });

  it("handles empty entries", () => {
    const scored = scorePnlEntries([], new Map());
    expect(scored).toEqual([]);
  });
});
