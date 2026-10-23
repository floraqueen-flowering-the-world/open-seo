import { z } from "zod";

// Climber's engine status model (seo_experiments.status, seo_experiment_batches.status).
export const ENGINE_STATUSES = [
  "proposed",
  "approved",
  "live",
  "measuring",
  "extended",
  "review",
  "kept",
  "reverted",
  "invalid",
  "too_small",
] as const;

export type EngineStatus = (typeof ENGINE_STATUSES)[number];

export const AGENTS = ["tailor", "cartographer", "herald"] as const;

// Page size by clicks in the 28 days before the change (DESIGN 1.2). Nothing is
// gated on it any more; it is how risky a change was.
export const SIZE_TIERS = ["T0", "T1", "T2"] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

export const EXPERIMENT_TABS = [
  "program",
  "experiments",
  "decisions",
  "categories",
  "learnings",
] as const;

export type ExperimentTab = (typeof EXPERIMENT_TABS)[number];

export const experimentsSearchSchema = z.object({
  tab: z.enum(EXPERIMENT_TABS).optional().catch(undefined),
  exp: z.number().int().positive().optional().catch(undefined),
  agent: z.enum(AGENTS).optional().catch(undefined),
  playbook: z.string().max(200).optional().catch(undefined),
  status: z.enum(ENGINE_STATUSES).optional().catch(undefined),
  tier: z.enum(SIZE_TIERS).optional().catch(undefined),
});

export type ExperimentsSearch = z.infer<typeof experimentsSearchSchema>;

export const experimentScorecardInputSchema = z.object({
  experimentId: z.number().int().positive(),
});

const CATEGORY_PATTERN = /^(content|destructive:[a-z0-9_]+)$/;

export const setCategoryApprovalInputSchema = z.object({
  category: z.string().regex(CATEGORY_PATTERN),
  approved: z.boolean(),
  note: z.string().trim().min(3).max(500),
});
