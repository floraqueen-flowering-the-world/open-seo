// Climber's experiment engine, read from its Supabase project over PostgREST.
// Delivery (Shopify writes, R2 snapshots, the judge, reverts) runs in Climber;
// this is the analysis view, joined to it by the experiment id. The one write
// is a change-category approval: Javier approves or blocks whole kinds of
// destructive change, never single pages.
//
// Not tenant data: the Climber deployment is one self-hosted workspace, so it
// is gated only by being signed in. One experiment = one page cluster (the
// same page on all five domains), so nothing here filters by project.
import { reverse, sortBy } from "remeda";
import { z } from "zod";
import {
  climberRestCount,
  climberRestGet,
  climberRestGetAll,
  getClimberSupabaseConfig,
} from "@/server/lib/climberSupabase";
import { getCategories, setCategoryApproval } from "./climberCategories";
import {
  PLACEBO_NOMINAL,
  bandTone,
  lift,
  summarizeProgram,
} from "./climberMath";
import {
  decisionSchema,
  num,
  optNum,
  readEngineExperiments,
  scoreboardSchema,
  toDecision,
  today,
} from "./climberRows";
import { getScorecard } from "./climberScorecard";

async function listExperiments() {
  const config = await getClimberSupabaseConfig();
  if (!config) return { configured: false as const, experiments: [] };
  return {
    configured: true as const,
    experiments: await readEngineExperiments(config),
  };
}

// ── Program ─────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  enabled: z.boolean(),
  paused_reason: z.string().nullable(),
  nightly_mode: z.string(),
  nightly_cap_total: z.number(),
  max_losses_7d: z.number(),
  placebo_max_rate: num,
  updated_by: z.string(),
  updated_at: z.string(),
});

const placeboSchema = z.object({
  night: z.string(),
  n: z.number(),
  false_win: z.number(),
  false_loss: z.number(),
});

const runSchema = z.object({
  id: z.number(),
  run_at: z.string(),
  mode: z.string(),
  summary: z
    .object({
      applied: z.number().optional(),
      picked: z.number().optional(),
      drafted: z.number().optional(),
      errors: z.array(z.string()).optional(),
    })
    .passthrough(),
});

function clicksGainedSe(row: z.infer<typeof scoreboardSchema>) {
  return row.clicks_gained_hi90 !== null && row.clicks_gained_lo90 !== null
    ? (row.clicks_gained_hi90 - row.clicks_gained_lo90) / (2 * 1.645)
    : 0;
}

async function getProgram() {
  const config = await getClimberSupabaseConfig();
  if (!config) return { configured: false as const };
  const [settings, placebo, scoreboard, runs, experiments] = await Promise.all([
    climberRestGet(config, "climber_settings?select=*", settingsSchema),
    climberRestGet(
      config,
      "climber_placebo_results?select=night,n,false_win,false_loss&order=night.desc&limit=30",
      placeboSchema,
    ),
    climberRestGet(config, "climber_scoreboard_v?select=*", scoreboardSchema),
    climberRestGet(
      config,
      "climber_nightly_runs?select=id,run_at,mode,summary&order=id.desc&limit=1",
      runSchema,
    ),
    readEngineExperiments(config),
  ]);
  const summary = summarizeProgram(
    experiments.map((e) => ({
      status: e.status,
      verdict: e.verdict,
      decidedAt: e.decidedAt,
    })),
    placebo,
    today(),
  );
  // Playbook totals add up; their bands combine as independent errors.
  const gained = scoreboard.reduce((a, r) => a + (r.clicks_gained ?? 0), 0);
  const gainedSe = Math.sqrt(
    scoreboard.reduce((a, r) => a + clicksGainedSe(r) ** 2, 0),
  );
  const s = settings[0] ?? null;
  const run = runs[0] ?? null;
  return {
    configured: true as const,
    summary,
    clicksGained: {
      value: gained,
      lo: gained - 1.645 * gainedSe,
      hi: gained + 1.645 * gainedSe,
      playbooks: scoreboard.length,
    },
    placeboNominal: PLACEBO_NOMINAL,
    placeboLimit: s ? s.placebo_max_rate : null,
    placeboNights: reverse(placebo).map((p) => ({
      night: p.night.slice(0, 10),
      rate: p.n ? (p.false_win + p.false_loss) / p.n : null,
      n: p.n,
    })),
    settings: s && {
      enabled: s.enabled,
      pausedReason: s.paused_reason,
      mode: s.nightly_mode,
      nightlyCap: s.nightly_cap_total,
      maxLosses7d: s.max_losses_7d,
      updatedBy: s.updated_by,
      updatedAt: s.updated_at,
    },
    lastRun: run && {
      at: run.run_at,
      mode: run.mode,
      applied: run.summary.applied ?? 0,
      picked: run.summary.picked ?? 0,
      drafted: run.summary.drafted ?? 0,
      errors: run.summary.errors?.length ?? 0,
    },
  };
}

// ── Decision log ────────────────────────────────────────────────────────────

const DECISION_LIMIT = 1000;

async function listDecisions() {
  const config = await getClimberSupabaseConfig();
  if (!config) return { configured: false as const, decisions: [] };
  const rows = await climberRestGet(
    config,
    `seo_decisions?select=id,at,experiment_id,batch_id,category,actor,action,from_status,to_status,reason,experiment:seo_experiments(url)&order=at.desc&limit=${DECISION_LIMIT}`,
    decisionSchema.extend({
      experiment: z.object({ url: z.string() }).nullable(),
    }),
  );
  return {
    configured: true as const,
    limit: DECISION_LIMIT,
    decisions: rows.map((r) => ({
      ...toDecision(r),
      url: r.experiment?.url ?? null,
    })),
  };
}

// ── Learnings ───────────────────────────────────────────────────────────────

const finalBatchSchema = z.object({
  batch_id: z.number(),
  playbook: z.string(),
  market: z.string().nullable(),
  status: z.string(),
  decided_at: z.string().nullable(),
  decision_reason: z.string().nullable(),
  effect: optNum,
  lo90: optNum,
  hi90: optNum,
  verdict: z.string().nullable().optional(),
  clusters: optNum,
});

async function getLearnings() {
  const config = await getClimberSupabaseConfig();
  if (!config) return { configured: false as const };
  const [scoreboard, batches, experiments] = await Promise.all([
    climberRestGet(config, "climber_scoreboard_v?select=*", scoreboardSchema),
    climberRestGetAll(
      config,
      "seo_experiment_batches?select=batch_id,playbook,market,status,decided_at,decision_reason,effect:result->effect,lo90:result->lo90,hi90:result->hi90,verdict:result->>verdict,clusters:result->clusters&result->>final=eq.true&order=decided_at.desc",
      finalBatchSchema,
    ),
    readEngineExperiments(config),
  ]);
  const playbooks = new Map<
    string,
    {
      playbook: string;
      agent: string | null;
      changed: number;
      open: number;
      kept: number;
      reverted: number;
      tooSmall: number;
    }
  >();
  for (const e of experiments) {
    if (!e.playbook) continue;
    const p = playbooks.get(e.playbook) ?? {
      playbook: e.playbook,
      agent: e.agent,
      changed: 0,
      open: 0,
      kept: 0,
      reverted: 0,
      tooSmall: 0,
    };
    if (e.appliedAt) p.changed++;
    if (["live", "measuring", "extended"].includes(e.status)) p.open++;
    if (e.status === "kept") p.kept++;
    if (e.status === "reverted") p.reverted++;
    if (e.status === "too_small") p.tooSmall++;
    playbooks.set(e.playbook, p);
  }
  const board = new Map(scoreboard.map((s) => [s.playbook, s]));
  const names = sortBy(
    [...new Set([...playbooks.keys(), ...board.keys()])],
    (n) => n,
  );
  return {
    configured: true as const,
    playbooks: names.map((name) => {
      const s = board.get(name);
      return {
        playbook: name,
        agent: s?.agent ?? playbooks.get(name)?.agent ?? null,
        pages: playbooks.get(name) ?? null,
        score: s
          ? {
              batches: s.batches,
              judged: s.judged,
              wins: s.wins,
              losses: s.losses,
              grey: s.grey,
              flatKept: s.flat_kept,
              tooSmall: s.too_small,
              uplift: s.uplift,
              lo: s.uplift_lo90,
              hi: s.uplift_hi90,
              tone: bandTone(s.uplift_lo90, s.uplift_hi90),
              clicksGained: s.clicks_gained,
              winsBeyondChance: s.wins_beyond_chance,
              proven: s.proven,
            }
          : null,
        batches: batches
          .filter((b) => b.playbook === name)
          .slice(0, 12)
          .map((b) => ({
            batchId: b.batch_id,
            market: b.market,
            status: b.status,
            decidedAt: b.decided_at,
            reason: b.decision_reason,
            verdict: b.verdict ?? null,
            clusters: b.clusters ?? null,
            lift: lift(b.effect),
            lo: lift(b.lo90),
            hi: lift(b.hi90),
            tone: bandTone(lift(b.lo90), lift(b.hi90)),
          })),
      };
    }),
  };
}

// Decision 10: the Jul-Aug retro-judge results stay off the scoreboard. The
// summary is read on demand, with what chance alone gives on untouched pages.
const LEGACY_VERDICTS = ["win", "loss", "flat", "too_small"] as const;

async function getLegacySummary() {
  const config = await getClimberSupabaseConfig();
  if (!config) return null;
  // One at a time: the view is computed per request, and four at once hit
  // the statement timeout.
  const counts: number[] = [];
  for (const v of LEGACY_VERDICTS) {
    counts.push(
      await climberRestCount(
        config,
        `seo_retro_judge_v?select=id&verdict=eq.${v}`,
      ),
    );
  }
  const [win = 0, loss = 0, flat = 0, tooSmall = 0] = counts;
  const judged = win + loss + flat;
  return {
    total: judged + tooSmall,
    win,
    loss,
    flat,
    too_small: tooSmall,
    judged,
    // A/A run of the same rule on untouched pages (research-judge-statistics s4.1).
    chanceWinRate: 0.083,
    chanceLossRate: 0.101,
  };
}

export const ClimberExperimentsService = {
  getProgram,
  listExperiments,
  getScorecard,
  listDecisions,
  getLearnings,
  getLegacySummary,
  getCategories,
  setCategoryApproval,
};
