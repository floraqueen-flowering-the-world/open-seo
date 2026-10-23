import { useQuery } from "@tanstack/react-query";
import { sortBy } from "remeda";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Skeleton } from "@/client/components/ui/skeleton";
import { cn } from "cn";
import { getWorkspaceDemand } from "@/serverFunctions/demand";
import { AdsHistory } from "./AdsHistory";
import { COUNTRIES } from "./countries";
import {
  CHANGE_COLORS,
  EuropeDemandMap,
  WorldDemandMap,
  europeScale,
} from "./DemandMap";
import {
  formatChange,
  formatCompact,
  formatDecimal,
  formatInt,
  formatRate,
  growth,
} from "./format";

type Demand = Awaited<ReturnType<typeof getWorkspaceDemand>>;
type Country = Demand["searchConsole"]["countries"][number];

const BIG_MARKET = 100_000;
const MONEY_ROWS = 10;

function countryName(code: string) {
  return COUNTRIES[code]?.[1] ?? code.toUpperCase();
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function DemandPage() {
  const query = useQuery({
    queryKey: ["workspaceDemand"],
    queryFn: () => getWorkspaceDemand(),
    staleTime: 60 * 60 * 1000,
  });

  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Demand"
          description={
            query.data
              ? `Where people search for us, and where it is growing. ${formatDay(query.data.searchConsole.current.start)} to ${formatDay(query.data.searchConsole.current.end)} vs the previous 28 days.`
              : "Where people search for us, and where it is growing."
          }
        />
        {query.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : query.isError ? (
          <QueryError
            error={query.error}
            fallback="Failed to load the demand data."
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : query.data ? (
          <DemandContent demand={query.data} />
        ) : null}
      </div>
    </div>
  );
}

function DemandContent({ demand }: { demand: Demand }) {
  const sc = demand.searchConsole;
  const countries = sc.countries;
  const sum = (pick: (c: Country) => number) =>
    countries.reduce((total, c) => total + pick(c), 0);
  const impressions = sum((c) => c.impressions);
  const clicks = sum((c) => c.clicks);
  const money = sum((c) => c.moneyImpressions);
  const moneyClicks = sum((c) => c.moneyClicks);
  const moneyRate = money > 0 ? moneyClicks / money : 0;

  const fastest = sortBy(
    countries
      .filter((c) => c.impressions >= BIG_MARKET)
      .map((c) => ({ ...c, growth: growth(c.impressions, c.prevImpressions) }))
      .filter((c) => c.growth !== null),
    [(c) => c.growth ?? 0, "desc"],
  )[0];

  const mapCountries = countries.map((c) => ({
    country: c.country,
    impressions: c.impressions,
    growth: growth(c.impressions, c.prevImpressions),
  }));

  const kpis = [
    {
      label: "Searches that showed us",
      value: formatCompact(impressions),
      note: `${formatChange(
        growth(
          impressions,
          sum((c) => c.prevImpressions),
        ),
        1,
      )} vs the previous 28 days`,
    },
    {
      label: "Clicks from them",
      value: formatInt(clicks),
      note: `${formatRate(impressions > 0 ? clicks / impressions : 0)} of those searches`,
    },
    {
      label: "Money searches that showed us",
      value: formatInt(money),
      note: `only ${formatInt(moneyClicks)} clicked (${formatRate(moneyRate)})`,
    },
    {
      label: "Fastest-growing big market",
      value: fastest ? countryName(fastest.country) : "None",
      note: fastest
        ? `${formatChange(fastest.growth, 1)} vs the previous 28 days, ${formatCompact(fastest.impressions)} searches`
        : `No market above ${formatCompact(BIG_MARKET)} searches`,
    },
  ];

  const moneyRows = sortBy(countries, [
    (c) => c.moneyImpressions,
    "desc",
  ]).slice(0, MONEY_ROWS);

  if (sc.sites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No project has Search Console connected yet. Connect it in a project to
        see demand by country.
      </p>
    );
  }

  return (
    <>
      {sc.failedSites.length > 0 ? (
        <p className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-sm">
          Search Console could not be read for {sc.failedSites.join(", ")}; the
          numbers below leave those sites out. Reconnect them in the project
          settings.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} size="sm">
            <CardContent className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {k.value}
              </p>
              <p className="text-xs tabular-nums">{k.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card size="sm">
          <CardHeader>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <CardTitle>
                <h2>World</h2>
              </CardTitle>
              <CardDescription>
                Countries with 15k+ searches · Equal Earth
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <WorldDemandMap countries={mapCountries} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <CardTitle>
                <h2>Europe</h2>
              </CardTitle>
              <CardDescription>
                Bubbles {formatDecimal(europeScale(mapCountries).factor, 1)}x
                larger
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <EuropeDemandMap countries={mapCountries} />
          </CardContent>
        </Card>
      </div>

      <MapLegend />

      <Card size="sm">
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <CardTitle>
              <h2>
                Where we lose the demand: money searches (send, delivery,
                florist)
              </h2>
            </CardTitle>
            <CardDescription>
              Sorted by money searches that saw us
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-right">
                <th className="py-1.5 text-left font-normal">Country</th>
                <th className="py-1.5 font-normal">Money searches</th>
                <th className="py-1.5 font-normal">Clicks</th>
                <th className="py-1.5 font-normal">Click rate</th>
                <th className="py-1.5 font-normal">vs prev. 28 days</th>
              </tr>
            </thead>
            <tbody>
              {moneyRows.map((c) => {
                const rate =
                  c.moneyImpressions > 0
                    ? c.moneyClicks / c.moneyImpressions
                    : 0;
                return (
                  <tr
                    key={c.country}
                    className="border-t border-border text-right"
                  >
                    <td className="py-2 text-left font-medium">
                      {countryName(c.country)}
                    </td>
                    <td className="py-2">{formatInt(c.moneyImpressions)}</td>
                    <td className="py-2">{formatInt(c.moneyClicks)}</td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
                          rate < moneyRate
                            ? "bg-[#fbe9df] text-[#8a3a10]"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {formatRate(rate)}
                      </span>
                    </td>
                    <td className="py-2">
                      {formatChange(
                        growth(c.moneyImpressions, c.prevMoneyImpressions),
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="pt-2 text-xs text-muted-foreground">
            Orange click rate: below the {formatRate(moneyRate)} average for
            money searches.
          </p>
        </CardContent>
      </Card>

      {demand.ads ? <AdsHistory ads={demand.ads} /> : null}

      <p className="text-xs text-muted-foreground">
        Search Console, {sc.sites.length} sites, web search, impressions by
        searcher country: {formatDay(sc.current.start)} to{" "}
        {formatDay(sc.current.end)} vs the previous 28 days (
        {formatDay(sc.previous.start)} to {formatDay(sc.previous.end)}).
        Year-on-year is not comparable: the shop moved to Shopify in November
        2025 and every URL changed. Money searches match send, delivery, florist
        and their Spanish, Italian, German and French forms. Boundaries: Natural
        Earth 1:110m; world in Equal Earth, Europe in Lambert azimuthal
        equal-area (both equal-area, so no country looks bigger than it is).
        Refreshed once a day.
      </p>
    </>
  );
}

function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-xs">
      <span className="flex items-center gap-2">
        {[10, 18, 28].map((size) => (
          <span
            key={size}
            className="rounded-full border-[1.5px] border-muted-foreground/60"
            style={{ width: size, height: size }}
            aria-hidden
          />
        ))}
        Bubble area = searches that showed one of our pages
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span>vs previous 28 days</span>
        <span className="flex" aria-hidden>
          {CHANGE_COLORS.map((color) => (
            <span
              key={color}
              className="h-3 w-5 sm:w-6"
              style={{ background: color }}
            />
          ))}
        </span>
        <span>shrinking · flat (±3%) · growing</span>
      </span>
    </div>
  );
}
