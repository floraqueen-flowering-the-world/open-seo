import { z } from "zod";

export const experimentsInputSchema = z.object({
  projectId: z.string().min(1),
  scope: z.enum(["climber", "legacy"]).default("climber"),
});

export const experimentSeriesInputSchema = z.object({
  projectId: z.string().min(1),
  experimentId: z.number().int().positive(),
});

export const EXPERIMENT_STATUSES = [
  "proposed",
  "live",
  "measuring",
  "won",
  "flat",
  "lost",
  "reverted",
  "closed",
] as const;

export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];
