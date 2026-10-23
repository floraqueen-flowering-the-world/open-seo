import { createFileRoute } from "@tanstack/react-router";
import { ExperimentsPage } from "@/client/features/experiments/ExperimentsPage";
import { experimentsSearchSchema } from "@/types/schemas/experiments";

export const Route = createFileRoute("/_app/p/$projectId/experiments")({
  validateSearch: experimentsSearchSchema,
  component: ExperimentsRoute,
});

function ExperimentsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ExperimentsPage
      search={search}
      onSearch={(next) =>
        void navigate({ search: (prev) => ({ ...prev, ...next }) })
      }
    />
  );
}
