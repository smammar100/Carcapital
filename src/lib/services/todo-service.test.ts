/**
 * GEN-64 — the Things to Do list was render-only: rows couldn't be edited, and
 * nothing rolled the car's status up when its prep work finished. These pin the
 * service-side half of that fix.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  stepArgs,
  type SupabaseMock,
} from "@/test/supabase-mock";
import { makeVehicle } from "@/test/factories";
import type { TodoItem, TodoStatus, VehicleStatus } from "@/lib/types";

const db = { current: null as unknown as SupabaseMock };
const vehicle = { status: "being_prepared" as VehicleStatus };
const changeStatus = vi.fn(async () => makeVehicle());

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
vi.mock("./vehicle-service", () => ({
  vehicleService: {
    getById: vi.fn(async () => makeVehicle({ status: vehicle.status })),
    changeStatus: (...args: unknown[]) =>
      (changeStatus as unknown as (...a: unknown[]) => unknown)(...args),
  },
}));

import { todoService } from "./todo-service";

const todo = (over: Partial<TodoItem> = {}): TodoItem =>
  ({
    id: "todo-1",
    vehicleId: "veh-0001",
    serialNumber: 1,
    description: "Replace nearside tyre",
    vendorId: null,
    status: "pending" as TodoStatus,
    cost: null,
    source: "inspection",
    createdBy: "user-9",
    completedBy: null,
    completedAt: null,
    createdAt: "2026-07-02T09:00:00.000Z",
    ...over,
  }) as TodoItem;

/** `rows` answers list reads; single-row reads get the first row. */
function seed(rows: TodoItem[], status: VehicleStatus = "being_prepared") {
  vehicle.status = status;
  changeStatus.mockClear();
  db.current = createSupabaseMock((call) => {
    if (call.table !== "todo_items") return undefined;
    const single = call.steps.some(
      (s) => s.method === "single" || s.method === "maybeSingle",
    );
    return { data: single ? (rows[0] ?? null) : rows, error: null };
  });
}

describe("add", () => {
  it("files the item straight into the requested status", async () => {
    seed([todo({ status: "in_progress" })]);
    await todoService.add({
      vehicleId: "veh-0001",
      description: "Valet",
      vendorId: null,
      cost: null,
      source: "manual",
      createdBy: "user-9",
      status: "in_progress",
    });
    const insert = db.current.calls.find((c) => stepArgs(c, "insert"));
    expect(stepArgs(insert!, "insert")?.[0]).toMatchObject({
      status: "in_progress",
    });
  });

  it("defaults to pending when no status is given", async () => {
    seed([todo()]);
    await todoService.add({
      vehicleId: "veh-0001",
      description: "Valet",
      vendorId: null,
      cost: null,
      source: "manual",
      createdBy: "user-9",
    });
    const insert = db.current.calls.find((c) => stepArgs(c, "insert"));
    expect(stepArgs(insert!, "insert")?.[0]).toMatchObject({
      status: "pending",
    });
  });
});

describe("getProgress", () => {
  it("counts pending + in-progress as outstanding; cancelled is closed", async () => {
    seed([
      todo({ id: "a", status: "pending" }),
      todo({ id: "b", status: "in_progress" }),
      todo({ id: "c", status: "completed" }),
      todo({ id: "d", status: "cancelled" }),
    ]);
    expect(await todoService.getProgress("veh-0001")).toEqual({
      open: 2,
      done: 1,
      total: 4,
      complete: false,
    });
  });

  it("a car with nothing outstanding is complete", async () => {
    seed([todo({ status: "completed" }), todo({ id: "b", status: "cancelled" })]);
    expect((await todoService.getProgress("veh-0001")).complete).toBe(true);
  });
});

describe("recomputeReadiness", () => {
  it("advances a car in prep to ready once the last item closes", async () => {
    seed([todo({ status: "completed" })], "being_prepared");
    await todoService.recomputeReadiness("veh-0001", "user-9");
    expect(changeStatus).toHaveBeenCalledWith("veh-0001", "ready", "user-9");
  });

  it("leaves the car alone while work is outstanding", async () => {
    seed([todo({ status: "pending" })], "being_prepared");
    await todoService.recomputeReadiness("veh-0001", "user-9");
    expect(changeStatus).not.toHaveBeenCalled();
  });

  it("never drags a car that has already moved past prep backwards", async () => {
    // Advance-only: a listed or sold car must not be re-stamped as "ready"
    // just because someone ticked off a job on it.
    for (const status of ["listed", "reserved", "sold"] as VehicleStatus[]) {
      seed([todo({ status: "completed" })], status);
      await todoService.recomputeReadiness("veh-0001", "user-9");
      expect(changeStatus).not.toHaveBeenCalled();
    }
  });
});

describe("update", () => {
  it("stamps completed_by/at only on the transition into completed", async () => {
    seed([todo({ status: "pending" })]);
    await todoService.update("todo-1", { status: "completed" }, "user-9");
    const update = db.current.calls.find((c) => stepArgs(c, "update"));
    const patch = stepArgs(update!, "update")?.[0] as Record<string, unknown>;
    expect(patch.status).toBe("completed");
    expect(patch.completed_by).toBe("user-9");
    expect(patch.completed_at).toBeTruthy();
  });

  it("a cost-only edit doesn't touch the completion stamps", async () => {
    seed([todo({ status: "pending" })]);
    await todoService.update("todo-1", { cost: 120 }, "user-9");
    const update = db.current.calls.find((c) => stepArgs(c, "update"));
    expect(stepArgs(update!, "update")?.[0]).toEqual({ cost: 120 });
  });
});
