import { useQuery } from "@tanstack/react-query";
import { Area, ComposedChart, Line, ReferenceLine } from "recharts";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
import { QueryError } from "@/client/components/QueryState";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import { getClimberExperimentImpact } from "@/serverFunctions/experiments";

const chartConfig = {
  actual: { label: "Page clicks", color: "#2563eb" },
  expected: { label: "Expected (site control)", color: "#94a3b8" },
  band: { label: "95% band", color: "#94a3b8" },
} satisfies ChartConfig;

const VERDICT_TEXT = {
  win: "Win: the whole band is above zero",
  loss: "Loss: the whole band is below zero",
  flat: "Flat: the band crosses zero",
  too_early: "Too early: under 7 days after day +7",
  too_small: "Too small to judge: under 20 clicks in the 28 days before",
} as const;

function formatPct(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function ExperimentImpactChart({
  projectId,
  experimentId,
}: {
  projectId: string;
  experimentId: number;
}) {
  const query = useQuery({
    queryKey: ["climberExperimentImpact", experimentId],
    queryFn: () =>
      getClimberExperimentImpact({ data: { projectId, experimentId } }),
    staleTime: 10 * 60 * 1000,
  });

  if (query.isLoading) return <Skeleton className="h-56 w-full" />;
  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        fallback="Failed to load the clicks around this change."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
        variant="inline"
      />
    );
  }
  const impact = query.data;
  if (!impact || impact.points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Search Console rows for this page around the change.
      </p>
    );
  }
  const changeDate = impact.points.find((p) => p.day === 0)?.date;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Uplift (day +7 on)" value={formatPct(impact.upliftPct)} />
        <Stat
          label="95% band"
          value={
            impact.upliftLowPct === null
              ? "—"
              : `${formatPct(impact.upliftLowPct)} to ${formatPct(impact.upliftHighPct)}`
          }
        />
        <Stat
          label="Clicks: actual / expected"
          value={`${impact.postClicks} / ${impact.expectedClicks ?? "—"}`}
        />
        <Stat label="Post days" value={String(impact.postDays)} />
      </dl>
      <p className="text-sm font-medium">{VERDICT_TEXT[impact.verdict]}</p>
      <ChartContainer
        config={chartConfig}
        className="h-56 w-full"
        aria-label="Page clicks vs expected clicks around the change"
      >
        <ComposedChart
          data={impact.points}
          margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
        >
          <ChartGrid />
          <ChartXAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
          />
          <ChartYAxis allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            dataKey="band"
            stroke="none"
            fill="var(--color-band)"
            fillOpacity={0.2}
            isAnimationActive={false}
          />
          <Line
            dataKey="expected"
            stroke="var(--color-expected)"
            strokeDasharray="4 3"
            strokeWidth={2}
            dot={false}
          />
          <Line
            dataKey="actual"
            stroke="var(--color-actual)"
            strokeWidth={2}
            dot={false}
          />
          {changeDate ? (
            <ReferenceLine
              x={changeDate}
              stroke="currentColor"
              strokeOpacity={0.5}
              label={{
                value: "change",
                position: "insideTopLeft",
                fontSize: 10,
              }}
            />
          ) : null}
        </ComposedChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">
        Expected = the rest of the site&apos;s clicks scaled by this page&apos;s
        share in the 28 days before. The band is a simple residual interval, not
        a full causal model.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
