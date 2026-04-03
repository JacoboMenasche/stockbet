import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateVerificationToken,
} from "../auth-utils";

describe("hashPassword", () => {
  it("returns a string different from the input", async () => {
    const hash = await hashPassword("mypassword");
    expect(hash).not.toBe("mypassword");
    expect(typeof hash).toBe("string");
  });

  it("produces different hashes for the same password", async () => {
    const hash1 = await hashPassword("mypassword");
    const hash2 = await hashPassword("mypassword");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for a correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("generateVerificationToken", () => {
  it("returns a non-empty string", () => {
    const token = generateVerificationToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("returns a unique token each call", () => {
    const t1 = generateVerificationToken();
    const t2 = generateVerificationToken();
    expect(t1).not.toBe(t2);
  });
});
