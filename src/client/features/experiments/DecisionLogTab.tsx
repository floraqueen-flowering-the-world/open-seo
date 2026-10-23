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
import { getClimberDecisions } from "@/serverFunctions/experiments";
import type { ExperimentsSearch } from "@/types/schemas/experiments";
import { formatDateTime, formatNumber } from "./shared";

const ACTOR_KINDS = [
  { value: "all", label: "Anyone" },
  { value: "agent", label: "Agents (nightly)" },
  { value: "judge", label: "Judge" },
  { value: "person", label: "People" },
  { value: "system", label: "System" },
] as const;

type ActorKind = (typeof ACTOR_KINDS)[number]["value"];

/** "climber:judge" is the judge, other "climber:*" are agents, an email or a name is a person. */
function actorKind(actor: string): Exclude<ActorKind, "all"> {
  if (actor === "climber:judge" || actor === "climber:placebo") return "judge";
  if (actor.startsWith("climber:")) return "agent";
  if (actor === "system") return "system";
  return "person";
}

export function DecisionLogTab({
  onSearch,
}: {
  onSearch: (next: ExperimentsSearch) => void;
}) {
  const [kind, setKind] = useState<ActorKind>("all");
  const [action, setAction] = useState("all");
  const [text, setText] = useState("");
  const query = useQuery({
    queryKey: ["climberDecisions"],
    queryFn: () => getClimberDecisions(),
    staleTime: 60 * 1000,
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        fallback="Failed to load the decision log."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }
  const all = query.data?.decisions ?? [];
  const actions = [
    { value: "all", label: "Any action" },
    ...sortBy([...new Set(all.map((d) => d.action))], (a) => a).map((a) => ({
      value: a,
      label: a.replace(/_/g, " "),
    })),
  ];
  const needle = text.trim().toLowerCase();
  const rows = all.filter(
    (d) =>
      (kind === "all" || actorKind(d.actor) === kind) &&
      (action === "all" || d.action === action) &&
      (!needle ||
        [d.reason, d.url, d.actor, d.category, String(d.experimentId ?? "")]
          .join(" ")
          .toLowerCase()
          .includes(needle)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={ACTOR_KINDS}
          value={kind}
          onValueChange={(value) => {
            const item = ACTOR_KINDS.find((k) => k.value === value);
            if (item) setKind(item.value);
          }}
        >
          <SelectTrigger size="sm" aria-label="Filter by who decided">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTOR_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={actions}
          value={action}
          onValueChange={(value) => setAction(value ?? "all")}
        >
          <SelectTrigger size="sm" aria-label="Filter by action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actions.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search reasons, pages, people"
          aria-label="Search the decision log"
          className="h-8 w-64"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {formatNumber(rows.length)} entries
          {all.length >= (query.data?.limit ?? Infinity)
            ? ` (latest ${formatNumber(query.data?.limit ?? 0)})`
            : ""}
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty variant="dashed">
          <EmptyHeader>
            <EmptyTitle>No decisions match</EmptyTitle>
            <EmptyDescription>
              Every status change, category approval and kill-switch flip is
              logged here by the database itself, with who and why.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>On</TableHead>
                <TableHead>Why</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatDateTime(d.at)}
                  </TableCell>
                  <TableCell className="text-xs">{d.actor}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {d.action.replace(/_/g, " ")}
                    </div>
                    {d.fromStatus || d.toStatus ? (
                      <div className="text-xs text-muted-foreground">
                        {d.fromStatus ?? "new"} → {d.toStatus ?? "—"}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-64 text-xs">
                    {d.experimentId ? (
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() =>
                          onSearch({
                            tab: "experiments",
                            exp: d.experimentId ?? undefined,
                          })
                        }
                      >
                        #{d.experimentId}{" "}
                        <span className="break-all text-muted-foreground">
                          {d.url?.replace(/^https?:\/\/(www\.)?/, "")}
                        </span>
                      </button>
                    ) : d.category ? (
                      <span>category {d.category}</span>
                    ) : d.batchId ? (
                      <span>batch {d.batchId}</span>
                    ) : (
                      <span className="text-muted-foreground">program</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-96 text-xs break-words text-muted-foreground">
                    {d.reason ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
