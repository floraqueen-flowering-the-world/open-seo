import { describe, expect, it } from "vitest";
import { computeExperimentImpact } from "./experimentImpact";

const CHANGE = "2026-08-01";

function series(postClicks: number) {
  const rows = [];
  for (let day = -28; day <= 34; day++) {
    const date = new Date(Date.parse(`${CHANGE}T00:00:00Z`) + day * 86_400_000)
      .toISOString()
      .slice(0, 10);
    // Pre-period noise so the band has a width; the control stays flat.
    const pre = 10 + (day % 2 === 0 ? 1 : -1);
    rows.push({
      date,
      treatmentClicks: day < 0 ? pre : postClicks,
      controlClicks: 100,
    });
  }
  return rows;
}

describe("computeExperimentImpact", () => {
  it("calls a win only when the whole band clears zero", () => {
    const impact = computeExperimentImpact(series(20), CHANGE);
    expect(impact.verdict).toBe("win");
    expect(impact.upliftPct).toBeCloseTo(100, 0);
    expect(impact.upliftLowPct).toBeGreaterThan(0);
  });

  it("calls an unchanged page flat", () => {
    expect(computeExperimentImpact(series(10), CHANGE).verdict).toBe("flat");
  });

  it("refuses to judge a page with too few clicks before the change", () => {
    const rows = series(10).map((r) => ({ ...r, treatmentClicks: 0 }));
    expect(computeExperimentImpact(rows, CHANGE).verdict).toBe("too_small");
  });
});
