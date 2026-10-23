// The scorecard's metric table: the primary metric (clicks vs natural peers)
// first, then guardrails that must not get worse, then the mechanism.
import { bandTone, lift, type Tone } from "./climberMath";

const IMPRESSIONS_FLOOR = -0.35; // guardrail: impressions vs peers
const POSITION_CEILING = 3; // guardrail: positions worse than peers

// ── Metrics: primary, guardrails, mechanism ─────────────────────────────────

type JudgeResult = {
  effect?: number | null;
  lo90?: number | null;
  hi90?: number | null;
  lo99?: number | null;
  hi99?: number | null;
  measurable?: boolean;
  peers?: number;
  peer_group?: string;
  pre_clicks?: number;
  post_clicks?: number;
  expected_clicks?: number;
  clicks_gained?: number;
  clicks_gained_lo90?: number;
  clicks_gained_hi90?: number;
  impr_effect?: number | null;
  pos_delta_vs_peers?: number | null;
  ctr_index_pre?: number | null;
  ctr_index_post?: number | null;
  look?: number;
  post_to?: number;
  last_day?: string;
  harm?: string;
  group?: {
    effect: number;
    lo90: number | null;
    hi90: number | null;
    clusters: number;
  } | null;
};

type MetricRow = {
  role: "primary" | "guardrail" | "mechanism";
  metric: string;
  before: string;
  after: string;
  reference: string;
  lift: number | null;
  lo: number | null;
  hi: number | null;
  tone: Tone;
  note: string;
};

type Behaviour = {
  before: { sessions: number; orders: number };
  after: { sessions: number; orders: number };
} | null;

// Spanish number format, as everywhere in the Climber screens.
const fmt = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);

export function metricRows(
  result: JudgeResult | null,
  behaviour: Behaviour,
): MetricRow[] {
  const r = result ?? {};
  const rows: MetricRow[] = [];
  const lo90 = lift(r.lo90);
  const hi90 = lift(r.hi90);
  rows.push({
    role: "primary",
    metric: "Clicks (all domains)",
    before: fmt(r.pre_clicks),
    after: fmt(r.post_clicks),
    reference: `${fmt(r.expected_clicks)} expected from peers`,
    lift: lift(r.effect),
    lo: lo90,
    hi: hi90,
    tone: r.measurable ? bandTone(lo90, hi90) : "neutral",
    note: r.measurable
      ? "90% band from the natural peers' own spread"
      : "Too few clicks or peers to judge this page alone",
  });
  if (r.group) {
    const glo = lift(r.group.lo90);
    const ghi = lift(r.group.hi90);
    rows.push({
      role: "primary",
      metric: `Clicks, whole batch (${r.group.clusters} pages)`,
      before: "—",
      after: "—",
      reference: "union of their peers",
      lift: lift(r.group.effect),
      lo: glo,
      hi: ghi,
      tone: bandTone(glo, ghi),
      note: "Bootstrap band over the batch's pages",
    });
  }
  const impressions = lift(r.impr_effect);
  rows.push({
    role: "guardrail",
    metric: "Impressions vs peers",
    before: "—",
    after: "—",
    reference: "peers' change",
    lift: impressions,
    lo: null,
    hi: null,
    tone:
      impressions !== null && impressions < IMPRESSIONS_FLOOR
        ? "bad"
        : "neutral",
    note: `Fails below ${Math.round(IMPRESSIONS_FLOOR * 100)}%`,
  });
  const pos = r.pos_delta_vs_peers ?? null;
  rows.push({
    role: "guardrail",
    metric: "Average position vs peers",
    before: "—",
    after: pos === null ? "—" : `${pos > 0 ? "+" : ""}${fmt(pos, 1)} positions`,
    reference: "peers' median move",
    lift: null,
    lo: null,
    hi: null,
    tone: pos !== null && pos >= POSITION_CEILING ? "bad" : "neutral",
    note: `Plus is worse. Fails at +${POSITION_CEILING} or more`,
  });
  if (behaviour) {
    const lostOrders =
      behaviour.before.orders >= 3 && behaviour.after.orders === 0;
    rows.push({
      role: "guardrail",
      metric: "Orders (PostHog, 28 days)",
      before: fmt(behaviour.before.orders),
      after: fmt(behaviour.after.orders),
      reference: "same page, before",
      lift:
        behaviour.before.orders > 0
          ? behaviour.after.orders / behaviour.before.orders - 1
          : null,
      lo: null,
      hi: null,
      tone: lostOrders ? "bad" : "neutral",
      note: "Fails when 3+ orders drop to 0",
    });
    rows.push({
      role: "guardrail",
      metric: "Organic sessions (PostHog, 28 days)",
      before: fmt(behaviour.before.sessions),
      after: fmt(behaviour.after.sessions),
      reference: "same page, before",
      lift:
        behaviour.before.sessions > 0
          ? behaviour.after.sessions / behaviour.before.sessions - 1
          : null,
      lo: null,
      hi: null,
      tone: "neutral",
      note: "Not compared with peers",
    });
  }
  const ctrPre = r.ctr_index_pre ?? null;
  const ctrPost = r.ctr_index_post ?? null;
  rows.push({
    role: "mechanism",
    metric: "CTR at its position",
    before: fmt(ctrPre, 2),
    after: fmt(ctrPost, 2),
    reference: "1,00 = what pages at that position get",
    lift: ctrPre && ctrPost !== null ? ctrPost / ctrPre - 1 : null,
    lo: null,
    hi: null,
    tone: "neutral",
    note: "Explains a click change, never decides",
  });
  return rows;
}
