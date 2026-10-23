// One experiment's scorecard: the judge's stored numbers, the page against
// its natural peers day by day, the same page on each domain, health checks,
// the field diff, snapshots and decisions.
import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import {
  climberRestGet,
  climberRestGetAll,
  getClimberSupabaseConfig,
  inList,
} from "@/server/lib/climberSupabase";
import {
  MIN_PEERS,
  MIN_PRE_CLICKS,
  POST_FROM,
  POST_TO,
  PRE_DAYS,
  addDays,
  daysBetween,
  domainBreakdown,
  peerSeries,
} from "./climberMath";
import { metricRows } from "./climberMetrics";
import {
  type Config,
  LIST_COLUMNS,
  decisionSchema,
  listRowSchema,
  optNum,
  toDecision,
  toListItem,
  today,
} from "./climberRows";

const json = z.unknown();

// ── Scorecard ───────────────────────────────────────────────────────────────

const fullRowSchema = listRowSchema.extend({
  locale: z.string().nullable(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  peer_cluster_ids: z.array(z.number()).nullable(),
  peer_cohort_key: z.string().nullable(),
  baseline: json,
  result: json,
});

const snapshotSchema = z.object({
  phase: z.string(),
  object_kind: z.string(),
  r2_key: z.string(),
  sha256: z.string(),
  bytes: z.number(),
  gz_bytes: z.number().nullable(),
  touched_fields: z.array(z.string()),
  created_at: z.string(),
});

const clusterDaySchema = z.object({
  cluster_id: z.number(),
  date: z.string(),
  clicks: z.number(),
});

const clusterUrlSchema = z.object({
  url: z.string(),
  host: z.string(),
  locale: z.string().nullable(),
  live: z.boolean(),
});

const gscDaySchema = z.object({
  page: z.string(),
  date: z.string(),
  clicks: z.number(),
  impressions: z.number(),
});

const behaviourSchema = z.object({
  date: z.string(),
  organic_sessions: z.number(),
  orders: z.number(),
});

const resultSchema = z
  .object({
    effect: optNum,
    lo90: optNum,
    hi90: optNum,
    lo99: optNum,
    hi99: optNum,
    measurable: z.boolean().optional(),
    peers: z.number().optional(),
    peer_group: z.string().optional(),
    pre_clicks: z.number().optional(),
    post_clicks: z.number().optional(),
    expected_clicks: z.number().optional(),
    clicks_gained: z.number().optional(),
    clicks_gained_lo90: z.number().optional(),
    clicks_gained_hi90: z.number().optional(),
    impr_effect: optNum,
    pos_delta_vs_peers: optNum,
    ctr_index_pre: optNum,
    ctr_index_post: optNum,
    look: z.number().optional(),
    post_to: z.number().optional(),
    last_day: z.string().optional(),
    harm: z.string().optional(),
    group: z
      .object({
        effect: z.number(),
        lo90: z.number().nullable(),
        hi90: z.number().nullable(),
        clusters: z.number(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const baselineSchema = z
  .object({
    pre_clicks: z.number().optional(),
    clicks_28d: z.number().optional(),
    why: z.string().optional(),
  })
  .passthrough();

const fieldsSchema = z.record(z.string(), z.unknown());

function parseFields(value: string | null) {
  if (!value) return null;
  try {
    const parsed = fieldsSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function showField(value: unknown) {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Old and new values are JSON objects of fields; show them field by field. */
function fieldDiff(oldValue: string | null, newValue: string | null) {
  const before = parseFields(oldValue);
  const after = parseFields(newValue);
  if (!before || !after) {
    return [{ field: "value", before: oldValue, after: newValue }];
  }
  return [...new Set([...Object.keys(after), ...Object.keys(before)])].map(
    (field) => ({
      field,
      before: showField(before[field]),
      after: showField(after[field]),
    }),
  );
}

type ClusterUrl = z.infer<typeof clusterUrlSchema>;

/** Clicks around the change: cluster vs peers, per domain, PostHog orders. */
async function loadAroundChange(
  config: Config,
  {
    clusterId,
    peers,
    urls,
    changeDate,
    lastDay,
  }: {
    clusterId: number;
    peers: number[];
    urls: ClusterUrl[];
    changeDate: string;
    lastDay: string;
  },
) {
  const from = addDays(changeDate, -PRE_DAYS);
  const to = addDays(changeDate, POST_TO);
  const gscFrom = addDays(changeDate, -28);
  const pages = urls.map((u) => u.url);
  const bare = pages.map((p) => p.replace(/^https?:\/\//, ""));
  const [daily, gsc, posthog] = await Promise.all([
    climberRestGetAll(
      config,
      `seo_cluster_daily?select=cluster_id,date,clicks&cluster_id=${inList([clusterId, ...peers])}&date=gte.${from}&date=lte.${to}&order=cluster_id.asc,date.asc`,
      clusterDaySchema,
    ),
    pages.length
      ? climberRestGetAll(
          config,
          `seo_gsc_daily?select=page,date,clicks,impressions&page=${inList(pages)}&date=gte.${gscFrom}&date=lte.${to}&order=page.asc,date.asc`,
          gscDaySchema,
        )
      : Promise.resolve([]),
    pages.length
      ? climberRestGetAll(
          config,
          `seo_behaviour_daily?select=date,organic_sessions,orders&page=${inList(bare)}&date=gte.${gscFrom}&order=date.asc`,
          behaviourSchema,
        )
      : Promise.resolve([]),
  ]);
  const postStart = addDays(changeDate, POST_FROM);
  const postEnd = addDays(postStart, 28);
  const sumOf = (pred: (d: string) => boolean) =>
    posthog
      .filter((p) => pred(p.date))
      .reduce(
        (a, p) => ({
          sessions: a.sessions + p.organic_sessions,
          orders: a.orders + p.orders,
        }),
        { sessions: 0, orders: 0 },
      );
  return {
    series: peerSeries(
      daily,
      clusterId,
      peers,
      changeDate,
      lastDay < to ? lastDay : to,
    ),
    domains: domainBreakdown(urls, gsc, changeDate, lastDay),
    behaviour: posthog.length
      ? {
          before: sumOf((d) => d < changeDate),
          after: sumOf((d) => d >= postStart && d < postEnd),
        }
      : null,
  };
}

type HealthInput = {
  changeDate: string | null;
  lastDay: string;
  isRedirect: boolean;
  snapshotSha: string | null;
  harm: string | null;
  preClicks: number;
  peers: number;
  peerGroup: string | null;
  overlapping: number[];
};

function snapshotDetail(input: HealthInput) {
  if (input.isRedirect) {
    return "Redirect: reverting deletes it, no snapshot needed";
  }
  if (input.snapshotSha) {
    return `R2 snapshot, sha256 ${input.snapshotSha.slice(0, 12)}…`;
  }
  return input.changeDate ? "No snapshot pointer found" : "Not written yet";
}

function healthChecks(input: HealthInput) {
  const day = input.changeDate
    ? daysBetween(input.changeDate, input.lastDay)
    : null;
  return [
    {
      check: "Old value saved before the write",
      ok: input.isRedirect || !input.changeDate || input.snapshotSha !== null,
      detail: snapshotDetail(input),
    },
    {
      check: "Page is healthy",
      ok: !input.harm,
      detail: input.harm ?? "No 404, noindex, raw token or orders drop seen",
    },
    {
      check: "Enough clicks to judge alone",
      ok: input.preClicks >= MIN_PRE_CLICKS,
      detail: `${input.preClicks} clicks in the ${PRE_DAYS} days before (needs ${MIN_PRE_CLICKS}, else its batch decides)`,
    },
    {
      check: "Natural peers found",
      ok: input.peers >= MIN_PEERS,
      detail: `${input.peers} untouched pages, group ${input.peerGroup ?? "not picked yet"}`,
    },
    {
      check: "No other change on this page",
      ok: input.overlapping.length === 0,
      detail: input.overlapping.length
        ? `Also changed: ${input.overlapping.map((id) => `#${id}`).join(", ")}`
        : "Only this change in the judge's window",
    },
    {
      check: "Search Console data is fresh",
      ok: daysBetween(input.lastDay, today()) <= 4,
      detail: `Data to ${input.lastDay}${day !== null && day >= 0 ? `, day ${day} after the change` : ""}`,
    },
  ];
}

export async function getScorecard(experimentId: number) {
  const config = await getClimberSupabaseConfig();
  if (!config) return null;
  const [row] = await climberRestGet(
    config,
    `seo_experiments?select=${LIST_COLUMNS},locale,old_value,new_value,peer_cluster_ids,peer_cohort_key,baseline,result&id=eq.${experimentId}&source=eq.climber`,
    fullRowSchema,
  );
  if (!row) throw new AppError("NOT_FOUND", "Experiment not found");

  const result = resultSchema.nullable().catch(null).parse(row.result);
  const baseline = baselineSchema.nullable().catch(null).parse(row.baseline);
  const changeDate = row.applied_at?.slice(0, 10) ?? null;
  const peers = row.peer_cluster_ids ?? [];

  const [decisions, snapshots, urls, others, lastDays] = await Promise.all([
    climberRestGet(
      config,
      `seo_decisions?select=id,at,experiment_id,batch_id,category,actor,action,from_status,to_status,reason&or=(experiment_id.eq.${row.id},and(batch_id.eq.${row.batch_id},experiment_id.is.null))&order=at.asc&limit=200`,
      decisionSchema,
    ),
    climberRestGet(
      config,
      `seo_snapshots?select=phase,object_kind,r2_key,sha256,bytes,gz_bytes,touched_fields,created_at&experiment_id=eq.${row.id}&order=id.asc`,
      snapshotSchema,
    ),
    climberRestGet(
      config,
      `page_cluster_urls?select=url,host,locale,live&cluster_id=eq.${row.cluster_id}&order=url.asc`,
      clusterUrlSchema,
    ),
    climberRestGet(
      config,
      `seo_experiments?select=id,applied_at&cluster_id=eq.${row.cluster_id}&id=neq.${row.id}&applied_at=not.is.null&order=applied_at.desc&limit=20`,
      z.object({ id: z.number(), applied_at: z.string() }),
    ),
    climberRestGet(
      config,
      "seo_cluster_daily?select=date&order=date.desc&limit=1",
      z.object({ date: z.string() }),
    ),
  ]);
  const lastDay = lastDays[0]?.date ?? today();
  const around = changeDate
    ? await loadAroundChange(config, {
        clusterId: row.cluster_id,
        peers,
        urls,
        changeDate,
        lastDay,
      })
    : null;
  const overlapping = changeDate
    ? others
        .filter((o) => {
          const d = o.applied_at.slice(0, 10);
          return (
            d >= addDays(changeDate, -PRE_DAYS) &&
            d <= addDays(changeDate, POST_TO)
          );
        })
        .map((o) => o.id)
    : [];
  const before = snapshots.find((s) => s.phase === "before") ?? null;
  const gainedBand =
    result?.clicks_gained_lo90 !== undefined &&
    result.clicks_gained_hi90 !== undefined
      ? [result.clicks_gained_lo90, result.clicks_gained_hi90]
      : null;

  return {
    experiment: toListItem(row),
    locale: row.locale,
    why: baseline?.why ?? null,
    peerCount: peers.length,
    changeDate,
    lastDay,
    dayAfter: changeDate ? daysBetween(changeDate, lastDay) : null,
    fields: fieldDiff(row.old_value, row.new_value),
    metrics: metricRows(result, around?.behaviour ?? null),
    clicksGained: result?.clicks_gained ?? null,
    clicksGainedBand: gainedBand,
    series: around?.series ?? null,
    domains: around?.domains ?? null,
    health: healthChecks({
      changeDate,
      lastDay,
      isRedirect: row.batch?.change_category === "destructive:restore_404",
      snapshotSha: before?.sha256 ?? null,
      harm: result?.harm ?? null,
      preClicks: result?.pre_clicks ?? baseline?.pre_clicks ?? 0,
      peers: result?.peers ?? peers.length,
      peerGroup: row.peer_cohort_key,
      overlapping,
    }),
    snapshots,
    decisions: decisions.map(toDecision),
  };
}
