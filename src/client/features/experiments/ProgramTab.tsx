import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Line, LineChart, ReferenceLine } from "recharts";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
import { QueryError } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import { Skeleton } from "@/client/components/ui/skeleton";
import { cn } from "cn";
import { formatRate } from "@/client/features/demand/format";
import { getClimberProgram } from "@/serverFunctions/experiments";
import type { ExperimentsSearch } from "@/types/schemas/experiments";
import {
  Kpi,
  formatDateTime,
  formatDay,
  formatNumber,
  type Tone,
} from "./shared";

const weeklyConfig = {
  won: { label: "Won", color: "var(--success)" },
  kept: { label: "Kept (flat)", color: "#60a5fa" },
  reverted: { label: "Reverted", color: "var(--destructive)" },
  review: { label: "Review", color: "#f59e0b" },
  tooSmall: { label: "Too small / invalid", color: "#94a3b8" },
} satisfies ChartConfig;

const WEEKLY_KEYS = ["won", "kept", "reverted", "review", "tooSmall"] as const;

const placeboConfig = {
  rate: { label: "False calls", color: "#2563eb" },
} satisfies ChartConfig;

export function ProgramTab({
  onSearch,
}: {
  onSearch: (next: ExperimentsSearch) => void;
}) {
  const query = useQuery({
    queryKey: ["climberProgram"],
    queryFn: () => getClimberProgram(),
    staleTime: 5 * 60 * 1000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        fallback="Failed to load the program."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }
  const data = query.data;
  if (!data?.configured) return null;
  const { summary, settings, lastRun, clicksGained } = data;
  const placeboRate = summary.placebo.rate;
  const placeboTone: Tone =
    placeboRate === null
      ? "neutral"
      : data.placeboLimit !== null && placeboRate > data.placeboLimit
        ? "bad"
        : "good";
  const on = settings?.enabled ?? false;
  const applying = on && settings?.mode === "apply";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2.5 shrink-0 rounded-full",
                applying ? "bg-success" : on ? "bg-warning" : "bg-destructive",
              )}
            />
            <div className="min-w-0 space-y-1">
              <div className="font-medium">
                {!settings
                  ? "Kill switch not found"
                  : !on
                    ? "Automation paused (kill switch off)"
                    : applying
                      ? "Automation on: agents write to the live store"
                      : "Automation on, dry run: agents propose, nothing is written"}
              </div>
              <div className="text-xs text-muted-foreground">
                {settings
                  ? `Up to ${settings.nightlyCap} pages a night · pauses after ${settings.maxLosses7d} clear losses in 7 days · set by ${settings.updatedBy}, ${formatDateTime(settings.updatedAt)}`
                  : null}
              </div>
              {settings?.pausedReason ? (
                <div className="text-xs text-muted-foreground">
                  Note: {settings.pausedReason}
                </div>
              ) : null}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {lastRun ? (
              <>
                <div className="font-medium text-foreground">
                  Last night run {formatDateTime(lastRun.at)}
                </div>
                <div>
                  {lastRun.mode === "apply"
                    ? `${lastRun.applied} pages changed`
                    : `${lastRun.picked} picked, ${lastRun.drafted} drafted (dry run)`}
                  {lastRun.errors ? ` · ${lastRun.errors} errors` : ""}
                </div>
              </>
            ) : (
              "No nightly run yet"
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Win rate"
          value={
            summary.winRate === null ? "—" : formatRate(summary.winRate, 0)
          }
          note={
            summary.judged
              ? `${summary.wins} wins of ${summary.judged} judged pages`
              : "No page has reached its day-28 look yet"
          }
        />
        <Kpi
          label="Clicks gained (kept batches)"
          value={formatNumber(clicksGained.value)}
          tone={
            clicksGained.lo > 0
              ? "good"
              : clicksGained.hi < 0
                ? "bad"
                : "neutral"
          }
          note={
            clicksGained.playbooks
              ? `90% band ${formatNumber(clicksGained.lo)} to ${formatNumber(clicksGained.hi)}, ${clicksGained.playbooks} playbooks`
              : "Counted once a batch is decided"
          }
        />
        <Kpi
          label="Judge error rate (placebo)"
          value={placeboRate === null ? "—" : formatRate(placeboRate, 1)}
          tone={placeboTone}
          note={
            summary.placebo.nights
              ? `${summary.placebo.falseCalls} of ${summary.placebo.n} untouched pages called win or loss, last ${summary.placebo.nights} nights. Expected ${formatRate(data.placeboNominal, 0)}, pauses above ${data.placeboLimit === null ? "—" : formatRate(data.placeboLimit, 0)}`
              : "No placebo night yet"
          }
        />
        <Kpi
          label="Ready for review (day 56)"
          value={formatNumber(summary.review)}
          tone={summary.review ? "bad" : "neutral"}
          note="Still grey after 56 days; yours to keep or revert"
        >
          {summary.review ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => onSearch({ tab: "experiments", status: "review" })}
            >
              Open the queue
            </Button>
          ) : null}
        </Kpi>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Changed pages" value={summary.total} />
        <MiniStat label="Live (first week)" value={summary.live} />
        <MiniStat label="Measuring" value={summary.measuring} />
        <MiniStat label="Kept" value={summary.kept} />
        <MiniStat
          label="Reverted"
          value={summary.reverted}
          note={summary.harm ? `${summary.harm} for harm` : undefined}
        />
        <MiniStat
          label="Learning rate"
          value={
            summary.learningRate === null
              ? "—"
              : formatRate(summary.learningRate, 0)
          }
          note="Decided with a readable answer"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Decided per week</CardTitle>
            <CardDescription>
              Pages whose experiment ended, by outcome. Weeks start on Monday.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={weeklyConfig}
              className="h-56 w-full"
              aria-label="Experiments decided per week by outcome"
            >
              <BarChart data={summary.weekly} margin={{ left: 0, right: 8 }}>
                <ChartGrid />
                <ChartXAxis dataKey="week" tickFormatter={formatDay} />
                <ChartYAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {WEEKLY_KEYS.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="a"
                    fill={`var(--color-${key})`}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Judge noise, night by night</CardTitle>
            <CardDescription>
              Each night the judge scores about 200 untouched pages on fake
              change dates. With nothing changed, about{" "}
              {formatRate(data.placeboNominal, 0)} should be called win or loss.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.placeboNights.length ? (
              <ChartContainer
                config={placeboConfig}
                className="h-56 w-full"
                aria-label="Placebo false call rate per night"
              >
                <LineChart
                  data={data.placeboNights}
                  margin={{ left: 0, right: 8, top: 8 }}
                >
                  <ChartGrid />
                  <ChartXAxis dataKey="night" tickFormatter={formatDay} />
                  <ChartYAxis
                    domain={[0, 0.3]}
                    tickFormatter={(v: number) => formatRate(v, 0)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatRate(Number(value), 1)}
                      />
                    }
                  />
                  <ReferenceLine
                    y={data.placeboNominal}
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    strokeDasharray="4 3"
                  />
                  {data.placeboLimit !== null ? (
                    <ReferenceLine
                      y={data.placeboLimit}
                      stroke="var(--destructive)"
                      strokeOpacity={0.6}
                      strokeDasharray="4 3"
                    />
                  ) : null}
                  <Line
                    dataKey="rate"
                    stroke="var(--color-rate)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                No placebo night stored yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
      {note ? (
        <div className="text-[0.7rem] text-muted-foreground">{note}</div>
      ) : null}
    </div>
  );
}
