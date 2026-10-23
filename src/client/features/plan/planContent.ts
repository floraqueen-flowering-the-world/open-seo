import { PLAN_STEPS } from "./planSteps";

export type TaskStatus = "done" | "running" | "waiting" | "todo";
export type AgentId = "surveyor" | "tailor" | "cartographer" | "herald";
type TableId = "gsc" | "ranks" | "beh" | "cla" | "tiers" | "rev" | "exp";

export type Plan = {
  updated: string;
  goal: { headline: string; detail: string };
  tables: Record<TableId, { name: string; what: string; live: boolean }>;
  agents: {
    id: AgentId;
    n: number;
    name: string;
    color: string;
    job: string;
    does: string;
    reads: { table: TableId; what: string }[];
    calls: string[];
    runs: string;
    state: string;
    gain: number | null;
  }[];
  steps: {
    title: string;
    why: string;
    gain: number | null;
    owner: AgentId | null;
    tasks: { text: string; status: TaskStatus; added?: true }[];
  }[];
};

export type PlanStep = Plan["steps"][number];

// The SEO desk, moved from docs/seo-agent/seo-desk.html in the SEO repo.
// Static for now; a later step drives the statuses from Supabase.
export const PLAN: Plan = {
  updated: "23 Oct 2026",
  goal: {
    headline: "10x non-brand organic clicks",
    detail:
      "from 31.838 to about 318.000 every 28 days. Nine steps, run by four agents. Nothing changes on the site without Javier's approval.",
  },
  tables: {
    gsc: {
      name: "seo_gsc_daily",
      what: "clicks, impressions, position per page and query",
      live: true,
    },
    ranks: {
      name: "seo_keyword_ranks",
      what: "27 money keywords, 8 markets",
      live: true,
    },
    beh: {
      name: "seo_behaviour_daily",
      what: "organic and AI visits per landing page",
      live: true,
    },
    cla: {
      name: "seo_clarity_daily",
      what: "scroll, rage clicks, quick backs per page",
      live: true,
    },
    tiers: {
      name: "page_tiers",
      what: "money / keep / prune per page and market",
      live: false,
    },
    rev: {
      name: "page_revenue",
      what: "orders and revenue per landing page",
      live: false,
    },
    exp: {
      name: "seo_experiments",
      what: "proposals, baselines, verdicts",
      live: true,
    },
  },
  agents: [
    {
      id: "surveyor",
      n: 1,
      name: "Surveyor",
      color: "#1b6c80",
      job: "Measure everything and decide where to focus",
      does: "The only agent that calls the data sources on a schedule. It writes every table, sorts pages into tiers, and judges each change at day 14 or 28.",
      reads: [],
      calls: [
        "Search Console: 1 pull a day · 2.000 index checks a day",
        "OpenSEO · DataForSEO: 27 rank checks a day · 0,20 $",
        "PostHog EU: 1 query a day",
        "Microsoft Clarity: 1 of 10 daily calls",
        "Shopify (read): orders 1 pull a day · pages weekly",
        "Florist and order data: 1 pull a week (to connect)",
      ],
      runs: "06:30 data · 07:00 Clarity · 09:00 judge",
      state: "Data jobs live",
      gain: null,
    },
    {
      id: "tailor",
      n: 2,
      name: "Tailor",
      color: "#b0602a",
      job: "Fix what we have: local language and blog guides",
      does: "Local titles on .es, .it, .de and .fr, the redirects, better guide titles, and guides that link to what we sell.",
      reads: [
        {
          table: "gsc",
          what: "ccTLD pages with English titles; guides at position 4–20",
        },
        { table: "beh", what: "guide → collection clicks" },
        { table: "cla", what: "scroll depth on the top guides" },
      ],
      calls: [
        "Claude Haiku: drafts only, ≤ 0,30 $ a night",
        "Shopify write: only after Javier's yes, one at a time",
      ],
      runs: "nightly 02:00 · 5 changes a night to start",
      state: "Batch 1 waiting for Javier",
      gain: 11_500,
    },
    {
      id: "cartographer",
      n: 3,
      name: "Cartographer",
      color: "#5a6fb0",
      job: "Win the money cities and know which pages make money",
      does: "Deep local pages for ~200 cities per market, links between them, built from the pages that really make money.",
      reads: [
        { table: "gsc", what: "city pages: clicks and position" },
        { table: "ranks", what: "money keywords per market" },
        { table: "tiers", what: "money tier only" },
        { table: "rev", what: "revenue per landing page" },
      ],
      calls: [
        "DataForSEO: city search volumes, once per market (~1 $)",
        "Claude Haiku: local-proof drafts",
        "Shopify write: only after Javier's yes",
      ],
      runs: "nightly 02:00 · tiers Mon",
      state: "Spec written",
      gain: 18_900,
    },
    {
      id: "herald",
      n: 4,
      name: "Herald",
      color: "#7a8a3a",
      job: "Grow AI presence, stars and FAQ in Google",
      does: "Checks AI bots can read reviews and FAQs, tracks AI visits and citations, earns roundup mentions, adds rich results.",
      reads: [
        { table: "beh", what: "AI-referred visits per page" },
        { table: "cla", what: "AITools channel" },
        { table: "gsc", what: "rich-result appearance" },
      ],
      calls: [
        "OpenSEO AI visibility: 20 prompts a week (~3,40 $ a month)",
        "DataForSEO: 10 roundup SERPs per market, once (~0,20 $)",
        "Bing Webmaster Tools: 1 read a week",
        "Raw HTML of 35 pages: 1 fetch a week",
      ],
      runs: "weekly Tue · nightly flags",
      state: "Spec written",
      gain: 2_320,
    },
  ],
  steps: PLAN_STEPS,
};
