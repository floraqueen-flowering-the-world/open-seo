import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonCard } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/client/components/ui/empty";
import { ProjectPageHeader } from "@/client/features/projects/ProjectPageHeader";
import { getClimberExperiments } from "@/serverFunctions/experiments";
import {
  EXPERIMENT_STATUSES,
  type ExperimentStatus,
} from "@/types/schemas/experiments";
import { ExperimentImpactChart } from "./ExperimentImpactChart";

type Scope = "climber" | "legacy";
type Experiment = Awaited<
  ReturnType<typeof getClimberExperiments>
>["experiments"][number];

const STATUS_BADGE: Record<
  ExperimentStatus,
  "secondary" | "info" | "warning" | "success" | "destructive" | "outline"
> = {
  proposed: "secondary",
  live: "info",
  measuring: "warning",
  won: "success",
  flat: "outline",
  lost: "destructive",
  reverted: "destructive",
  closed: "outline",
};

export function ExperimentsPage({ projectId }: { projectId: string }) {
  const [scope, setScope] = useState<Scope>("climber");
  const [status, setStatus] = useState<ExperimentStatus | null>(null);
  const query = useQuery({
    queryKey: ["climberExperiments", projectId, scope],
    queryFn: () => getClimberExperiments({ data: { projectId, scope } }),
  });

  const experiments = query.data?.experiments ?? [];
  const counts = new Map<ExperimentStatus, number>();
  for (const e of experiments) {
    counts.set(e.status, (counts.get(e.status) ?? 0) + 1);
  }
  const visible = status
    ? experiments.filter((e) => e.status === status)
    : experiments;

  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <ProjectPageHeader projectId={projectId} title="Experiments" />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={scope === "climber" ? "default" : "outline"}
            onClick={() => {
              setScope("climber");
              setStatus(null);
            }}
          >
            Climber experiments
          </Button>
          <Button
            size="sm"
            variant={scope === "legacy" ? "default" : "outline"}
            onClick={() => {
              setScope("legacy");
              setStatus(null);
            }}
          >
            Past bulk changes (top 30 pages)
          </Button>
        </div>

        {query.isError ? (
          <QueryError
            error={query.error}
            fallback="Failed to load experiments."
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : null}

        {query.isLoading ? <SkeletonCard /> : null}

        {query.data && !query.data.configured ? (
          <Empty variant="dashed">
            <EmptyHeader>
              <EmptyTitle>Experiments are not connected</EmptyTitle>
              <EmptyDescription>
                Set CLIMBER_SUPABASE_URL and CLIMBER_SUPABASE_KEY on the worker
                to read Climber&apos;s experiments.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {query.data?.configured ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {EXPERIMENT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(status === s ? null : s)}
                  className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/5"
                >
                  <div className="text-xs text-muted-foreground capitalize">
                    {s}
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {counts.get(s) ?? 0}
                  </div>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <Empty variant="dashed">
                <EmptyHeader>
                  <EmptyTitle>No experiments yet</EmptyTitle>
                  <EmptyDescription>
                    {scope === "climber"
                      ? "Climber has not proposed or applied any experiments. They appear here once Climber logs one to seo_experiments."
                      : "No past changes match this status."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {visible.map((e) => (
                  <ExperimentCard
                    key={e.id}
                    projectId={projectId}
                    experiment={e}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function ExperimentCard({
  projectId,
  experiment: e,
}: {
  projectId: string;
  experiment: Experiment;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE[e.status]} className="capitalize">
            {e.status}
          </Badge>
          {e.fixType ? <Badge variant="outline">{e.fixType}</Badge> : null}
          <span className="text-xs text-muted-foreground">#{e.id}</span>
        </div>
        <CardTitle className="text-sm break-all">
          <a
            href={e.url}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            {e.url}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {e.hypothesis ? (
          <p>
            <span className="text-muted-foreground">Hypothesis: </span>
            {e.hypothesis}
          </p>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <ValueBox label="Before" value={e.oldValue} />
          <ValueBox label="After" value={e.newValue} />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <Meta label="Applied" value={e.appliedAt?.slice(0, 10)} />
          <Meta label="Judge on" value={e.judgeAt} />
          <Meta label="Verdict" value={e.verdict} />
          <Meta
            label="Baseline impressions"
            value={e.baselineImpressions?.toLocaleString()}
          />
        </dl>
        {e.appliedAt ? (
          <div className="space-y-3">
            <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
              {open ? "Hide impact" : "Show impact"}
            </Button>
            {open ? (
              <ExperimentImpactChart
                projectId={projectId}
                experimentId={e.id}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ValueBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/40 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="line-clamp-4 font-mono text-xs break-all whitespace-pre-wrap">
        {value ?? "—"}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-1">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
