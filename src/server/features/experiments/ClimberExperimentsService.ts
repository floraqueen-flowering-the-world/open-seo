// Climber's SEO experiments, read from its Supabase project over PostgREST.
// Read-only: only GETs against two views (climber_experiments_v,
// climber_experiment_series_v). Not tenant data — the Climber deployment is
// one self-hosted workspace — so it is gated only by being signed in.
import { z } from "zod";
import {
  climberRestGet as restGet,
  getClimberSupabaseConfig as getConfig,
} from "@/server/lib/climberSupabase";
import { EXPERIMENT_STATUSES } from "@/types/schemas/experiments";
import { computeExperimentImpact } from "./experimentImpact";

const LEGACY_LIMIT = 30;
const CLIMBER_LIMIT = 500;

const experimentRowSchema = z.object({
  id: z.number(),
  source: z.string(),
  url: z.string(),
  host: z.string().nullable(),
  handle: z.string().nullable(),
  fix_type: z.string().nullable(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  hypothesis: z.string().nullable(),
  state: z.string().nullable(),
  verdict: z.string().nullable(),
  applied_at: z.string().nullable(),
  measure_start: z.string().nullable(),
  judge_at: z.string().nullable(),
  baseline_clicks: z.number().nullable(),
  baseline_impr: z.number().nullable(),
  status: z.enum(EXPERIMENT_STATUSES),
});

const seriesRowSchema = z.object({
  date: z.string(),
  treatment_clicks: z.number(),
  control_clicks: z.number(),
});

const toExperiment = (row: z.infer<typeof experimentRowSchema>) => ({
  id: row.id,
  source: row.source,
  url: row.url,
  host: row.host,
  fixType: row.fix_type,
  oldValue: row.old_value,
  newValue: row.new_value,
  hypothesis: row.hypothesis,
  verdict: row.verdict,
  appliedAt: row.applied_at,
  judgeAt: row.judge_at,
  baselineImpressions: row.baseline_impr,
  status: row.status,
});

const COLUMNS =
  "id,source,url,host,handle,fix_type,old_value,new_value,hypothesis,state,verdict,applied_at,measure_start,judge_at,baseline_clicks,baseline_impr,status";

// A project's domain ("floraqueen.it") narrows to that site; GSC hosts carry
// "www.". A project without a domain sees every site.
function hostFilter(domain: string | null) {
  const bare = domain
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  return bare ? `&host=in.(${bare},www.${bare})` : "";
}

async function listExperiments(
  scope: "climber" | "legacy",
  domain: string | null,
) {
  const config = await getConfig();
  if (!config) return { configured: false as const, experiments: [] };
  // Legacy rows are 12k bulk edits; show the biggest pages that were applied.
  const query =
    scope === "climber"
      ? `source=eq.climber&order=created_at.desc&limit=${CLIMBER_LIMIT}`
      : `source=eq.legacy&applied_at=not.is.null&order=baseline_impr.desc.nullslast&limit=${LEGACY_LIMIT}`;
  const rows = await restGet(
    config,
    `climber_experiments_v?select=${COLUMNS}&${query}${hostFilter(domain)}`,
    experimentRowSchema,
  );
  return { configured: true as const, experiments: rows.map(toExperiment) };
}

async function getExperimentImpact(experimentId: number) {
  const config = await getConfig();
  if (!config) return null;
  const [experiment] = await restGet(
    config,
    `climber_experiments_v?select=id,applied_at&id=eq.${experimentId}`,
    z.object({ id: z.number(), applied_at: z.string().nullable() }),
  );
  if (!experiment?.applied_at) return null;
  const rows = await restGet(
    config,
    `climber_experiment_series_v?select=date,treatment_clicks,control_clicks&experiment_id=eq.${experimentId}&order=date.asc`,
    seriesRowSchema,
  );
  return computeExperimentImpact(
    rows.map((row) => ({
      date: row.date,
      treatmentClicks: row.treatment_clicks,
      controlClicks: row.control_clicks,
    })),
    experiment.applied_at.slice(0, 10),
  );
}

export const ClimberExperimentsService = {
  listExperiments,
  getExperimentImpact,
};
