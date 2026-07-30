"use client";

/*
 * Styleguide primitives — the chrome the specimens sit in.
 *
 * Deliberately built from raw tokens rather than app components: the page has
 * to stay readable even when a component it documents is mid-refactor, so the
 * frame must not depend on the thing being framed.
 */

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- structure */

export function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}): React.ReactElement {
  // scroll-mt clears the sticky header, which is taller below lg because the
  // jump strip rides under the bar there.
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-28 border-border border-t pt-10 first:border-t-0 first:pt-0 lg:scroll-mt-20"
      id={id}
    >
      <h2
        className="font-semibold text-2xl text-foreground"
        id={`${id}-heading`}
      >
        {title}
      </h2>
      {lede ? (
        <p className="mt-2 max-w-[65ch] text-muted-foreground text-sm">
          {lede}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </section>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    // Uppercase at default tracking reads cramped — the type scale sets
    // +0.008em on text-xs, which is tuned for sentence case, not caps.
    <span
      className={cn(
        "font-medium text-muted-foreground text-xs uppercase tracking-[0.08em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A titled demo block. `note` carries the rule the specimen exists to teach —
 * a swatch grid with no reasoning next to it is decoration, not documentation.
 */
export function Specimen({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Eyebrow>{title}</Eyebrow>
        {note ? (
          <p className="max-w-[65ch] text-muted-foreground text-xs">{note}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xs/5",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Label-on-the-left, specimen-on-the-right row used inside a Specimen. */
export function SpecRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="grid items-center gap-x-6 gap-y-2 border-border border-t py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr]">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------- copy */

/**
 * Copy control with a 1.5s checkmark confirmation. Without the swap, people
 * click three more times to check whether it worked.
 */
export function CopyChip({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // Clipboard blocked (insecure origin / permission) — stay silent.
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <button
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      className={cn(
        "group inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 font-mono text-xs outline-none transition-[background-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={copy}
      type="button"
    >
      <span className="truncate">{label ?? value}</span>
      {copied ? (
        <CheckIcon aria-hidden="true" className="size-3 shrink-0 text-success" />
      ) : (
        <CopyIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ tokens */

const NO_TOKENS: Record<string, string> = {};

/**
 * Computed styles are an external store, not React state — so this subscribes
 * to them rather than mirroring them into state in an effect. The `<html>`
 * class is what changes on a theme flip, so that is what we watch.
 */
function createTokenStore(key: string) {
  const listeners = new Set<() => void>();
  let snapshot = NO_TOKENS;

  const refresh = (): void => {
    const styles = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const name of key.split(",")) {
      next[name] = styles.getPropertyValue(`--${name}`).trim();
    }
    // Only swap the reference when a value actually moved — useSyncExternalStore
    // re-renders on every new object identity.
    const changed =
      Object.keys(next).length !== Object.keys(snapshot).length ||
      Object.keys(next).some((k) => next[k] !== snapshot[k]);
    if (!changed) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    getServerSnapshot: (): Record<string, string> => NO_TOKENS,
    getSnapshot: (): Record<string, string> => snapshot,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      refresh();
      const observer = new MutationObserver(refresh);
      observer.observe(document.documentElement, {
        attributeFilter: ["class", "style"],
        attributes: true,
      });
      return () => {
        listeners.delete(listener);
        observer.disconnect();
      };
    },
  };
}

/**
 * Resolves CSS custom properties to the values the browser actually computed.
 * Every token here routes through Nord's `--n-color-*` vars, so the same token
 * name is a different colour in each theme — a hardcoded table would be wrong
 * in one of them.
 */
export function useResolvedTokens(
  names: readonly string[],
): Record<string, string> {
  const key = names.join(",");
  const store = React.useMemo(() => createTokenStore(key), [key]);
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

/**
 * True only after hydration. Written as an external-store read rather than a
 * setState-in-effect so it doesn't trigger a cascading render.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function Swatch({
  name,
  value,
  /** Render the swatch over the app background rather than the card. */
  onBackground = false,
}: {
  name: string;
  value?: string;
  onBackground?: boolean;
}): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div
        className={cn(
          "h-12 w-full rounded-md border border-border",
          onBackground && "bg-background",
        )}
        style={onBackground ? undefined : { backgroundColor: `var(--${name})` }}
      >
        {onBackground ? (
          <div
            className="size-full rounded-[calc(var(--radius-md)-1px)]"
            style={{ backgroundColor: `var(--${name})` }}
          />
        ) : null}
      </div>
      <CopyChip
        className="justify-start px-0 hover:bg-transparent"
        label={name}
        value={`var(--${name})`}
      />
      <span className="truncate font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
        {value || "—"}
      </span>
    </div>
  );
}

export function SwatchGrid({
  names,
  values,
}: {
  names: readonly string[];
  values: Record<string, string>;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
      {names.map((name) => (
        <Swatch key={name} name={name} value={values[name]} />
      ))}
    </div>
  );
}
