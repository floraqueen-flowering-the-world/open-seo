import { PageHeader, SectionHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { formatInt } from "@/client/features/demand/format";

import { PLAN, type AgentId, type TaskStatus } from "./planContent";

const STATUS: Record<
  TaskStatus,
  { label: string; variant: "success" | "info" | "warning" | "outline" }
> = {
  done: { label: "Done", variant: "success" },
  running: { label: "Running", variant: "info" },
  waiting: { label: "Waiting for Javier", variant: "warning" },
  todo: { label: "To do", variant: "outline" },
};

const agentById = new Map(PLAN.agents.map((a) => [a.id, a]));

function AgentTag({ id }: { id: AgentId | null }) {
  const agent = id ? agentById.get(id) : undefined;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="size-2.5 rounded-[3px]"
        style={{ background: agent?.color ?? "var(--border)" }}
        aria-hidden
      />
      {agent ? `Agent ${agent.n} · ${agent.name}` : "Parked"}
    </span>
  );
}

export function PlanPage() {
  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <PageHeader
          title="Plan"
          description={
            <>
              Goal: <b className="text-foreground">{PLAN.goal.headline}</b>,{" "}
              {PLAN.goal.detail}
            </>
          }
        />

        <section className="space-y-4">
          <SectionHeader
            title="Steps to 10x"
            hint={`In the order we run them · ${PLAN.updated}`}
          />
          <div className="flex flex-wrap gap-2">
            {Object.values(STATUS).map((s) => (
              <Badge key={s.label} variant={s.variant}>
                {s.label}
              </Badge>
            ))}
          </div>
          <ol className="space-y-4">
            {PLAN.steps.map((step, i) => {
              const done = step.tasks.filter((t) => t.status === "done").length;
              return (
                <li key={step.title}>
                  <Card size="lg">
                    <CardHeader>
                      <CardTitle>
                        <h3 className="flex items-baseline gap-2">
                          <span className="tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          {step.title}
                        </h3>
                      </CardTitle>
                      <CardDescription>{step.why}</CardDescription>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                        <AgentTag id={step.owner} />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {step.gain ? (
                            <b className="font-medium text-foreground">
                              +{formatInt(step.gain)} clicks ·{" "}
                            </b>
                          ) : null}
                          {done} of {step.tasks.length} done
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="divide-y divide-border">
                        {step.tasks.map((task) => (
                          <li
                            key={task.text}
                            className="flex items-start justify-between gap-3 py-2 text-sm"
                          >
                            <span className="min-w-0">
                              {task.text}
                              {task.added ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  new
                                </span>
                              ) : null}
                            </span>
                            <Badge
                              variant={STATUS[task.status].variant}
                              className="shrink-0"
                            >
                              {STATUS[task.status].label}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted-foreground">
            Click estimates are extra non-brand clicks per 28 days at about 12
            months. Arithmetic and sources: docs/seo-agent/levers-to-10x.md in
            the SEO repo.
          </p>
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Four agents: one reads, three act"
            hint="Read once, share everywhere"
          />
          <p className="text-sm text-muted-foreground">
            Only the Surveyor calls the data sources, once a day, and stores
            everything in Supabase. The other three read just the slice they
            need from there, so no API is called twice for the same data. Their
            own outside calls are listed one by one.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {PLAN.agents.map((agent) => (
              <Card
                key={agent.id}
                size="lg"
                className="border-t-4"
                style={{ borderTopColor: agent.color }}
              >
                <CardHeader>
                  <CardDescription>
                    Agent {agent.n} · steps{" "}
                    {PLAN.steps
                      .flatMap((s, i) => (s.owner === agent.id ? [i + 1] : []))
                      .join(" + ")}
                  </CardDescription>
                  <CardTitle>
                    <h3>
                      {agent.name}: {agent.job}
                    </h3>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{agent.does}</p>
                  {agent.reads.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium">Reads from Supabase</p>
                      <ul className="mt-1 space-y-1">
                        {agent.reads.map((r) => (
                          <li key={r.table + r.what}>
                            <code className="rounded bg-muted px-1 text-xs">
                              {PLAN.tables[r.table].name}
                            </code>
                            {PLAN.tables[r.table].live ? "" : " (to build)"}{" "}
                            <span className="text-muted-foreground">
                              {r.what}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium">
                      {agent.reads.length === 0
                        ? "Calls the sources (the only agent that does)"
                        : "Its own outside calls"}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                      {agent.calls.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Gain</dt>
                    <dd>
                      {agent.gain
                        ? `+${formatInt(agent.gain)} clicks / 28 days`
                        : "Makes the others measurable"}
                    </dd>
                    <dt className="text-muted-foreground">Runs</dt>
                    <dd>{agent.runs}</dd>
                    <dt className="text-muted-foreground">State</dt>
                    <dd>{agent.state}</dd>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Not in any agent yet: step 9, Lighter pages (+550 clicks). Parked
            until the four agents are running.
          </p>
        </section>

        <footer className="border-t border-border pt-5 text-xs text-muted-foreground">
          Updated {PLAN.updated}.
        </footer>
      </div>
    </div>
  );
}
