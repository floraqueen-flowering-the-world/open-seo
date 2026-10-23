// Read-side maths for the Experiments area. The judge itself runs in Climber
// (Trigger.dev) and stores its numbers on each row; this file only turns
// stored numbers into what the screens show: relative lifts from log effects,
// the page-vs-peers series, the per-domain split, the program tiles.

import { sortBy } from "remeda";
import type { SizeTier } from "@/types/schemas/experiments";

const DAY = 86_400_000;
export const PRE_DAYS = 56; // the judge's pre-period
export const POST_FROM = 7; // Google needs about a week to recrawl
export const POST_TO = 62; // the last day the day-56 look reads
export const MIN_PRE_CLICKS = 30; // in the pre-period, to judge one page alone
export const MIN_PEERS = 8;
const DOMAIN_DAYS = 28;
const PLACEBO_NIGHTS = 7;
export const PLACEBO_NOMINAL = 0.1; // share called win or loss at a 90% band

export type Tone = "good" | "bad" | "neutral";

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );
}

/** The judge stores log ratios; screens show relative change (0.1 = +10%). */
export function lift(logEffect: number | null | undefined) {
  return logEffect === null ||
    logEffect === undefined ||
    !Number.isFinite(logEffect)
    ? null
    : Math.exp(logEffect) - 1;
}

/** Three-colour rule: the whole band above zero is good, below zero bad. */
export function bandTone(lo: number | null, hi: number | null): Tone {
  if (lo !== null && lo > 0) return "good";
  if (hi !== null && hi < 0) return "bad";
  return "neutral";
}

export function sizeTier(clicks28d: number | null): SizeTier {
  if (clicks28d === null || clicks28d < 10) return "T0";
  return clicks28d < 100 ? "T1" : "T2";
}

// ── Page vs natural peers ───────────────────────────────────────────────────

type ClusterDay = { cluster_id: number; date: string; clicks: number };

type SeriesPoint = {
  date: string;
  day: number;
  page: number;
  peers: number | null;
  page7: number | null;
  peers7: number | null;
};

/**
 * Daily clicks of the changed cluster and of its peers summed, the peers
 * scaled to the cluster's own pre-period level (so before the change the two
 * lines sit together and any gap after it is the change, or noise). The 7-day
 * averages are what the chart draws; single days at these sizes are mostly 0s
 * and 1s.
 */
export function peerSeries(
  rows: ClusterDay[],
  clusterId: number,
  peerIds: number[],
  changeDate: string,
  lastDay: string,
) {
  const peerSet = new Set(peerIds);
  const page = new Map<string, number>();
  const peers = new Map<string, number>();
  for (const row of rows) {
    if (row.cluster_id === clusterId) {
      page.set(row.date, (page.get(row.date) ?? 0) + row.clicks);
    } else if (peerSet.has(row.cluster_id)) {
      peers.set(row.date, (peers.get(row.date) ?? 0) + row.clicks);
    }
  }
  const start = addDays(changeDate, -PRE_DAYS);
  const dates: string[] = [];
  for (let d = start; d <= lastDay && dates.length < 200; d = addDays(d, 1)) {
    dates.push(d);
  }
  const pre = dates.filter((d) => d < changeDate);
  const prePage = pre.reduce((a, d) => a + (page.get(d) ?? 0), 0);
  const prePeers = pre.reduce((a, d) => a + (peers.get(d) ?? 0), 0);
  const scale = prePeers > 0 ? prePage / prePeers : null;

  const raw = dates.map((date) => ({
    date,
    day: daysBetween(changeDate, date),
    page: page.get(date) ?? 0,
    peers: scale === null ? null : (peers.get(date) ?? 0) * scale,
  }));
  const points: SeriesPoint[] = raw.map((point, i) => {
    const week = raw.slice(Math.max(0, i - 6), i + 1);
    const full = week.length === 7;
    return {
      ...point,
      peers: point.peers === null ? null : round1(point.peers),
      page7: full ? round1(week.reduce((a, p) => a + p.page, 0) / 7) : null,
      peers7:
        full && scale !== null
          ? round1(week.reduce((a, p) => a + (p.peers ?? 0), 0) / 7)
          : null,
    };
  });
  return { points, prePageClicks: prePage, prePeerClicks: prePeers, scale };
}

// ── The same page on every domain ───────────────────────────────────────────

type ClusterUrl = { url: string; host: string; locale: string | null };
type GscDay = {
  page: string;
  date: string;
  clicks: number;
  impressions: number;
};

/**
 * Clicks per domain, 28 days before the change against days 7 to 34 after it
 * (or as many as Search Console has so far, scaled to 28 days).
 */
export function domainBreakdown(
  urls: ClusterUrl[],
  rows: GscDay[],
  changeDate: string,
  lastDay: string,
) {
  const hostOf = new Map(urls.map((u) => [u.url, u.host]));
  const postStart = addDays(changeDate, POST_FROM);
  const postEnd = addDays(changeDate, POST_FROM + DOMAIN_DAYS - 1);
  const preStart = addDays(changeDate, -DOMAIN_DAYS);
  const end = postEnd < lastDay ? postEnd : lastDay;
  const postDays = Math.max(0, daysBetween(postStart, end) + 1);

  const byHost = new Map<
    string,
    {
      host: string;
      urls: number;
      preClicks: number;
      postClicks: number;
      preImpressions: number;
      postImpressions: number;
    }
  >();
  for (const u of urls) {
    const entry = byHost.get(u.host) ?? {
      host: u.host,
      urls: 0,
      preClicks: 0,
      postClicks: 0,
      preImpressions: 0,
      postImpressions: 0,
    };
    entry.urls += 1;
    byHost.set(u.host, entry);
  }
  for (const row of rows) {
    const host = hostOf.get(row.page);
    const entry = host ? byHost.get(host) : undefined;
    if (!entry) continue;
    if (row.date >= preStart && row.date < changeDate) {
      entry.preClicks += row.clicks;
      entry.preImpressions += row.impressions;
    } else if (row.date >= postStart && row.date <= end) {
      entry.postClicks += row.clicks;
      entry.postImpressions += row.impressions;
    }
  }
  const per28 = (value: number) =>
    postDays > 0 ? (value / postDays) * DOMAIN_DAYS : 0;
  return {
    postDays,
    domains: sortBy(
      [...byHost.values()].map((d) => ({
        ...d,
        postClicks28: round1(per28(d.postClicks)),
        postImpressions28: Math.round(per28(d.postImpressions)),
        change:
          postDays > 0 && d.preClicks > 0
            ? per28(d.postClicks) / d.preClicks - 1
            : null,
      })),
      [(d) => d.preClicks + d.postClicks, "desc"],
    ),
  };
}

// ── Program tiles ───────────────────────────────────────────────────────────

type ProgramExperiment = {
  status: string;
  verdict: string | null;
  decidedAt: string | null;
};

type PlaceboNight = {
  night: string;
  n: number;
  false_win: number;
  false_loss: number;
};

const DECIDED = ["kept", "reverted", "review", "too_small", "invalid"];
const JUDGED_VERDICTS = ["win", "loss", "flat", "grey"];

function weekStart(date: string) {
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay();
  return addDays(date.slice(0, 10), -((day + 6) % 7));
}

export function summarizeProgram(
  experiments: ProgramExperiment[],
  placebo: PlaceboNight[],
  today: string,
  weeks = 8,
) {
  const count = (pred: (e: ProgramExperiment) => boolean) =>
    experiments.filter(pred).length;
  const decided = experiments.filter(
    (e) => DECIDED.includes(e.status) && e.decidedAt,
  );
  const judged = decided.filter(
    (e) => e.verdict !== null && JUDGED_VERDICTS.includes(e.verdict),
  );
  const wins = judged.filter((e) => e.verdict === "win").length;

  const thisWeek = weekStart(today);
  const series = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const inWeek = decided.filter(
      (e) => e.decidedAt && weekStart(e.decidedAt) === start,
    );
    const by = (pred: (e: ProgramExperiment) => boolean) =>
      inWeek.filter(pred).length;
    return {
      week: start,
      won: by((e) => e.status === "kept" && e.verdict === "win"),
      kept: by((e) => e.status === "kept" && e.verdict !== "win"),
      reverted: by((e) => e.status === "reverted"),
      review: by((e) => e.status === "review"),
      tooSmall: by((e) => e.status === "too_small" || e.status === "invalid"),
    };
  });

  const nights = sortBy(placebo, [(r) => r.night, "desc"]).slice(
    0,
    PLACEBO_NIGHTS,
  );
  const placeboN = nights.reduce((a, r) => a + r.n, 0);
  const placeboCalls = nights.reduce(
    (a, r) => a + r.false_win + r.false_loss,
    0,
  );

  return {
    total: experiments.length,
    live: count((e) => e.status === "live"),
    measuring: count(
      (e) => e.status === "measuring" || e.status === "extended",
    ),
    queued: count((e) => e.status === "proposed" || e.status === "approved"),
    review: count((e) => e.status === "review"),
    kept: count((e) => e.status === "kept"),
    reverted: count((e) => e.status === "reverted"),
    harm: count((e) => e.verdict === "harm"),
    judged: judged.length,
    wins,
    winRate: judged.length ? wins / judged.length : null,
    // Spotify's learning rate: decided with a readable answer, over all decided.
    learningRate: decided.length ? judged.length / decided.length : null,
    weekly: series,
    placebo: {
      nights: nights.length,
      n: placeboN,
      falseCalls: placeboCalls,
      rate: placeboN ? placeboCalls / placeboN : null,
    },
  };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
