import { ComposedChart, Line, ReferenceArea, ReferenceLine } from "recharts";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatChange } from "@/client/features/demand/format";
import type { getClimberScorecard } from "@/serverFunctions/experiments";
import { formatDay, formatNumber, shiftDay } from "./shared";

type ScorecardData = NonNullable<
  Awaited<ReturnType<typeof getClimberScorecard>>
>;

const chartConfig = {
  page7: { label: "This page (all domains)", color: "#2563eb" },
  peers7: { label: "Natural peers, scaled", color: "#94a3b8" },
} satisfies ChartConfig;

export function PeerChart({ data }: { data: ScorecardData }) {
  const series = data.series;
  return (
    <Card>
      <CardHeader>
        <CardTitle>This page against its natural peers</CardTitle>
        <CardDescription>
          Clicks a day, 7-day average, summed over every domain.{" "}
          {data.peerCount
            ? `${data.peerCount} untouched pages of the same type and market, scaled to this page's level in the 56 days before.`
            : "Peers are picked at the first look."}{" "}
          The judge reads from day 7 (recrawl).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {series && series.points.some((p) => p.page7 !== null) ? (
          <ChartContainer
            config={chartConfig}
            className="h-64 w-full"
            aria-label="Page clicks against natural peers around the change"
          >
            <ComposedChart
              data={series.points}
              margin={{ left: 0, right: 8, top: 12 }}
            >
              <ChartGrid />
              <ChartXAxis
                dataKey="day"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(d: number) =>
                  d === 0 ? "change" : `${d > 0 ? "+" : ""}${d}`
                }
              />
              <ChartYAxis />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => {
                      const day = Number(label);
                      return data.changeDate
                        ? `${formatDay(shiftDay(data.changeDate, day))} (day ${day})`
                        : `day ${day}`;
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <ReferenceArea
                x1={0}
                x2={7}
                fill="currentColor"
                fillOpacity={0.05}
              />
              <ReferenceLine
                x={0}
                stroke="currentColor"
                strokeOpacity={0.6}
                label={{
                  value: "change",
                  position: "insideTopLeft",
                  fontSize: 10,
                }}
              />
              <Line
                dataKey="peers7"
                stroke="var(--color-peers7)"
                strokeDasharray="4 3"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="page7"
                stroke="var(--color-page7)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground">
            {data.changeDate
              ? "Not enough Search Console days around the change yet."
              : "The chart starts once the change is written."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function DomainTable({ data }: { data: ScorecardData }) {
  const d = data.domains;
  return (
    <Card>
      <CardHeader>
        <CardTitle>The same page on each domain</CardTitle>
        <CardDescription>
          28 days before the change against days 7 to 34 after
          {d && d.postDays > 0 && d.postDays < 28
            ? ` (${d.postDays} days so far, scaled to 28)`
            : ""}
          . One experiment covers all of them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {d && d.domains.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead className="text-right">Clicks before</TableHead>
                <TableHead className="text-right">After (28d)</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Impressions after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.domains.map((row) => (
                <TableRow key={row.host}>
                  <TableCell>
                    {row.host.replace(/^www\./, "")}
                    {row.urls > 1 ? (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {row.urls} URLs
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.preClicks)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.postDays ? formatNumber(row.postClicks28) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.change === null ? "—" : formatChange(row.change, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.postDays ? formatNumber(row.postImpressions28) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            {data.changeDate
              ? "No Search Console rows for these URLs."
              : "Starts once the change is written."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function FieldDiff({ data }: { data: ScorecardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What changed</CardTitle>
        <CardDescription>
          {data.locale && data.locale !== "en" ? `Locale ${data.locale}. ` : ""}
          Field by field, as the agent wrote it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.fields.map((f) => (
          <div key={f.field} className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              {f.field}
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <div className="rounded-md border border-destructive/20 bg-destructive/5 max-h-48 overflow-auto p-2 text-xs break-words whitespace-pre-wrap">
                <span className="sr-only">Before: </span>
                {f.before ?? (
                  <span className="text-muted-foreground">empty</span>
                )}
              </div>
              <div className="rounded-md border border-success/30 bg-success/5 max-h-48 overflow-auto p-2 text-xs break-words whitespace-pre-wrap">
                <span className="sr-only">After: </span>
                {f.after ?? (
                  <span className="text-muted-foreground">empty</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
