import { describe, expect, it } from "vitest";
import { formatChange, formatCompact, formatInt, formatRate } from "./format";

describe("Spanish number format", () => {
  it("groups 4-digit numbers with a dot", () => {
    expect(formatInt(5400)).toBe("5.400");
    expect(formatInt(31534)).toBe("31.534");
  });

  it("uses a comma for decimals", () => {
    expect(formatRate(0.0012)).toBe("0,12%");
    expect(formatChange(-0.041, 1)).toBe("−4,1%");
    expect(formatCompact(4_381_000)).toBe("4,38M");
  });
});
