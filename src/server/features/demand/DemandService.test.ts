import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemandService } from "./DemandService";
import { GscConnectionRepository } from "@/server/features/gsc/repositories/GscConnectionRepository";
import { createGscClient } from "@/server/lib/gscClient";

vi.mock("cloudflare:workers", () => ({
  env: { KV: { get: vi.fn(async () => null), put: vi.fn() } },
}));
vi.mock("@/server/features/gsc/repositories/GscConnectionRepository", () => ({
  GscConnectionRepository: { listByOrganizationId: vi.fn() },
}));
vi.mock("@/server/lib/gscClient", () => ({ createGscClient: vi.fn() }));
vi.mock("@/server/lib/climberSupabase", () => ({
  getClimberSupabaseConfig: vi.fn(async () => null),
  climberRestGet: vi.fn(),
}));

const connection = (siteUrl: string) => ({
  id: siteUrl,
  projectId: siteUrl,
  organizationId: "org",
  siteUrl,
  connectedByUserId: "u1",
  gscAccountId: null,
  connectedAccountEmail: null,
  createdAt: "",
  updatedAt: "",
});

const querySearchAnalytics = vi.fn();
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the service only queries search analytics
const client = { querySearchAnalytics } as unknown as ReturnType<
  typeof createGscClient
>;

beforeEach(() => {
  vi.mocked(createGscClient).mockReturnValue(client);
  querySearchAnalytics.mockResolvedValue([
    { keys: ["esp"], impressions: 100, clicks: 2, ctr: 0, position: 0 },
  ]);
});

describe("DemandService.getDemand", () => {
  it("counts a URL-prefix property once when its domain property is also connected", async () => {
    vi.mocked(GscConnectionRepository.listByOrganizationId).mockResolvedValue([
      connection("sc-domain:floraqueen.com"),
      connection("https://www.floraqueen.com/"),
      connection("sc-domain:floraqueen.es"),
    ]);

    const { searchConsole } = await DemandService.getDemand("org");

    expect(searchConsole.sites).toEqual([
      "sc-domain:floraqueen.com",
      "sc-domain:floraqueen.es",
    ]);
    expect(searchConsole.countries).toEqual([
      expect.objectContaining({ country: "esp", impressions: 200 }),
    ]);
  });
});
