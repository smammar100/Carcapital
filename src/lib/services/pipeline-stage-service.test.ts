/**
 * GEN-65 — pipeline stages are data, not a constant. These pin the rules that
 * stop a pipeline from being configured into a dead end: deals are moved
 * before a stage goes, and the stages the sale lifecycle depends on are hidden
 * rather than deleted.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  stepArgs,
  type SupabaseMock,
} from "@/test/supabase-mock";
import type { PipelineStage } from "@/lib/types";

const db = { current: null as unknown as SupabaseMock };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => db.current.client,
}));
vi.mock("@/lib/cache", () => ({
  withCache: (_k: string, fn: () => unknown) => fn(),
  invalidate: vi.fn(),
}));
vi.mock("./activity-service", () => ({
  activityService: { log: vi.fn(async () => undefined) },
}));

import { pipelineStageService } from "./pipeline-stage-service";

const stage = (over: Partial<PipelineStage> = {}): PipelineStage =>
  ({
    id: "stage-1",
    companyId: "co-0001",
    slug: "test_drive",
    label: "Qualified / Viewing",
    sortOrder: 3,
    enabled: true,
    behaviour: "open",
    isSystem: true,
    createdAt: "2026-07-02T09:00:00.000Z",
    updatedAt: "2026-07-02T09:00:00.000Z",
    ...over,
  }) as PipelineStage;

const STAGES = [
  stage({ id: "s1", slug: "new_lead", label: "New Lead", sortOrder: 1 }),
  stage({ id: "s2", slug: "contacted", label: "Contacted", sortOrder: 2 }),
  stage({ id: "s3", slug: "test_drive" }),
];

/** `stages` answers list reads; single-row reads resolve to `single`. */
function seed(stages: PipelineStage[], single?: PipelineStage | null) {
  db.current = createSupabaseMock((call) => {
    if (call.table === "pipeline_stages") {
      const isSingle = call.steps.some(
        (s) => s.method === "single" || s.method === "maybeSingle",
      );
      return { data: isSingle ? (single ?? stages[0]) : stages, error: null };
    }
    if (call.table === "sales_deals") {
      // Two deals sitting in the stage being removed.
      return { data: [{ id: "d1" }, { id: "d2" }], error: null, count: 2 };
    }
    return undefined;
  });
}

describe("create", () => {
  it("slugifies the label and appends the stage to the end", async () => {
    seed(STAGES);
    await pipelineStageService.create(
      { companyId: "co-0001", label: "Awaiting Finance" },
      "user-9",
    );
    const insert = db.current.calls.find((c) => stepArgs(c, "insert"));
    expect(stepArgs(insert!, "insert")?.[0]).toMatchObject({
      slug: "awaiting_finance",
      label: "Awaiting Finance",
      sort_order: 4,
      behaviour: "open",
      is_system: false,
    });
  });

  it("refuses a duplicate name rather than creating a second column", async () => {
    seed(STAGES);
    await expect(
      pipelineStageService.create(
        { companyId: "co-0001", label: "contacted" },
        "user-9",
      ),
    ).rejects.toThrow(/already exists/i);
  });

  it("a custom stage can declare that it reserves the car", async () => {
    seed(STAGES);
    await pipelineStageService.create(
      { companyId: "co-0001", label: "Awaiting Finance", behaviour: "reserved" },
      "user-9",
    );
    const insert = db.current.calls.find((c) => stepArgs(c, "insert"));
    expect(stepArgs(insert!, "insert")?.[0]).toMatchObject({
      behaviour: "reserved",
    });
  });
});

describe("remove", () => {
  it("moves the stage's deals before removing it", async () => {
    seed(STAGES, stage({ id: "s3", slug: "test_drive", isSystem: false }));
    const { movedDeals } = await pipelineStageService.remove(
      "s3",
      "contacted",
      "user-9",
    );
    expect(movedDeals).toBe(2);

    const dealUpdate = db.current.calls.find(
      (c) => c.table === "sales_deals" && stepArgs(c, "update"),
    );
    expect(stepArgs(dealUpdate!, "update")?.[0]).toEqual({
      stage: "contacted",
    });

    // The move has to land before the delete, or the deals are orphaned.
    const moveIndex = db.current.calls.indexOf(dealUpdate!);
    const deleteIndex = db.current.calls.findIndex((c) =>
      c.steps.some((s) => s.method === "delete"),
    );
    expect(deleteIndex).toBeGreaterThan(moveIndex);
  });

  it("hides a system stage instead of deleting it", async () => {
    seed(STAGES, stage({ id: "s3", slug: "test_drive", isSystem: true }));
    await pipelineStageService.remove("s3", "contacted", "user-9");
    expect(
      db.current.calls.some((c) => c.steps.some((s) => s.method === "delete")),
    ).toBe(false);
    const disable = db.current.calls.find(
      (c) => c.table === "pipeline_stages" && stepArgs(c, "update"),
    );
    expect(stepArgs(disable!, "update")?.[0]).toMatchObject({ enabled: false });
  });

  it("won't move a stage's deals into itself", async () => {
    seed(STAGES, stage({ id: "s3", slug: "test_drive" }));
    await expect(
      pipelineStageService.remove("s3", "test_drive", "user-9"),
    ).rejects.toThrow(/different stage/i);
  });

  it("won't remove into a stage that no longer exists", async () => {
    seed(STAGES, stage({ id: "s3", slug: "test_drive" }));
    await expect(
      pipelineStageService.remove("s3", "ghost_stage", "user-9"),
    ).rejects.toThrow(/no longer exists/i);
  });
});

describe("update", () => {
  it("renaming touches the label only — the slug deals store never moves", async () => {
    seed(STAGES);
    await pipelineStageService.update("s3", { label: "Viewing" }, "user-9");
    const update = db.current.calls.find((c) => stepArgs(c, "update"));
    const patch = stepArgs(update!, "update")?.[0] as Record<string, unknown>;
    expect(patch.label).toBe("Viewing");
    expect(patch.slug).toBeUndefined();
  });

  it("rejects an empty name", async () => {
    seed(STAGES);
    await expect(
      pipelineStageService.update("s3", { label: "   " }, "user-9"),
    ).rejects.toThrow(/can't be empty/i);
  });
});
