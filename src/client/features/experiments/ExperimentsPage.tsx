import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/client/components/PageHeader";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/client/components/ui/empty";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/client/components/ui/tabs";
import { getClimberProgram } from "@/serverFunctions/experiments";
import {
  EXPERIMENT_TABS,
  type ExperimentTab,
  type ExperimentsSearch,
} from "@/types/schemas/experiments";
import { CategoriesTab } from "./CategoriesTab";
import { DecisionLogTab } from "./DecisionLogTab";
import { ExperimentListTab } from "./ExperimentListTab";
import { LearningsTab } from "./LearningsTab";
import { ProgramTab } from "./ProgramTab";
import { Scorecard } from "./Scorecard";

const TAB_LABEL: Record<ExperimentTab, string> = {
  program: "Program",
  experiments: "Experiments",
  decisions: "Decision log",
  categories: "Change categories",
  learnings: "Learnings",
};

export function ExperimentsPage({
  search,
  onSearch,
}: {
  search: ExperimentsSearch;
  onSearch: (next: ExperimentsSearch) => void;
}) {
  const tab = search.tab ?? (search.exp ? "experiments" : "program");
  // The program query doubles as the "is Climber connected" check.
  const program = useQuery({
    queryKey: ["climberProgram"],
    queryFn: () => getClimberProgram(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Experiments"
          description="Every change Climber's agents make, judged against similar untouched pages. One experiment is one page across all five domains."
        />
        {program.isLoading ? (
          <Skeleton className="h-10 w-96" />
        ) : program.data && !program.data.configured ? (
          <Empty variant="dashed">
            <EmptyHeader>
              <EmptyTitle>Experiments are not connected</EmptyTitle>
              <EmptyDescription>
                Set CLIMBER_SUPABASE_URL and CLIMBER_SUPABASE_KEY on the worker
                to read Climber&apos;s experiments.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(value: ExperimentTab) =>
              onSearch({
                tab: value === "program" ? undefined : value,
                exp: undefined,
              })
            }
          >
            <TabsList variant="line" className="max-w-full overflow-x-auto">
              {EXPERIMENT_TABS.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {TAB_LABEL[t]}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="program" className="mt-4">
              <ProgramTab onSearch={onSearch} />
            </TabsContent>
            <TabsContent value="experiments" className="mt-4">
              {search.exp ? (
                <Scorecard
                  experimentId={search.exp}
                  onBack={() => onSearch({ exp: undefined })}
                />
              ) : (
                <ExperimentListTab search={search} onSearch={onSearch} />
              )}
            </TabsContent>
            <TabsContent value="decisions" className="mt-4">
              <DecisionLogTab onSearch={onSearch} />
            </TabsContent>
            <TabsContent value="categories" className="mt-4">
              <CategoriesTab />
            </TabsContent>
            <TabsContent value="learnings" className="mt-4">
              <LearningsTab onSearch={onSearch} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
