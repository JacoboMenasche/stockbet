// src/lib/__tests__/sync-earnings.test.ts
import { describe, it, expect } from "vitest";
import { quarterLabel } from "@/lib/sync-earnings";

describe("quarterLabel", () => {
  it("January report → Q4 of prior year", () => {
    expect(quarterLabel(new Date("2026-01-15T00:00:00Z"))).toBe("Q4-2025");
  });

  it("March report → Q4 of prior year (boundary)", () => {
    expect(quarterLabel(new Date("2026-03-31T00:00:00Z"))).toBe("Q4-2025");
  });

  it("April report → Q1 of same year", () => {
    expect(quarterLabel(new Date("2026-04-16T00:00:00Z"))).toBe("Q1-2026");
  });

  it("June report → Q1 of same year (boundary)", () => {
    expect(quarterLabel(new Date("2026-06-30T00:00:00Z"))).toBe("Q1-2026");
  });

  it("July report → Q2 of same year", () => {
    expect(quarterLabel(new Date("2026-07-01T00:00:00Z"))).toBe("Q2-2026");
  });

  it("September report → Q2 of same year (boundary)", () => {
    expect(quarterLabel(new Date("2026-09-30T00:00:00Z"))).toBe("Q2-2026");
  });

  it("October report → Q3 of same year", () => {
    expect(quarterLabel(new Date("2026-10-01T00:00:00Z"))).toBe("Q3-2026");
  });

  it("December report → Q3 of same year (boundary)", () => {
    expect(quarterLabel(new Date("2026-12-31T00:00:00Z"))).toBe("Q3-2026");
  });
});
