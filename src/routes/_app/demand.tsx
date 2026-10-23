import { createFileRoute } from "@tanstack/react-router";
import { DemandPage } from "@/client/features/demand/DemandPage";

export const Route = createFileRoute("/_app/demand")({
  component: DemandPage,
});
