// The workspace Demand page: Search Console impressions and clicks by searcher
// country for every connected project (last 28 days vs the 28 before), split
// into all searches and money searches, plus the archived Google Ads history
// from Climber's Supabase (proven converting terms, seasonality).
//
// Search Console has no per-country history in Supabase for 56 days, so this
// calls the GSC API with each project's own connection: 4 calls per site
// (2 periods x all/money), cached for 24 hours in KV.
import { env } from "cloudflare:workers";
import { identity, sortBy } from "remeda";
import { z } from "zod";
import {
  GscConnectionRepository,
  type GscConnection,
} from "@/server/features/gsc/repositories/GscConnectionRepository";
import { createGscClient } from "@/server/lib/gscClient";
import {
  climberRestGet,
  getClimberSupabaseConfig,
} from "@/server/lib/climberSupabase";

const CACHE_SECONDS = 24 * 60 * 60;
const GSC_LAG_DAYS = 3;

// Commercial intent: send / delivery / florist in EN, ES, IT, DE and FR (RE2).
const MONEY_REGEX =
  "send|deliver|florist|enviar|envío|envio|domicilio|floristería|floristeria|spedire|spedizion|consegna|fiorist|fioraio|verschicken|versenden|liefer|blumenversand|livraison|envoyer|fleuriste";

const countryDemandSchema = z.object({
  country: z.string(),
  impressions: z.coerce.number(),
  clicks: z.coerce.number(),
  prevImpressions: z.coerce.number(),
  prevClicks: z.coerce.number(),
  moneyImpressions: z.coerce.number(),
  moneyClicks: z.coerce.number(),
  prevMoneyImpressions: z.coerce.number(),
  prevMoneyClicks: z.coerce.number(),
});

const demandSchema = z.object({
  current: z.object({ start: z.string(), end: z.string() }),
  previous: z.object({ start: z.string(), end: z.string() }),
  sites: z.array(z.string()),
  failedSites: z.array(z.string()),
  countries: z.array(countryDemandSchema),
  fetchedAt: z.string(),
});

const topTermSchema = z.object({
  market: z.string(),
  search_term: z.string(),
  rank: z.coerce.number(),
  conversions: z.coerce.number(),
  clicks: z.coerce.number(),
  market_conversions: z.coerce.number(),
});

const seasonalitySchema = z.object({
  month: z.coerce.number(),
  share_pct: z.coerce.number(),
  first_year: z.coerce.number(),
  last_year: z.coerce.number(),
});

type CountryDemand = z.infer<typeof countryDemandSchema>;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBefore(d: Date, days: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() - days);
  return out;
}

function windows(today: Date) {
  const end = daysBefore(today, GSC_LAG_DAYS);
  return {
    current: { start: isoDate(daysBefore(end, 27)), end: isoDate(end) },
    previous: {
      start: isoDate(daysBefore(end, 55)),
      end: isoDate(daysBefore(end, 28)),
    },
  };
}

type Field = Exclude<keyof CountryDemand, "country">;
const FIELDS: [
  period: "current" | "previous",
  money: boolean,
  impr: Field,
  clicks: Field,
][] = [
  ["current", false, "impressions", "clicks"],
  ["previous", false, "prevImpressions", "prevClicks"],
  ["current", true, "moneyImpressions", "moneyClicks"],
  ["previous", true, "prevMoneyImpressions", "prevMoneyClicks"],
];

function bareHost(siteUrl: string) {
  const host = siteUrl.startsWith("sc-domain:")
    ? siteUrl.slice("sc-domain:".length)
    : new URL(siteUrl).hostname;
  return host.replace(/^www\./, "");
}

// Two projects can point at overlapping properties (sc-domain:floraqueen.com
// and https://www.floraqueen.com/). Count each search once: a domain property
// covers every URL-prefix property on its host.
function distinctProperties(connections: GscConnection[]) {
  const domains = new Set(
    connections
      .filter((c) => c.siteUrl.startsWith("sc-domain:"))
      .map((c) => bareHost(c.siteUrl)),
  );
  const seen = new Set<string>();
  return connections.filter((c) => {
    if (seen.has(c.siteUrl)) return false;
    seen.add(c.siteUrl);
    return (
      c.siteUrl.startsWith("sc-domain:") || !domains.has(bareHost(c.siteUrl))
    );
  });
}

async function loadSearchConsole(organizationId: string, today: Date) {
  const range = windows(today);
  const connections = distinctProperties(
    await GscConnectionRepository.listByOrganizationId(organizationId),
  );
  const byCountry = new Map<string, CountryDemand>();
  const failedSites: string[] = [];

  await Promise.all(
    connections.map(async (connection) => {
      const client = createGscClient({
        userId: connection.connectedByUserId,
        gscAccountId: connection.gscAccountId ?? undefined,
      });
      try {
        const results = await Promise.all(
          FIELDS.map(([period, money]) =>
            client.querySearchAnalytics(connection.siteUrl, {
              startDate: range[period].start,
              endDate: range[period].end,
              dimensions: ["country"],
              rowLimit: 1000,
              type: "web",
              ...(money
                ? {
                    dimensionFilterGroups: [
                      {
                        groupType: "and" as const,
                        filters: [
                          {
                            dimension: "query",
                            operator: "includingRegex",
                            expression: MONEY_REGEX,
                          },
                        ],
                      },
                    ],
                  }
                : {}),
            }),
          ),
        );
        results.forEach((rows, i) => {
          const [, , imprField, clickField] = FIELDS[i];
          for (const row of rows) {
            const country = row.keys?.[0];
            if (!country || country === "zzz") continue;
            const entry =
              byCountry.get(country) ??
              ({
                country,
                impressions: 0,
                clicks: 0,
                prevImpressions: 0,
                prevClicks: 0,
                moneyImpressions: 0,
                moneyClicks: 0,
                prevMoneyImpressions: 0,
                prevMoneyClicks: 0,
              } satisfies CountryDemand);
            entry[imprField] += row.impressions;
            entry[clickField] += row.clicks;
            byCountry.set(country, entry);
          }
        });
      } catch (error) {
        console.error(
          "Demand: Search Console read failed",
          connection.siteUrl,
          error,
        );
        failedSites.push(connection.siteUrl);
      }
    }),
  );

  return {
    ...range,
    sites: sortBy(
      connections.map((c) => c.siteUrl),
      identity(),
    ),
    failedSites: sortBy(failedSites, identity()),
    countries: sortBy([...byCountry.values()], [(c) => c.impressions, "desc"]),
    fetchedAt: new Date().toISOString(),
  };
}

async function getSearchConsoleDemand(organizationId: string) {
  const today = new Date();
  const key = `demand:gsc-country:v2:${organizationId}:${windows(today).current.end}`;
  const cached = demandSchema.safeParse(await env.KV.get(key, "json"));
  if (cached.success) return cached.data;
  const fresh = await loadSearchConsole(organizationId, today);
  // A partial read (a site's grant expired) is shown but not cached.
  if (fresh.failedSites.length === 0 && fresh.sites.length > 0) {
    await env.KV.put(key, JSON.stringify(fresh), {
      expirationTtl: CACHE_SECONDS,
    });
  }
  return fresh;
}

async function getAdsHistory() {
  const config = await getClimberSupabaseConfig();
  if (!config) return null;
  const [terms, seasonality] = await Promise.all([
    climberRestGet(
      config,
      "climber_ads_top_terms_v?select=market,search_term,rank,conversions,clicks,market_conversions&rank=lte.5&order=market_conversions.desc,rank.asc",
      topTermSchema,
    ),
    climberRestGet(
      config,
      "climber_ads_seasonality_v?select=month,share_pct,first_year,last_year&order=month.asc",
      seasonalitySchema,
    ),
  ]);
  return {
    terms: terms.map((t) => ({
      market: t.market,
      term: t.search_term,
      rank: t.rank,
      conversions: t.conversions,
      clicks: t.clicks,
      marketConversions: t.market_conversions,
    })),
    seasonality: seasonality.map((s) => ({
      month: s.month,
      sharePct: s.share_pct,
    })),
    seasonYears: seasonality[0]
      ? { first: seasonality[0].first_year, last: seasonality[0].last_year }
      : null,
  };
}

async function getDemand(organizationId: string) {
  const [searchConsole, ads] = await Promise.all([
    getSearchConsoleDemand(organizationId),
    getAdsHistory(),
  ]);
  return { searchConsole, ads };
}

export const DemandService = { getDemand };
