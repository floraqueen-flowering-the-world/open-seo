import { ArrowRight } from "lucide-react";
import { PageHeader, SectionHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";

type SourceStatus = "Live" | "Live (read)" | "Archived";

// Static on purpose: this page documents FloraQueen's setup, it reads nothing.
// Numbers are written in Spanish format (32.720, 0,20 $).
const ARCHITECTURE = {
  updated: "23 Oct 2026",
  coreSources: [
    {
      name: "Search Console",
      scope: "5 sites",
      what: "Organic demand that sees us, by country, search and page.",
      cadence: "Daily 06:30",
      status: "Live",
    },
    {
      name: "Shopify orders",
      scope: null,
      what: "Real demand that converted, by destination country and date.",
      cadence: "Daily",
      status: "Live (read)",
    },
    {
      name: "Google Ads history",
      scope: "23 accounts, 2023 to 2026",
      what: "Which searches converted, by market and month.",
      cadence: "Paid campaigns stopped",
      status: "Archived",
    },
  ],
  supportingSources: [
    {
      name: "DataForSEO via OpenSEO",
      label:
        "Search volumes, Google Trends, rankings: 8 trackers, about 0,20 $ a day",
    },
    { name: "PostHog", label: "Organic visits per page" },
    { name: "Microsoft Clarity", label: "Scroll, rage clicks, AI visits" },
    {
      name: "Bing Webmaster Tools",
      label: "Pages Copilot cites; to connect",
    },
  ],
  unavailableSources: [
    {
      name: "Google Analytics",
      reason: "retired, replaced by PostHog and Clarity",
    },
    { name: "Active paid campaigns", reason: "stopped" },
    { name: "Keyword Planner", reason: "use DataForSEO instead" },
  ],
  pareto: {
    line: "2 of 4 agents carry 93% of the expected gain (30.400 of 32.720 extra clicks every 28 days).",
    share: 93,
  },
  primaryAgents: [
    {
      name: "Cartographer",
      role: "Win the money cities and know which pages make money.",
      gain: "+18.900",
    },
    {
      name: "Tailor",
      role: "Fix what we have: local language and blog guides.",
      gain: "+11.500",
    },
  ],
  supportingAgents: [
    {
      name: "Surveyor",
      role: "The only agent that reads the sources, once a day; judges every change.",
      gain: "Enables the others",
    },
    {
      name: "Herald",
      role: "AI presence, stars and FAQ in Google.",
      gain: "+2.320",
    },
  ],
  flow: [
    "Surveyor reads once",
    "Supabase (shared memory)",
    "Agents act on their slice",
    "Judge keeps or reverts",
  ],
} satisfies {
  updated: string;
  coreSources: {
    name: string;
    scope: string | null;
    what: string;
    cadence: string;
    status: SourceStatus;
  }[];
  supportingSources: { name: string; label: string }[];
  unavailableSources: { name: string; reason: string }[];
  pareto: { line: string; share: number };
  primaryAgents: { name: string; role: string; gain: string }[];
  supportingAgents: { name: string; role: string; gain: string }[];
  flow: string[];
};

const STATUS_BADGE: Record<SourceStatus, "success" | "outline"> = {
  Live: "success",
  "Live (read)": "success",
  Archived: "outline",
};

export function ArchitecturePage() {
  const a = ARCHITECTURE;
  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <PageHeader
          title="Architecture"
          description="Where our data comes from and which agents act on it."
        />

        <section className="space-y-4">
          <SectionHeader title="Sources" />
          <div className="grid gap-4 md:grid-cols-3">
            {a.coreSources.map((s) => (
              <Card key={s.name} size="lg">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>
                      <h3>{s.name}</h3>
                    </CardTitle>
                    <Badge variant={STATUS_BADGE[s.status]}>{s.status}</Badge>
                  </div>
                  {s.scope ? (
                    <CardDescription>{s.scope}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-foreground">{s.what}</p>
                  <p className="text-xs text-muted-foreground">{s.cadence}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <ul className="flex flex-wrap gap-2">
            {a.supportingSources.map((s) => (
              <li
                key={s.name}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground"> · {s.label}</span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground/80">
            Not available:{" "}
            {a.unavailableSources
              .map((s) => `${s.name} (${s.reason})`)
              .join(" · ")}
          </p>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Agents" />
          <div className="space-y-2">
            <p className="text-sm">{a.pareto.line}</p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${a.pareto.share}%` }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {a.primaryAgents.map((agent) => (
              <Card key={agent.name} size="lg">
                <CardHeader>
                  <CardTitle>
                    <h3>{agent.name}</h3>
                  </CardTitle>
                  <CardDescription>{agent.role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">
                    {agent.gain}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    clicks / 28 days
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {a.supportingAgents.map((agent) => (
              <Card key={agent.name} size="sm">
                <CardContent className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {agent.role}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums">
                    {agent.gain}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="How it flows" />
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            {a.flow.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                {i > 0 ? (
                  <ArrowRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                ) : null}
                <span className="rounded-lg border border-border bg-card px-3 py-1.5">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="border-t border-border pt-5 text-xs text-muted-foreground">
          Updated {a.updated}.
        </footer>
      </div>
    </div>
  );
}
