import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sortBy } from "remeda";
import { QueryError } from "@/client/components/QueryState";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/client/components/ui/empty";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { getClimberExperiments } from "@/serverFunctions/experiments";
import {
  AGENTS,
  ENGINE_STATUSES,
  SIZE_TIERS,
  type ExperimentsSearch,
} from "@/types/schemas/experiments";
import {
  AGENT_LABEL,
  LiftBar,
  STATUS_LABEL,
  StatusBadge,
  formatBand,
  formatLift,
  formatNumber,
  playbookLabel,
} from "./shared";

const SHOWN = 300;
const ALL = "all";

const TIER_LABEL = {
  T0: "T0 · under 10 clicks",
  T1: "T1 · 10 to 99",
  T2: "T2 · 100+",
} as const;

export function ExperimentListTab({
  search,
  onSearch,
}: {
  search: ExperimentsSearch;
  onSearch: (next: ExperimentsSearch) => void;
}) {
  const [text, setText] = useState("");
  const query = useQuery({
    queryKey: ["climberExperiments"],
    queryFn: () => getClimberExperiments(),
    staleTime: 5 * 60 * 1000,
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        fallback="Failed to load experiments."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }
  const all = query.data?.experiments ?? [];
  const playbooks = sortBy(
    [...new Set(all.map((e) => e.playbook).filter((p) => p !== null))],
    (p) => p,
  );
  const needle = text.trim().toLowerCase();
  const rows = all.filter(
    (e) =>
      (!search.agent || e.agent === search.agent) &&
      (!search.playbook || e.playbook === search.playbook) &&
      (!search.status || e.status === search.status) &&
      (!search.tier || e.tier === search.tier) &&
      (!needle ||
        e.url.toLowerCase().includes(needle) ||
        e.title.toLowerCase().includes(needle)),
  );

  const filters = [
    {
      key: "agent" as const,
      label: "Agent",
      items: AGENTS.map((a) => ({ value: a, label: AGENT_LABEL[a] ?? a })),
    },
    {
      key: "playbook" as const,
      label: "Playbook",
      items: playbooks.map((p) => ({ value: p, label: playbookLabel(p) })),
    },
    {
      key: "status" as const,
      label: "Status",
      items: ENGINE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    },
    {
      key: "tier" as const,
      label: "Size tier",
      items: SIZE_TIERS.map((t) => ({ value: t, label: TIER_LABEL[t] })),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => {
          const items = [
            { value: ALL, label: `Any ${f.label.toLowerCase()}` },
            ...f.items,
          ];
          return (
            <Select
              key={f.key}
              items={items}
              value={search[f.key] ?? ALL}
              onValueChange={(value) =>
                onSearch({
                  [f.key]: value === ALL || value === null ? undefined : value,
                })
              }
            >
              <SelectTrigger size="sm" aria-label={`Filter by ${f.label}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search a page"
          aria-label="Search a page"
          className="h-8 w-56"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length === all.length
            ? `${formatNumber(all.length)} changed pages`
            : `${formatNumber(rows.length)} of ${formatNumber(all.length)}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty variant="dashed">
          <EmptyHeader>
            <EmptyTitle>
              {all.length
                ? "Nothing matches these filters"
                : "No experiments yet"}
            </EmptyTitle>
            <EmptyDescription>
              {all.length
                ? "Clear a filter to see more pages."
                : "Each page an agent changes appears here with its natural peers and its verdict. The nightly run starts at 02:00 (Madrid)."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Agent · playbook</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Day</TableHead>
                <TableHead>Clicks vs natural peers</TableHead>
                <TableHead>Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, SHOWN).map((e) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer"
                  onClick={() => onSearch({ exp: e.id })}
                >
                  <TableCell className="max-w-72">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSearch({ exp: e.id });
                      }}
                    >
                      {e.title}
                    </button>
                    <div className="truncate text-xs text-muted-foreground">
                      #{e.id} · {e.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {e.agent ? (AGENT_LABEL[e.agent] ?? e.agent) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {playbookLabel(e.playbook)}
                      {e.market ? ` · ${e.market.toUpperCase()}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{e.tier}</TableCell>
                  <TableCell>
                    <StatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.day === null ? "—" : e.day}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <LiftBar
                        lift={e.lift}
                        lo={e.lo}
                        hi={e.hi}
                        tone={e.tone}
                      />
                      <div className="text-xs tabular-nums">
                        <div className="font-medium">
                          {e.measurable
                            ? formatLift(e.lift)
                            : e.lift === null
                              ? "not judged yet"
                              : "too small alone"}
                        </div>
                        {e.measurable ? (
                          <div className="text-muted-foreground">
                            {formatBand(e.lo, e.hi)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64 text-xs text-muted-foreground">
                    <span className="line-clamp-2">
                      {e.harm ?? e.decisionReason ?? "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {rows.length > SHOWN ? (
        <p className="text-xs text-muted-foreground">
          Showing the newest {SHOWN}. Filter to narrow the list.
        </p>
      ) : null}
    </div>
  );
}
