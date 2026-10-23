// Before/after impact of one page change against its site control.
//
// Expected clicks on a day = control clicks x the page's pre-period share of
// control. The effect is actual minus expected over the post window (day +7
// on, so Google has recrawled). The band is +/-1.96 x the pre-period daily
// residual SD x sqrt(post days): a plain stand-in for CausalImpact's credible
// interval that ignores autocorrelation, so it reads optimistic.

type SeriesRow = {
  date: string;
  treatmentClicks: number;
  controlClicks: number;
};

type ImpactPoint = {
  date: string;
  day: number;
  actual: number;
  expected: number | null;
  band: [number, number] | null;
};

type ImpactVerdict = "win" | "loss" | "flat" | "too_early" | "too_small";

type ExperimentImpact = {
  points: ImpactPoint[];
  preClicks: number;
  postClicks: number;
  postDays: number;
  expectedClicks: number | null;
  upliftPct: number | null;
  upliftLowPct: number | null;
  upliftHighPct: number | null;
  verdict: ImpactVerdict;
};

const PRE_DAYS = 28;
const POST_START_DAY = 7;
const MIN_POST_DAYS = 7;
const MIN_PRE_CLICKS = 20;
const Z95 = 1.96;

function dayOffset(date: string, changeDate: string): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${changeDate}T00:00:00Z`)) /
      86_400_000,
  );
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function computeExperimentImpact(
  rows: SeriesRow[],
  changeDate: string,
): ExperimentImpact {
  const withDay = rows.map((row) => ({
    ...row,
    day: dayOffset(row.date, changeDate),
  }));
  const pre = withDay.filter((r) => r.day < 0 && r.day >= -PRE_DAYS);
  const post = withDay.filter((r) => r.day >= POST_START_DAY);

  const preClicks = sum(pre.map((r) => r.treatmentClicks));
  const preControl = sum(pre.map((r) => r.controlClicks));
  const ratio = preControl > 0 ? preClicks / preControl : null;

  const residuals =
    ratio === null
      ? []
      : pre.map((r) => r.treatmentClicks - r.controlClicks * ratio);
  const mean = residuals.length > 0 ? sum(residuals) / residuals.length : 0;
  const sd =
    residuals.length > 1
      ? Math.sqrt(
          sum(residuals.map((x) => (x - mean) ** 2)) / (residuals.length - 1),
        )
      : 0;

  const points: ImpactPoint[] = withDay.map((r) => {
    const expected = ratio === null ? null : r.controlClicks * ratio;
    return {
      date: r.date,
      day: r.day,
      actual: r.treatmentClicks,
      expected: expected === null ? null : round1(expected),
      band:
        expected === null || r.day < POST_START_DAY
          ? null
          : [
              round1(Math.max(0, expected - Z95 * sd)),
              round1(expected + Z95 * sd),
            ],
    };
  });

  const postClicks = sum(post.map((r) => r.treatmentClicks));
  const expectedClicks =
    ratio === null ? null : sum(post.map((r) => r.controlClicks * ratio));
  const base = {
    points,
    preClicks,
    postClicks,
    postDays: post.length,
    expectedClicks: expectedClicks === null ? null : round1(expectedClicks),
  };
  const none = { upliftPct: null, upliftLowPct: null, upliftHighPct: null };

  if (preClicks < MIN_PRE_CLICKS || !expectedClicks) {
    return { ...base, ...none, verdict: "too_small" };
  }
  if (post.length < MIN_POST_DAYS) {
    return { ...base, ...none, verdict: "too_early" };
  }

  const effect = postClicks - expectedClicks;
  const halfWidth = Z95 * sd * Math.sqrt(post.length);
  const low = effect - halfWidth;
  const high = effect + halfWidth;
  return {
    ...base,
    upliftPct: round1((effect / expectedClicks) * 100),
    upliftLowPct: round1((low / expectedClicks) * 100),
    upliftHighPct: round1((high / expectedClicks) * 100),
    verdict: low > 0 ? "win" : high < 0 ? "loss" : "flat",
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
