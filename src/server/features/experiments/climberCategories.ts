// Change categories: Javier approves or blocks whole kinds of destructive
// change, never single pages. The decision-log trigger records every flip.
import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import {
  climberRestGet,
  climberRestPatch,
  getClimberSupabaseConfig,
} from "@/server/lib/climberSupabase";
import { decisionSchema } from "./climberRows";

// ── Change categories ───────────────────────────────────────────────────────

const categorySchema = z.object({
  category: z.string(),
  approved: z.boolean(),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  note: z.string().nullable(),
  updated_at: z.string(),
});

const notYetSchema = z.object({
  category: z.string(),
  candidates: z.number(),
  clicks_28d: z.number(),
  first_seen: z.string(),
  last_seen: z.string(),
  examples: z.array(z.string()).nullable(),
  reasons: z.array(z.string()).nullable(),
});

export async function getCategories() {
  const config = await getClimberSupabaseConfig();
  if (!config) return { configured: false as const };
  const [categories, notYet, history, settings] = await Promise.all([
    climberRestGet(
      config,
      "climber_category_approvals?select=*&order=category.asc",
      categorySchema,
    ),
    climberRestGet(config, "climber_not_yet_v?select=*", notYetSchema),
    climberRestGet(
      config,
      "seo_decisions?select=id,at,experiment_id,batch_id,category,actor,action,from_status,to_status,reason&category=not.is.null&order=at.desc&limit=100",
      decisionSchema,
    ),
    climberRestGet(
      config,
      "climber_settings?select=holiday_freeze_days",
      z.object({ holiday_freeze_days: z.number() }),
    ),
  ]);
  const waiting = new Map(notYet.map((n) => [n.category, n]));
  return {
    configured: true as const,
    holidayFreezeDays: settings[0]?.holiday_freeze_days ?? null,
    categories: categories.map((c) => {
      const n = waiting.get(c.category);
      return {
        category: c.category,
        approved: c.approved,
        approvedBy: c.approved_by,
        approvedAt: c.approved_at,
        note: c.note,
        waiting: n
          ? {
              candidates: n.candidates,
              clicks28d: n.clicks_28d,
              firstSeen: n.first_seen.slice(0, 10),
              lastSeen: n.last_seen.slice(0, 10),
              examples: n.examples ?? [],
              reasons: n.reasons ?? [],
            }
          : null,
      };
    }),
    history: history.map((h) => ({
      id: h.id,
      at: h.at,
      category: h.category,
      actor: h.actor,
      action: h.action,
      reason: h.reason,
    })),
  };
}

export async function setCategoryApproval(input: {
  category: string;
  approved: boolean;
  note: string;
  userEmail: string;
}) {
  const config = await getClimberSupabaseConfig();
  if (!config) {
    throw new AppError("INTERNAL_ERROR", "Climber Supabase is not configured");
  }
  const now = new Date().toISOString();
  // approved_by is whoever made the call (the decision log trigger records it
  // as the actor for both approve and revoke).
  const rows = await climberRestPatch(
    config,
    `climber_category_approvals?category=eq.${encodeURIComponent(input.category)}`,
    {
      approved: input.approved,
      approved_by: input.userEmail,
      approved_at: now,
      note: input.note,
      updated_at: now,
    },
    categorySchema,
  );
  const [row] = rows;
  if (!row) throw new AppError("NOT_FOUND", "Unknown category");
  return { category: row.category, approved: row.approved };
}
