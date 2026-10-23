import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/client/components/FormDialog";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/client/components/ui/collapsible";
import { Label } from "@/client/components/ui/label";
import { Skeleton } from "@/client/components/ui/skeleton";
import { Textarea } from "@/client/components/ui/textarea";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getClimberCategories,
  setClimberCategoryApproval,
} from "@/serverFunctions/experiments";
import { formatDateTime, formatNumber } from "./shared";

type Category = Extract<
  Awaited<ReturnType<typeof getClimberCategories>>,
  { configured: true }
>["categories"][number];

const CATEGORY_TEXT: Record<string, { title: string; what: string }> = {
  content: {
    title: "Content changes",
    what: "Titles, meta descriptions, local-language fields, link blocks, broken-text repairs. Agents decide each page and revert on harm.",
  },
  "destructive:restore_404": {
    title: "Restore 404s that earned money",
    what: "A URL that used to get clicks or orders and now returns 404 is redirected to its live page.",
  },
  "destructive:noindex": {
    title: "Noindex dead pages",
    what: "noindex,follow on pages with no clicks in 180 days on any domain.",
  },
  "destructive:prune": {
    title: "Prune pages",
    what: "Remove or merge pages that only dilute the site.",
  },
  "destructive:redirect": {
    title: "Other redirects",
    what: "301s beyond lost money pages, for example where no confident target was found.",
  },
  "destructive:canonical": {
    title: "Canonicals",
    what: "Point a cannibalising page at the one that should rank.",
  },
  "destructive:handle": {
    title: "Handle (URL) changes",
    what: "Translate an English handle on a local domain; the old URL redirects to the new one.",
  },
  "destructive:menu": {
    title: "Menus",
    what: "Add or move links in the store's navigation.",
  },
  "destructive:theme": {
    title: "Theme files",
    what: "Edits to Liquid templates and theme settings.",
  },
  "destructive:unpublish": {
    title: "Unpublish",
    what: "Take a page off the store.",
  },
};

// Kinds the nightly agents can execute today. The others are only listed (as
// "changes we should not do yet") until their playbook ships.
const HAS_PLAYBOOK = new Set(["content", "destructive:restore_404"]);

function describe(category: string) {
  return (
    CATEGORY_TEXT[category] ?? {
      title: category.replace("destructive:", "").replace(/_/g, " "),
      what: "",
    }
  );
}

export function CategoriesTab() {
  const [editing, setEditing] = useState<Category | null>(null);
  const query = useQuery({
    queryKey: ["climberCategories"],
    queryFn: () => getClimberCategories(),
    staleTime: 60 * 1000,
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        fallback="Failed to load the change categories."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }
  const data = query.data;
  if (!data?.configured) return null;
  const blocked = data.categories.filter((c) => !c.approved);
  const approved = data.categories.filter((c) => c.approved);

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        You decide kinds of change, never single pages. While a destructive kind
        is blocked, agents list what they would do under it here. Approve it and
        it runs on its own from the next night, page by page, with the same
        snapshots and automatic reverts as content changes.
        {data.holidayFreezeDays
          ? ` Approved destructive kinds still wait on pages with seasonal demand within ${data.holidayFreezeDays} days of their peak.`
          : ""}
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Changes we should not do yet ({blocked.length})
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {blocked.map((c) => (
            <CategoryCard key={c.category} category={c} onEdit={setEditing} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Running on their own ({approved.length})
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {approved.map((c) => (
            <CategoryCard key={c.category} category={c} onEdit={setEditing} />
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Category history</CardTitle>
          <CardDescription>
            Every approval and block, from the decision log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.history.length ? (
            <ul className="space-y-2 text-sm">
              {data.history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(h.at)}
                  </span>
                  <span className="font-medium">
                    {h.action === "approve_category" ? "Approved" : "Blocked"}{" "}
                    {describe(h.category ?? "").title}
                  </span>
                  <span className="text-muted-foreground">by {h.actor}</span>
                  {h.reason ? (
                    <span className="text-muted-foreground">· {h.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No change since the categories were set up on 23 Oct.
            </p>
          )}
        </CardContent>
      </Card>

      {editing ? (
        <ApprovalDialog category={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function CategoryCard({
  category: c,
  onEdit,
}: {
  category: Category;
  onEdit: (c: Category) => void;
}) {
  const text = describe(c.category);
  const w = c.waiting;
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{text.title}</span>
              <Badge variant={c.approved ? "success" : "secondary"}>
                {c.approved ? "Approved" : "Blocked"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{text.what}</p>
            {HAS_PLAYBOOK.has(c.category) ? null : (
              <p className="text-xs text-muted-foreground">
                No agent playbook yet: approving records your decision, pages
                start changing once the playbook ships.
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant={c.approved ? "outline" : "default"}
            onClick={() => onEdit(c)}
          >
            {c.approved ? "Block" : "Approve"}
          </Button>
        </div>
        {w ? (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
            <div className="font-medium">
              {formatNumber(w.candidates)} pages waiting
              {w.clicks28d
                ? `, ${formatNumber(w.clicks28d)} clicks in 28 days`
                : ""}
              <span className="font-normal text-muted-foreground">
                {" "}
                · seen{" "}
                {w.firstSeen === w.lastSeen
                  ? w.lastSeen
                  : `${w.firstSeen} to ${w.lastSeen}`}
              </span>
            </div>
            {w.reasons.length ? (
              <div className="mt-1 text-muted-foreground">
                Why: {w.reasons.join("; ")}
              </div>
            ) : null}
            {w.examples.length ? (
              <Collapsible>
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-primary hover:underline"
                    />
                  }
                >
                  Show the biggest {w.examples.length}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 space-y-1 font-mono text-[0.7rem] break-all text-muted-foreground">
                    {w.examples.map((example) => (
                      <li key={example}>
                        {example.replace(/https?:\/\/(www\.)?/, "")}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        ) : !c.approved ? (
          <p className="text-xs text-muted-foreground">
            Nothing waiting this week.
          </p>
        ) : null}
        {c.approvedBy ? (
          <p className="text-xs text-muted-foreground">
            {c.approved ? "Approved" : "Blocked"} by {c.approvedBy}
            {c.approvedAt ? `, ${formatDateTime(c.approvedAt)}` : ""}
            {c.note ? `: ${c.note}` : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ApprovalDialog({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) {
  const formId = useId();
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const approve = !category.approved;
  const text = describe(category.category);
  const mutation = useMutation({
    mutationFn: () =>
      setClimberCategoryApproval({
        data: { category: category.category, approved: approve, note },
      }),
    onSuccess: async () => {
      toast.success(`${text.title} ${approve ? "approved" : "blocked"}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["climberCategories"] }),
        queryClient.invalidateQueries({ queryKey: ["climberDecisions"] }),
      ]);
      onClose();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <FormDialog
      title={`${approve ? "Approve" : "Block"}: ${text.title}`}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      actions={
        <>
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={approve ? "default" : "destructive"}
            pending={mutation.isPending}
            disabled={note.trim().length < 3}
          >
            {approve ? "Approve category" : "Block category"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          {approve
            ? HAS_PLAYBOOK.has(category.category)
              ? `From the next night, agents apply this kind of change on their own${category.waiting ? `, starting with the ${formatNumber(category.waiting.candidates)} pages waiting` : ""}. Each page is snapshotted first and reverted if it breaks or drops.`
              : `This kind has no agent playbook yet, so nothing changes tonight. Once the playbook ships, agents apply it on their own${category.waiting ? `, starting with the ${formatNumber(category.waiting.candidates)} pages waiting` : ""}, each page snapshotted first and reverted if it breaks or drops.`
            : "Agents stop starting new changes of this kind tonight. Changes already live keep being judged and reverted if they lose."}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-note`}>
            Why (kept in the decision log)
          </Label>
          <Textarea
            id={`${formId}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder={
              approve
                ? "e.g. dead pages are bloating the index"
                : "e.g. wait until after Christmas"
            }
          />
        </div>
      </form>
    </FormDialog>
  );
}
