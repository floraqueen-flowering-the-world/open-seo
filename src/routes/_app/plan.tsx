import { createFileRoute } from "@tanstack/react-router";
import { PlanPage } from "@/client/features/plan/PlanPage";

export const Route = createFileRoute("/_app/plan")({
  component: PlanPage,
});
