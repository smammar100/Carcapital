/**
 * Minimal structured logger — one JSON line per event so Vercel Log Drains
 * (and any future aggregator) can filter by module/level/error code instead
 * of grepping free text. Replaces bare console.warn at the integration
 * boundaries (AutoTrader, Resend, OpenAI, DVLA) and in API routes.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.warn("autotrader", "publish failed", { listingId, code: e.code });
 *
 * Context values must be JSON-serialisable; Errors are flattened to
 * { message, name } automatically.
 */

type Level = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

function serialise(context: LogContext | undefined): LogContext | undefined {
  if (!context) return undefined;
  const out: LogContext = {};
  for (const [k, v] of Object.entries(context)) {
    out[k] =
      v instanceof Error ? { message: v.message, name: v.name } : v;
  }
  return out;
}

function emit(level: Level, module: string, message: string, context?: LogContext) {
  const line = JSON.stringify({
    level,
    module,
    message,
    ...serialise(context),
    ts: new Date().toISOString(),
  });
  // Route through the matching console method so Vercel assigns the right
  // severity in its log UI.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (module: string, message: string, context?: LogContext) =>
    emit("debug", module, message, context),
  info: (module: string, message: string, context?: LogContext) =>
    emit("info", module, message, context),
  warn: (module: string, message: string, context?: LogContext) =>
    emit("warn", module, message, context),
  error: (module: string, message: string, context?: LogContext) =>
    emit("error", module, message, context),
};
