import { Line, LineChart } from "recharts";
import { sortBy } from "remeda";
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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import type { getWorkspaceDemand } from "@/serverFunctions/demand";
import { formatDecimal, formatInt } from "./format";

type AdsData = NonNullable<
  Awaited<ReturnType<typeof getWorkspaceDemand>>["ads"]
>;

const ADS_MARKETS = 6;
const TERMS_PER_MARKET = 4;

const MARKET_NAMES: Record<string, string> = {
  ES: "Spain",
  US: "United States",
  UK: "United Kingdom",
  IT: "Italy",
  DE: "Germany",
  FR: "France",
  ROW: "Rest of world",
  LATAM: "Latin America",
  CA: "Canada",
  PL: "Poland",
  RU: "Russian speakers",
  TR: "Turkey",
  NL: "Netherlands",
};
// Mixed buckets, not one market.
const SKIP_MARKETS = new Set(["CITIES", "FOREIGN", "US_CA"]);

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const seasonChart = {
  share: { label: "Share of yearly conversions", color: "#1b6c80" },
} satisfies ChartConfig;

export function AdsHistory({ ads }: { ads: AdsData }) {
  const markets: { market: string; total: number; terms: typeof ads.terms }[] =
    [];
  for (const t of ads.terms) {
    if (SKIP_MARKETS.has(t.market)) continue;
    let entry = markets.find((m) => m.market === t.market);
    if (!entry) {
      entry = { market: t.market, total: t.marketConversions, terms: [] };
      markets.push(entry);
    }
    if (entry.terms.length < TERMS_PER_MARKET) entry.terms.push(t);
  }
  const top = sortBy(markets, [(m) => m.total, "desc"]).slice(0, ADS_MARKETS);
  const season = ads.seasonality.map((s) => ({
    month: MONTHS[s.month - 1],
    share: s.sharePct,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>Proven searches from Ads history</h2>
          </CardTitle>
          <CardDescription>
            Non-brand search terms that converted in paid campaigns, 2022
            onward. These already sell: the priority list for SEO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {top.map((m) => (
              <div key={m.market} className="min-w-0">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {MARKET_NAMES[m.market] ?? m.market} · {formatInt(m.total)}{" "}
                  conversions
                </h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {m.terms.map((t) => (
                    <li
                      key={t.term}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0 truncate" title={t.term}>
                        {t.term}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatInt(t.conversions)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>When demand converts</h2>
          </CardTitle>
          <CardDescription>
            Share of a year&apos;s Ads conversions by month
            {ads.seasonYears
              ? `, ${ads.seasonYears.first} to ${ads.seasonYears.last}`
              : ""}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={seasonChart}
            className="h-56 w-full"
            aria-label="Share of yearly conversions by month"
          >
            <LineChart
              data={season}
              margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
            >
              <ChartGrid />
              <ChartXAxis dataKey="month" minTickGap={4} />
              <ChartYAxis
                width={36}
                tickFormatter={(v: number) => `${formatDecimal(v, 0)}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${formatDecimal(Number(value), 1)}%`}
                  />
                }
              />
              <Line
                dataKey="share"
                stroke="var(--color-share)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
          <p className="pt-2 text-xs text-muted-foreground">
            {season
              .filter((s) => ["Feb", "May", "Aug"].includes(s.month))
              .map((s) => `${s.month} ${formatDecimal(s.share, 1)}%`)
              .join(" · ")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
