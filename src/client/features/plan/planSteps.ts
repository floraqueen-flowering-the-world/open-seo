import type { PlanStep } from "./planContent";

// The nine steps to 10x, in the order we run them. `added` marks tasks added
// since the desk moved into OpenSEO.
export const PLAN_STEPS: PlanStep[] = [
  {
    title: "Measure everything first",
    why: "Every change needs a before-and-after number, or we repeat the summer: 12.000 edits and no idea which worked.",
    gain: null,
    owner: "surveyor",
    tasks: [
      { text: "Search Console refresh every day (06:30)", status: "done" },
      { text: "Clarity snapshot every day (07:00)", status: "done" },
      {
        text: "Rank tracking for the money keywords, 5 sites daily",
        status: "done",
      },
      { text: "Experiments page in OpenSEO", status: "done" },
      {
        text: "Connect Search Console inside the 5 OpenSEO projects",
        status: "done",
      },
      { text: "Check the first Clarity data", status: "done" },
      {
        text: "Google Ads history archived in Supabase: which searches converted, by market and month",
        status: "done",
        added: true,
      },
      {
        text: "Demand map and this plan inside OpenSEO",
        status: "done",
        added: true,
      },
      {
        text: "Autonomous engine: low-risk changes by risk tier, each judged against natural peers, kept or reverted",
        status: "running",
        added: true,
      },
      {
        text: "Revenue per landing page from Shopify orders, into page_revenue",
        status: "todo",
      },
      { text: "Approval step on the desk (y / edit / n)", status: "todo" },
      {
        text: "Daily judge at day 14 / 28 with keep or revert",
        status: "todo",
      },
    ],
  },
  {
    title: "Decide where to focus",
    why: "14.000 city pages, but only about 200 per market matter. Sort them before spending effort on any.",
    gain: null,
    owner: "surveyor",
    tasks: [
      {
        text: "Find out why 6.449 .com pages are never shown in Google: 894 have demand but are invisible, 449 duplicate a shown page, two thirds are the thin review-header template",
        status: "done",
      },
      {
        text: "Demand radar: where demand is moving by market and destination, with push / hold / leave",
        status: "done",
        added: true,
      },
      {
        text: "Strengthen the 894 invisible pages with demand (Acapulco 14.800 searches, Dallas, Austin 6.600…)",
        status: "todo",
      },
      {
        text: "Point the 449 duplicates to their shown sibling (canonical, Javier's approval)",
        status: "todo",
      },
      {
        text: "Finish Google index checks on the other ~5.800 pages (2.000 a day)",
        status: "todo",
      },
      {
        text: "Sort cities per market into money / keep / prune (page_tiers)",
        status: "todo",
      },
      {
        text: "Connect florist and delivery data (cut-off, price, coverage)",
        status: "todo",
      },
      { text: "Pick the 20 pilot cities, 4 per market", status: "todo" },
    ],
  },
  {
    title: "Speak the local language",
    why: "60 of the top 60 Spanish, Italian, German and French guides show an English title in Google.",
    gain: 3_100,
    owner: "tailor",
    tasks: [
      { text: "Approve 6 local-title tests in batch 1", status: "waiting" },
      {
        text: "Apply the 160 reviewed redirects (151 ok + 9 fix)",
        status: "waiting",
      },
      {
        text: "Translate the SEO titles of the top 200 .es guides",
        status: "todo",
      },
      { text: "Fix the broken title on .es flowers-russia", status: "todo" },
      {
        text: "Translate the meta titles of the 89 redirect targets",
        status: "todo",
      },
    ],
  },
  {
    title: "Turn blog guides into rankings and buyers",
    why: "Guides bring 73% of clicks but never link to anything we sell.",
    gain: 8_400,
    owner: "tailor",
    tasks: [
      {
        text: "Approve 3 .com tests in batch 1 (spirit animal title, broken description, birthday link block)",
        status: "waiting",
      },
      {
        text: "Link the top guides to their matching collection",
        status: "todo",
      },
      {
        text: "Rewrite titles on the top 100 .com guides with low click rate",
        status: "todo",
      },
      { text: "Recover the falling .it birthday guides", status: "todo" },
      { text: "Refresh guides ranking 4–20 with FAQ blocks", status: "todo" },
    ],
  },
  {
    title: "Win the money cities",
    why: "Money searches see our city pages at position ~21, where nobody clicks. Competitors win with deep local pages.",
    gain: 17_400,
    owner: "cartographer",
    tasks: [
      {
        text: "Design a local-proof block (cut-off time, delivery price, florists, reviews)",
        status: "todo",
      },
      {
        text: "Pilot it on the 20 cities and judge at day 28",
        status: "todo",
      },
      {
        text: 'Fix pages that rank with the wrong city ("send flowers to spain" → Madrid)',
        status: "todo",
      },
      {
        text: "Prune or merge pages that never earn a click (January, after the Christmas freeze)",
        status: "todo",
      },
    ],
  },
  {
    title: "Link the money pages together",
    why: "Only for the money cities, not all 14.000: country pages should point to their best cities.",
    gain: 1_500,
    owner: "cartographer",
    tasks: [
      {
        text: "Fix the 4 links on .es flores-espana that return 404",
        status: "todo",
      },
      {
        text: "Swap English links in the .es menu for local ones",
        status: "todo",
      },
      {
        text: "Country pages link to their money cities (pilot 20 first)",
        status: "todo",
      },
      {
        text: "Weekly crawl to check depth and broken links",
        status: "todo",
      },
    ],
  },
  {
    title: "Know and grow our AI presence",
    why: "Find out if ChatGPT, Copilot and AI Overviews can read us and quote us, then earn the mentions.",
    gain: 2_100,
    owner: "herald",
    tasks: [
      {
        text: "Check whether reviews (+18K, 4,8/5) and FAQs are in the raw HTML or only in an app's JavaScript",
        status: "todo",
      },
      {
        text: "Baseline AI visits: Clarity AITools channel and PostHog AI referrals",
        status: "todo",
      },
      {
        text: "Verify the 5 sites in Bing Webmaster Tools and read its AI Performance report",
        status: "waiting",
      },
      {
        text: "Start OpenSEO's AI-visibility tracker (about 3,40 $ a month)",
        status: "todo",
      },
      {
        text: "List the gift roundups that name competitors but not us",
        status: "todo",
      },
      { text: "Fact-block pilot on 3 money pages", status: "todo" },
    ],
  },
  {
    title: "Stars and FAQ in Google",
    why: "A small gain, because Google limits review stars for shops. Worth doing once the pages above improve.",
    gain: 220,
    owner: "herald",
    tasks: [
      { text: "Check which products have real ratings", status: "todo" },
      {
        text: "ItemList + FAQ markup on 10 pages vs 10 untouched",
        status: "todo",
      },
    ],
  },
  {
    title: "Lighter pages",
    why: "About 340 KB of scripts could load later. It mostly protects sales and crawling, not clicks. Parked: no agent yet.",
    gain: 550,
    owner: null,
    tasks: [
      {
        text: "Weekly speed baseline per template (PageSpeed)",
        status: "todo",
      },
      {
        text: "Load search and sign-in scripts only when used, on blog pages",
        status: "todo",
      },
      { text: "Turn on real-user speed tracking in PostHog", status: "todo" },
    ],
  },
];
