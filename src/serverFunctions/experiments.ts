import { createServerFn } from "@tanstack/react-start";
import { ClimberExperimentsService } from "@/server/features/experiments/ClimberExperimentsService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  experimentSeriesInputSchema,
  experimentsInputSchema,
} from "@/types/schemas/experiments";

export const getClimberExperiments = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(experimentsInputSchema)
  .handler(async ({ data, context }) =>
    ClimberExperimentsService.listExperiments(
      data.scope,
      context.project.domain,
    ),
  );

export const getClimberExperimentImpact = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(experimentSeriesInputSchema)
  .handler(async ({ data }) =>
    ClimberExperimentsService.getExperimentImpact(data.experimentId),
  );
