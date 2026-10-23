import { createServerFn } from "@tanstack/react-start";
import { DemandService } from "@/server/features/demand/DemandService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

export const getWorkspaceDemand = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) =>
    DemandService.getDemand(context.organizationId),
  );
