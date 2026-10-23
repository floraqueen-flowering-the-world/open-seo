import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { formatRate } from "@/client/features/demand/format";
import {
  getClimberLearnings,
  getClimberLegacySummary,
} from "@/serverFunctions/experiments";
import type { ExperimentsSearch } from "@/types/schemas/experiments";
import {
  AGENT_LABEL,
  LiftBar,
  formatBand,
  formatDay,
  formatLift,
  formatNumber,
  playbookLabel,
  verdictLabel,
} from "./shared";

export function LearningsTab({
  onSearch,
}: {
  onSearch: (next: ExperimentsSearch) => void;
}) {
  const query = useQuery({
    queryKey: ["climberLearnings"],
    queryFn: () => getClimberLearnings(),
    staleTime: 5 * 60 * 1000,
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        fallback="Failed to load the learnings."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }
  const data = query.data;
  if (!data?.configured) return null;

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        One card per playbook (one agent, one kind of change, one page family).
        The pooled lift weighs steadier batches more. A playbook is proven only
        when it wins across 2+ batches and survives the false-discovery check
        across all playbooks; only proven playbooks feed the agents&apos; rules.
      </p>

      {data.playbooks.length === 0 ? (
        <Empty variant="dashed">
          <EmptyHeader>
            <EmptyTitle>No playbook has run yet</EmptyTitle>
            <EmptyDescription>
              Cards appear after the first night of changes; pooled results
              after the first batch reaches its day-28 decision.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.playbooks.map((p) => (
            <Card key={p.playbook}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="capitalize">
                    {playbookLabel(p.playbook)}
                  </CardTitle>
                  {p.agent ? (
                    <Badge variant="outline">
                      {AGENT_LABEL[p.agent] ?? p.agent}
                    </Badge>
                  ) : null}
                  {p.score?.proven ? (
                    <Badge variant="success">Proven</Badge>
                  ) : null}
                </div>
                <CardDescription>
                  {p.pages
                    ? `${formatNumber(p.pages.changed)} pages changed · ${formatNumber(p.pages.open)} measuring · ${formatNumber(p.pages.kept)} kept · ${formatNumber(p.pages.reverted)} reverted · ${formatNumber(p.pages.tooSmall)} too small`
                    : "No page changed in this playbook yet"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {p.score ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Pooled lift">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {formatLift(p.score.uplift)}
                        </span>
                      </div>
                      <LiftBar
                        lift={p.score.uplift}
                        lo={p.score.lo}
                        hi={p.score.hi}
                        tone={p.score.tone}
                        width={96}
                      />
                      <div className="text-[0.7rem] text-muted-foreground">
                        {formatBand(p.score.lo, p.score.hi)}
                      </div>
                    </Stat>
                    <Stat label="Clicks gained">
                      <span className="font-semibold tabular-nums">
                        {formatNumber(p.score.clicksGained)}
                      </span>
                    </Stat>
                    <Stat label="Batches judged">
                      <span className="font-semibold tabular-nums">
                        {p.score.judged} of {p.score.batches}
                      </span>
                      <div className="text-[0.7rem] text-muted-foreground">
                        {p.score.wins} won · {p.score.losses} lost ·{" "}
                        {p.score.grey} grey · {p.score.flatKept} flat
                      </div>
                    </Stat>
                    <Stat label="Wins beyond chance">
                      <span className="font-semibold tabular-nums">
                        {formatNumber(p.score.winsBeyondChance, 1)}
                      </span>
                      <div className="text-[0.7rem] text-muted-foreground">
                        wins minus what the placebo rate predicts
                      </div>
                    </Stat>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No batch decided yet. The first batch decision is at day 28.
                  </p>
                )}
                {p.batches.length ? (
                  <ul className="space-y-1.5">
                    {p.batches.map((b) => (
                      <li
                        key={b.batchId}
                        className="flex items-center gap-3 text-xs"
                      >
                        <LiftBar
                          lift={b.lift}
                          lo={b.lo}
                          hi={b.hi}
                          tone={b.tone}
                          width={80}
                        />
                        <span className="w-24 shrink-0 font-medium tabular-nums">
                          {formatLift(b.lift)}
                        </span>
                        <span className="min-w-0 truncate text-muted-foreground">
                          Batch {b.batchId}
                          {b.market
                            ? ` · ${b.market.toUpperCase()}`
                            : ""} · {verdictLabel(b.verdict)} ·{" "}
                          {formatDay(b.decidedAt)}
                          {b.clusters ? ` · ${b.clusters} pages` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onSearch({ tab: "experiments", playbook: p.playbook })
                  }
                >
                  See its pages
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LegacyNote />
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

// Decision 10: summarised and hidden by default, never on the scoreboard.
function LegacyNote() {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["climberLegacySummary"],
    queryFn: () => getClimberLegacySummary(),
    enabled: open,
    staleTime: 60 * 60 * 1000,
  });
  const s = query.data;
  return (
    <Card size="sm" className="bg-muted/30">
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">
            Before Climber: the July and August bulk edits
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Show the summary"}
          </Button>
        </div>
        {open ? (
          query.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : query.isError ? (
            <QueryError
              error={query.error}
              fallback="Failed to load the old results."
              onRetry={() => void query.refetch()}
              isRetrying={query.isFetching}
              variant="inline"
            />
          ) : s ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                {formatNumber(s.total)} edits were judged one page at a time
                against the rest of the site: {formatNumber(s.win)} wins,{" "}
                {formatNumber(s.loss)} losses, {formatNumber(s.flat)} flat and{" "}
                {formatNumber(s.too_small)} too small to tell.
              </p>
              <p>
                Run on pages nobody touched, the same rule calls{" "}
                {formatRate(s.chanceWinRate, 1)} wins and{" "}
                {formatRate(s.chanceLossRate, 1)} losses, so chance alone
                predicts about {formatNumber(s.chanceWinRate * s.judged)} wins
                and {formatNumber(s.chanceLossRate * s.judged)} losses among the{" "}
                {formatNumber(s.judged)} judged. Most of those verdicts are
                noise, and losses still outnumber wins. They stay in Supabase
                (seo_retro_judge_v) and are kept off the scoreboard.
              </p>
            </div>
          ) : null
        ) : null}
      </CardContent>
    </Card>
  );
}
