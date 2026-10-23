// Row schemas and readers shared by the Experiments screens.
import { z } from "zod";
import {
  climberRestGetAll,
  type getClimberSupabaseConfig,
} from "@/server/lib/climberSupabase";
import { ENGINE_STATUSES } from "@/types/schemas/experiments";
import { bandTone, daysBetween, lift, sizeTier } from "./climberMath";

export type Config = NonNullable<
  Awaited<ReturnType<typeof getClimberSupabaseConfig>>
>;

export const num = z.coerce.number();
export const optNum = z.number().nullable().optional();

export const today = () => new Date().toISOString().slice(0, 10);

// ── Experiment rows ─────────────────────────────────────────────────────────

const batchEmbed = z
  .object({
    agent: z.string(),
    playbook: z.string(),
    page_family: z.string(),
    market: z.string().nullable(),
    change_class: z.string(),
    change_category: z.string(),
    hypothesis: z.string().nullable(),
  })
  .nullable();

const clusterEmbed = z
  .object({
    base_handle: z.string().nullable(),
    resource_type: z.string().nullable(),
    title: z.string().nullable(),
    market: z.string().nullable(),
  })
  .nullable();

export const listRowSchema = z.object({
  id: z.number(),
  url: z.string(),
  host: z.string().nullable(),
  fix_type: z.string().nullable(),
  status: z.enum(ENGINE_STATUSES),
  verdict: z.string().nullable(),
  applied_at: z.string().nullable(),
  judge_at: z.string().nullable(),
  decided_by: z.string().nullable(),
  decided_at: z.string().nullable(),
  decision_reason: z.string().nullable(),
  cluster_id: z.number(),
  batch_id: z.number(),
  baseline_clicks: optNum,
  clicks_28d: optNum,
  effect: optNum,
  lo90: optNum,
  hi90: optNum,
  measurable: z.boolean().nullable().optional(),
  look: optNum,
  clicks_gained: optNum,
  harm: z.string().nullable().optional(),
  batch: batchEmbed,
  cluster: clusterEmbed,
});

export const LIST_COLUMNS = [
  "id,url,host,fix_type,status,verdict,applied_at,judge_at,decided_by,decided_at,decision_reason",
  "cluster_id,batch_id,baseline_clicks,clicks_28d:baseline->clicks_28d",
  "effect:result->effect,lo90:result->lo90,hi90:result->hi90,measurable:result->measurable",
  "look:result->look,clicks_gained:result->clicks_gained,harm:result->>harm",
  "batch:seo_experiment_batches(agent,playbook,page_family,market,change_class,change_category,hypothesis)",
  "cluster:page_clusters(base_handle,resource_type,title,market)",
].join(",");

export function toListItem(row: z.infer<typeof listRowSchema>) {
  const lo = lift(row.lo90);
  const hi = lift(row.hi90);
  return {
    id: row.id,
    url: row.url,
    host: row.host,
    title: row.cluster?.title ?? row.cluster?.base_handle ?? row.url,
    pageType: row.cluster?.resource_type ?? null,
    market: row.batch?.market ?? row.cluster?.market ?? null,
    agent: row.batch?.agent ?? null,
    playbook: row.batch?.playbook ?? null,
    fixType: row.fix_type,
    changeClass: row.batch?.change_class ?? null,
    category: row.batch?.change_category ?? null,
    batchId: row.batch_id,
    status: row.status,
    verdict: row.verdict,
    appliedAt: row.applied_at,
    judgeAt: row.judge_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
    day: row.applied_at
      ? daysBetween(row.applied_at.slice(0, 10), today())
      : null,
    clicks28d: row.clicks_28d ?? null,
    tier: sizeTier(row.clicks_28d ?? null),
    lift: lift(row.effect),
    lo: lo,
    hi: hi,
    tone: row.measurable ? bandTone(lo, hi) : ("neutral" as const),
    measurable: row.measurable ?? false,
    look: row.look ?? null,
    clicksGained: row.clicks_gained ?? null,
    harm: row.harm ?? null,
  };
}

export async function readEngineExperiments(config: Config) {
  const rows = await climberRestGetAll(
    config,
    `seo_experiments?select=${LIST_COLUMNS}&source=eq.climber&order=id.desc`,
    listRowSchema,
  );
  return rows.map(toListItem);
}

export const scoreboardSchema = z.object({
  playbook: z.string(),
  agent: z.string(),
  fix_type: z.string(),
  page_family: z.string(),
  batches: z.number(),
  clusters: z.number(),
  wins: z.number(),
  losses: z.number(),
  grey: z.number(),
  flat_kept: z.number(),
  too_small: z.number(),
  judged: z.number(),
  uplift: num.nullable(),
  uplift_lo90: num.nullable(),
  uplift_hi90: num.nullable(),
  clicks_gained: num.nullable(),
  clicks_gained_lo90: num.nullable(),
  clicks_gained_hi90: num.nullable(),
  wins_beyond_chance: num.nullable(),
  proven: z.boolean(),
});

export const decisionSchema = z.object({
  id: z.number(),
  at: z.string(),
  experiment_id: z.number().nullable(),
  batch_id: z.number().nullable(),
  category: z.string().nullable(),
  actor: z.string(),
  action: z.string(),
  from_status: z.string().nullable(),
  to_status: z.string().nullable(),
  reason: z.string().nullable(),
});

export function toDecision(r: z.infer<typeof decisionSchema>) {
  return {
    id: r.id,
    at: r.at,
    experimentId: r.experiment_id,
    batchId: r.batch_id,
    category: r.category,
    actor: r.actor,
    action: r.action,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    reason: r.reason,
  };
}
