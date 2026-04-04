import { describe, it, expect } from "vitest";
import { ammCost, ammNewPrices, SENSITIVITY } from "@/lib/amm";

describe("ammCost", () => {
  it("200 shares at price 50 → 10500 cents", () => {
    // 200*50 + 200²/80 = 10000 + 500 = 10500
    expect(ammCost(200, 50)).toBe(10_500);
  });

  it("10 shares at price 50 → 501 cents (minimal slippage)", () => {
    // 10*50 + 100/80 = 500 + 1 = 501
    expect(ammCost(10, 50)).toBe(501);
  });

  it("cost increases with shares due to slippage", () => {
    expect(ammCost(200, 50)).toBeGreaterThan(200 * 50);
  });
});

describe("ammNewPrices", () => {
  it("buying YES raises yesPriceLatest by floor(shares/SENSITIVITY)", () => {
    const result = ammNewPrices(200, 50, "YES");
    expect(result.yesPriceLatest).toBe(55); // 50 + floor(200/40)
    expect(result.noPriceLatest).toBe(45);  // 100 - 55
  });

  it("buying NO raises noPriceLatest and lowers yesPriceLatest", () => {
    const result = ammNewPrices(200, 50, "NO");
    expect(result.noPriceLatest).toBe(55);
    expect(result.yesPriceLatest).toBe(45);
  });

  it("clamps YES price at 99", () => {
    const result = ammNewPrices(400, 97, "YES");
    expect(result.yesPriceLatest).toBe(99);
    expect(result.noPriceLatest).toBe(1);
  });

  it("clamps NO price at 99", () => {
    const result = ammNewPrices(400, 3, "NO");
    expect(result.noPriceLatest).toBe(99);
    expect(result.yesPriceLatest).toBe(1);
  });

  it("prices always sum to 100", () => {
    const cases = [
      ammNewPrices(10, 50, "YES"),
      ammNewPrices(10, 50, "NO"),
      ammNewPrices(400, 97, "YES"),
      ammNewPrices(400, 3, "NO"),
    ];
    for (const { yesPriceLatest, noPriceLatest } of cases) {
      expect(yesPriceLatest + noPriceLatest).toBe(100);
    }
  });
});
