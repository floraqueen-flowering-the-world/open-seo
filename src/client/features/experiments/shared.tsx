import type { ReactNode } from "react";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent } from "@/client/components/ui/card";
import { cn } from "cn";
import {
  formatChange,
  formatDecimal,
  formatInt,
} from "@/client/features/demand/format";
import type { EngineStatus } from "@/types/schemas/experiments";

export type Tone = "good" | "bad" | "neutral";

export const STATUS_LABEL: Record<EngineStatus, string> = {
  proposed: "Proposed",
  approved: "Approved",
  live: "Live",
  measuring: "Measuring",
  extended: "Extended to day 56",
  review: "Ready for review",
  kept: "Kept",
  reverted: "Reverted",
  invalid: "Invalid",
  too_small: "Too small to judge",
};

const STATUS_BADGE: Record<
  EngineStatus,
  "secondary" | "info" | "warning" | "success" | "destructive" | "outline"
> = {
  proposed: "secondary",
  approved: "secondary",
  live: "info",
  measuring: "info",
  extended: "warning",
  review: "warning",
  kept: "success",
  reverted: "destructive",
  invalid: "outline",
  too_small: "outline",
};

export function StatusBadge({ status }: { status: EngineStatus }) {
  return <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const VERDICT_LABEL: Record<string, string> = {
  win: "Win",
  loss: "Loss",
  grey: "Grey",
  flat: "Flat, kept",
  harm: "Harm",
  too_small: "Too small",
  measuring: "Measuring",
};

export function verdictLabel(verdict: string | null) {
  return verdict ? (VERDICT_LABEL[verdict] ?? verdict) : "—";
}

export const AGENT_LABEL: Record<string, string> = {
  tailor: "Tailor",
  cartographer: "Cartographer",
  herald: "Herald",
};

/** "tailor:localize:collection" -> "Localize · collection" */
export function playbookLabel(playbook: string | null) {
  if (!playbook) return "—";
  const [, fix, family] = playbook.split(":");
  return `${(fix ?? "").replace(/_/g, " ")} · ${(family ?? "").replace(/_/g, " ")}`;
}

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-success",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

export function formatLift(value: number | null) {
  return value === null ? "—" : formatChange(value, 1);
}

export function formatBand(lo: number | null, hi: number | null) {
  if (lo === null && hi === null) return "—";
  const side = (v: number | null, inf: string) =>
    v === null ? inf : formatChange(v, 0);
  return `${side(lo, "−∞")} to ${side(hi, "+∞")}`;
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return "—";
  return digits ? formatDecimal(value, digits) : formatInt(value);
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

export function formatDay(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** The date `days` after an ISO day. */
export function shiftDay(iso: string, days: number) {
  return new Date(
    Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + days * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
}

const BAR_RANGE = 0.6; // the bar spans -60% to +60%; wider bands are clipped

/**
 * A one-line forest plot: dot = estimate, bar = 90% band, colour by the
 * three-colour rule. Clipped ends get an arrow.
 */
export function LiftBar({
  lift,
  lo,
  hi,
  tone,
  width = 120,
}: {
  lift: number | null;
  lo: number | null;
  hi: number | null;
  tone: Tone;
  width?: number;
}) {
  const height = 14;
  const x = (v: number) =>
    ((Math.max(-BAR_RANGE, Math.min(BAR_RANGE, v)) + BAR_RANGE) /
      (2 * BAR_RANGE)) *
    width;
  const from = lo === null ? 0 : x(lo);
  const to = hi === null ? width : x(hi);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", TONE_TEXT[tone])}
      role="img"
      aria-label={
        lift === null
          ? "No estimate yet"
          : `${formatLift(lift)}, 90% band ${formatBand(lo, hi)}`
      }
    >
      <line
        x1={width / 2}
        x2={width / 2}
        y1={0}
        y2={height}
        className="stroke-border"
        strokeWidth={1}
      />
      {lift !== null ? (
        <>
          <line
            x1={from}
            x2={to}
            y1={height / 2}
            y2={height / 2}
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <circle cx={x(lift)} cy={height / 2} r={3.5} fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}

export function Kpi({
  label,
  value,
  note,
  tone = "neutral",
  children,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            tone !== "neutral" && TONE_TEXT[tone],
          )}
        >
          {value}
        </div>
        {note ? (
          <div className="text-xs text-muted-foreground">{note}</div>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}
