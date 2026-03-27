// src/sum.test.ts
import { describe, it, expect } from "vitest";
export const sum = (a: number, b: number) => a + b;
describe("sum", () => {
  it("adds numbers correctly", () => {
    expect(sum(1, 2)).toBe(3);
  });
});
