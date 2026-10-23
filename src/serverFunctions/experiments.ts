import { createServerFn } from "@tanstack/react-start";
import { ClimberExperimentsService } from "@/server/features/experiments/ClimberExperimentsService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import {
  experimentScorecardInputSchema,
  setCategoryApprovalInputSchema,
} from "@/types/schemas/experiments";

// Workspace-level: one Climber program covers all five domains.

export const getClimberProgram = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => ClimberExperimentsService.getProgram());

export const getClimberExperiments = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => ClimberExperimentsService.listExperiments());

export const getClimberScorecard = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .validator(experimentScorecardInputSchema)
  .handler(async ({ data }) =>
    ClimberExperimentsService.getScorecard(data.experimentId),
  );

export const getClimberDecisions = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => ClimberExperimentsService.listDecisions());

export const getClimberLearnings = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => ClimberExperimentsService.getLearnings());

export const getClimberLegacySummary = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => ClimberExperimentsService.getLegacySummary());

export const getClimberCategories = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => ClimberExperimentsService.getCategories());

export const setClimberCategoryApproval = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(setCategoryApprovalInputSchema)
  .handler(async ({ data, context }) =>
    ClimberExperimentsService.setCategoryApproval({
      ...data,
      userEmail: context.userEmail,
    }),
  );
