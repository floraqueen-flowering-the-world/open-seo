import { describe, expect, it } from "vitest";
import {
  addDays,
  domainBreakdown,
  peerSeries,
  summarizeProgram,
} from "./climberMath";
import { metricRows } from "./climberMetrics";

const CHANGE = "2026-09-01";

function days(
  from: number,
  to: number,
  clicks: (day: number) => number,
  clusterId: number,
) {
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    cluster_id: clusterId,
    date: addDays(CHANGE, from + i),
    clicks: clicks(from + i),
  }));
}

describe("peerSeries", () => {
  it("scales the peers to the page's own pre-period level", () => {
    const rows = [
      ...days(-56, 20, (d) => (d < 0 ? 2 : 4), 1),
      ...days(-56, 20, () => 10, 7),
      ...days(-56, 20, () => 10, 8),
      ...days(-56, 20, () => 99, 9), // not a peer
    ];
    const { points, scale } = peerSeries(
      rows,
      1,
      [7, 8],
      CHANGE,
      addDays(CHANGE, 20),
    );
    expect(scale).toBeCloseTo(0.1);
    const before = points.find((p) => p.day === -1);
    const after = points.find((p) => p.day === 20);
    expect(before).toMatchObject({ page7: 2, peers7: 2 });
    expect(after).toMatchObject({ page7: 4, peers7: 2 });
  });
});

describe("domainBreakdown", () => {
  it("sums each domain and scales a short post window to 28 days", () => {
    const urls = [
      {
        url: "https://www.floraqueen.es/collections/flores-madrid",
        host: "www.floraqueen.es",
        locale: "es",
      },
      {
        url: "https://www.floraqueen.com/collections/flowers-madrid",
        host: "www.floraqueen.com",
        locale: "en",
      },
    ];
    const gsc = [
      ...Array.from({ length: 28 }, (_, i) => ({
        page: urls[0].url,
        date: addDays(CHANGE, -28 + i),
        clicks: 1,
        impressions: 10,
      })),
      // 14 post days (7..20) at 2 a day = 28 clicks, scaled to 28 days = 56.
      ...Array.from({ length: 14 }, (_, i) => ({
        page: urls[0].url,
        date: addDays(CHANGE, 7 + i),
        clicks: 2,
        impressions: 10,
      })),
    ];
    const { postDays, domains } = domainBreakdown(
      urls,
      gsc,
      CHANGE,
      addDays(CHANGE, 20),
    );
    expect(postDays).toBe(14);
    expect(domains[0]).toMatchObject({
      host: "www.floraqueen.es",
      preClicks: 28,
      postClicks28: 56,
      change: 1,
    });
    expect(domains[1]).toMatchObject({
      host: "www.floraqueen.com",
      preClicks: 0,
      change: null,
    });
  });
});

describe("summarizeProgram", () => {
  it("counts the win rate over judged pages only and pools the last 7 placebo nights", () => {
    const decidedAt = "2026-10-20T03:00:00Z";
    const summary = summarizeProgram(
      [
        { status: "kept", verdict: "win", decidedAt },
        { status: "reverted", verdict: "loss", decidedAt },
        { status: "kept", verdict: "flat", decidedAt },
        { status: "too_small", verdict: "too_small", decidedAt },
        { status: "measuring", verdict: null, decidedAt: null },
      ],
      Array.from({ length: 9 }, (_, i) => ({
        night: addDays("2026-10-14", i),
        n: 100,
        // the two oldest nights are noisy and must fall out of the window
        false_win: i < 2 ? 50 : 5,
        false_loss: 5,
      })),
      "2026-10-23",
    );
    expect(summary.winRate).toBeCloseTo(1 / 3);
    expect(summary.learningRate).toBeCloseTo(3 / 4);
    expect(summary.placebo).toMatchObject({
      nights: 7,
      n: 700,
      falseCalls: 70,
    });
    expect(summary.weekly.at(-1)).toMatchObject({
      week: "2026-10-19",
      won: 1,
      kept: 1,
      reverted: 1,
      tooSmall: 1,
    });
  });
});

describe("metricRows", () => {
  it("colours the primary row by its band and fails the impressions guardrail below -35%", () => {
    const rows = metricRows(
      {
        measurable: true,
        effect: 0.2,
        lo90: 0.05,
        hi90: 0.35,
        impr_effect: Math.log(0.5),
      },
      null,
    );
    expect(rows[0]).toMatchObject({ role: "primary", tone: "good" });
    expect(rows[0]?.lift).toBeCloseTo(Math.exp(0.2) - 1);
    expect(rows.find((r) => r.metric === "Impressions vs peers")?.tone).toBe(
      "bad",
    );
  });

  it("never colours a page that is too small to judge alone", () => {
    const [primary] = metricRows(
      { measurable: false, effect: 1, lo90: 0.5, hi90: 1.5 },
      null,
    );
    expect(primary?.tone).toBe("neutral");
  });
});
