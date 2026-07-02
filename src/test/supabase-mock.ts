/**
 * Minimal chainable supabase-js query stub for characterization tests.
 *
 * Every query method (`select`, `eq`, `order`, …) records itself and returns
 * the same chain. The chain is *thenable*, so `await q`, `await q.single()`
 * and `await q.maybeSingle()` all resolve to whatever the `respond` callback
 * returns for the recorded call. RPCs are surfaced as table `rpc:<name>`.
 *
 * Build only what tests need — this is not a PostgREST emulator.
 */

export interface QueryStep {
  method: string;
  args: unknown[];
}

export interface QueryCall {
  table: string;
  steps: QueryStep[];
}

export interface SupabaseResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export type Responder = (call: QueryCall) => SupabaseResult | undefined;

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "upsert",
  "eq",
  "neq",
  "in",
  "or",
  "gte",
  "lte",
  "gt",
  "lt",
  "is",
  "order",
  "limit",
  "range",
  "single",
  "maybeSingle",
] as const;

function makeChain(table: string, respond: Responder, calls: QueryCall[]) {
  const call: QueryCall = { table, steps: [] };
  calls.push(call);

  const resolve = (): SupabaseResult =>
    respond(call) ?? { data: null, error: null, count: null };

  const chain: Record<string, unknown> = {};
  for (const m of CHAIN_METHODS) {
    chain[m] = (...args: unknown[]) => {
      call.steps.push({ method: m, args });
      return chain;
    };
  }
  // Thenable — awaiting the chain (with or without single()) resolves it.
  chain.then = (
    onFulfilled?: (v: SupabaseResult) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(resolve()).then(onFulfilled, onRejected);
  return chain;
}

export interface SupabaseMock {
  client: {
    from: (table: string) => unknown;
    rpc: (name: string, args?: unknown) => Promise<SupabaseResult>;
  };
  /** Every query issued, in order, for assertions. */
  calls: QueryCall[];
}

export function createSupabaseMock(respond: Responder = () => undefined): SupabaseMock {
  const calls: QueryCall[] = [];
  return {
    client: {
      from: (table: string) => makeChain(table, respond, calls),
      rpc: async (name: string, args?: unknown) => {
        const call: QueryCall = {
          table: `rpc:${name}`,
          steps: [{ method: "rpc", args: [args] }],
        };
        calls.push(call);
        return respond(call) ?? { data: null, error: null };
      },
    },
    calls,
  };
}

/** Find the first recorded step with the given method on a call. */
export function stepArgs(call: QueryCall, method: string): unknown[] | undefined {
  return call.steps.find((s) => s.method === method)?.args;
}
