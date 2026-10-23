import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft } from "lucide-react";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/client/components/ui/empty";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { cn } from "cn";
import { getClimberScorecard } from "@/serverFunctions/experiments";
import {
  AGENT_LABEL,
  LiftBar,
  StatusBadge,
  TONE_TEXT,
  formatBand,
  formatDateTime,
  formatDay,
  formatLift,
  formatNumber,
  playbookLabel,
  verdictLabel,
} from "./shared";
import { DomainTable, FieldDiff, PeerChart } from "./ScorecardPanels";

type ScorecardData = NonNullable<
  Awaited<ReturnType<typeof getClimberScorecard>>
>;

const ROLE_LABEL = {
  primary: "Primary",
  guardrail: "Guardrail",
  mechanism: "Mechanism",
} as const;

export function Scorecard({
  experimentId,
  onBack,
}: {
  experimentId: number;
  onBack: () => void;
}) {
  const query = useQuery({
    queryKey: ["climberScorecard", experimentId],
    queryFn: () => getClimberScorecard({ data: { experimentId } }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <div className="space-y-5">
      <Button size="sm" variant="ghost" onClick={onBack} className="-ml-2">
        <ChevronLeft />
        All experiments
      </Button>
      {query.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : query.isError ? (
        <QueryError
          error={query.error}
          fallback="Failed to load this experiment."
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : query.data ? (
        <ScorecardBody data={query.data} />
      ) : (
        <Empty variant="dashed">
          <EmptyHeader>
            <EmptyTitle>Experiment not found</EmptyTitle>
            <EmptyDescription>
              No Climber experiment has the id {experimentId}.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function ScorecardBody({ data }: { data: ScorecardData }) {
  const e = data.experiment;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={e.status} />
          <Badge variant="outline" className="capitalize">
            {e.agent ? (AGENT_LABEL[e.agent] ?? e.agent) : "agent ?"} ·{" "}
            {playbookLabel(e.playbook)}
          </Badge>
          <Badge variant="outline">Size {e.tier}</Badge>
          {e.changeClass ? (
            <Badge variant="outline">
              {e.changeClass === "default_deploy"
                ? "Default to deploy"
                : "SEO bet"}
            </Badge>
          ) : null}
          {e.category && e.category !== "content" ? (
            <Badge variant="warning">
              {e.category.replace("destructive:", "")}
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            #{e.id} · batch {e.batchId}
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{e.title}</h2>
        <a
          href={e.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm break-all text-muted-foreground hover:underline"
        >
          {e.url}
        </a>
        {data.why ? (
          <p className="text-sm">
            <span className="text-muted-foreground">
              Why the agent picked it:{" "}
            </span>
            {data.why}
          </p>
        ) : null}
      </div>

      <DecisionBanner data={data} />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.health.map((h) => (
          <div
            key={h.check}
            className="flex gap-2 rounded-lg border border-border bg-card px-3 py-2"
          >
            {h.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium">{h.check}</div>
              <div className="text-xs break-words text-muted-foreground">
                {h.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>Compared with</TableHead>
              <TableHead className="text-right">Relative lift</TableHead>
              <TableHead>90% band</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.metrics.map((m) => (
              <TableRow key={m.metric}>
                <TableCell>
                  <div className="font-medium">{m.metric}</div>
                  <div className="text-xs text-muted-foreground">{m.note}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={m.role === "primary" ? "soft" : "outline"}>
                    {ROLE_LABEL[m.role]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.before}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.after}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {m.reference}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    m.tone !== "neutral" && TONE_TEXT[m.tone],
                  )}
                >
                  {formatLift(m.lift)}
                  {m.tone === "bad" && m.role === "guardrail" ? " · fails" : ""}
                </TableCell>
                <TableCell>
                  {m.lo !== null || m.hi !== null ? (
                    <div className="flex items-center gap-2">
                      <LiftBar
                        lift={m.lift}
                        lo={m.lo}
                        hi={m.hi}
                        tone={m.tone}
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatBand(m.lo, m.hi)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>

      <PeerChart data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DomainTable data={data} />
        <FieldDiff data={data} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Decisions on this page</CardTitle>
            <CardDescription>
              Who did what, and why. Append-only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.decisions.length ? (
              <ol className="space-y-3">
                {data.decisions.map((d) => (
                  <li key={d.id} className="border-l-2 border-border pl-3">
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(d.at)} · {d.actor}
                    </div>
                    <div className="text-sm font-medium">
                      {d.action.replace(/_/g, " ")}
                      {d.fromStatus || d.toStatus
                        ? ` (${d.fromStatus ?? "new"} → ${d.toStatus ?? "—"})`
                        : ""}
                    </div>
                    {d.reason ? (
                      <div className="text-xs break-words text-muted-foreground">
                        {d.reason}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                No decisions logged.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Snapshots (revert source)</CardTitle>
            <CardDescription>
              The whole object, saved to R2 before the write and locked for 400
              days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.snapshots.length ? (
              <ul className="space-y-2 text-xs">
                {data.snapshots.map((s) => (
                  <li key={s.r2_key} className="space-y-0.5">
                    <div className="font-medium">
                      {s.phase === "before"
                        ? "Before the change"
                        : "Before the revert"}{" "}
                      · {formatDateTime(s.created_at)}
                    </div>
                    <div className="font-mono break-all text-muted-foreground">
                      {s.r2_key}
                    </div>
                    <div className="text-muted-foreground">
                      {s.object_kind}, {formatNumber(s.bytes)} bytes, touched:{" "}
                      {s.touched_fields.join(", ") || "—"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {e.category === "destructive:restore_404"
                  ? "A redirect has no snapshot: reverting deletes the redirect."
                  : "No snapshot stored for this page."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DecisionBanner({ data }: { data: ScorecardData }) {
  const e = data.experiment;
  const final = ["kept", "reverted", "invalid", "too_small", "review"].includes(
    e.status,
  );
  const tone =
    e.status === "reverted" || e.harm
      ? "border-destructive/30 bg-destructive/5"
      : e.status === "kept"
        ? "border-success/30 bg-success/5"
        : e.status === "review"
          ? "border-warning/40 bg-warning/10"
          : "border-border bg-muted/40";
  let headline: string;
  if (final) {
    headline = `${verdictLabel(e.verdict)}: ${e.status === "review" ? "waiting for you" : e.status.replace("_", " ")}`;
  } else if (data.changeDate) {
    headline = `Measuring, day ${data.dayAfter ?? 0}. Next look ${e.judgeAt ? formatDay(e.judgeAt) : "day 14"}`;
  } else {
    headline = "Not written yet";
  }
  return (
    <div className={cn("rounded-xl border px-4 py-3", tone)}>
      <div className="text-sm font-semibold">{headline}</div>
      <div className="mt-1 text-sm text-muted-foreground">
        {e.harm ?? e.decisionReason ?? "No decision yet."}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {e.decidedBy ? `By ${e.decidedBy}` : ""}
        {e.decidedAt ? `, ${formatDateTime(e.decidedAt)}` : ""}
        {data.changeDate ? ` · changed ${formatDay(data.changeDate)}` : ""}
        {data.clicksGained !== null
          ? ` · ${formatNumber(data.clicksGained, 1)} clicks gained${data.clicksGainedBand ? ` [${formatNumber(data.clicksGainedBand[0], 1)}, ${formatNumber(data.clicksGainedBand[1], 1)}]` : ""}`
          : ""}
      </div>
    </div>
  );
}
