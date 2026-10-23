import { createFileRoute } from "@tanstack/react-router";
import { ArchitecturePage } from "@/client/features/architecture/ArchitecturePage";

export const Route = createFileRoute("/_app/architecture")({
  component: ArchitecturePage,
});
