"use client";

/*
 * Styleguide primitives — the chrome the specimens sit in.
 *
 * Built from the Genaro brand tokens directly rather than from app components:
 * the page has to stay readable even when a component it documents is
 * mid-refactor, so the frame must not depend on the thing being framed.
 *
 * Genaro is a single light system — the brand package defines no dark
 * variants — so this frame does not flip with the app theme. See page.tsx.
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
      className="scroll-mt-28 border-line border-t pt-10 first:border-t-0 first:pt-0 lg:scroll-mt-20"
      id={id}
    >
      <h2
        className="font-semibold text-[22px] text-ink tracking-[-0.022em]"
        id={`${id}-heading`}
      >
        {title}
      </h2>
      {lede ? (
        <p className="mt-2 max-w-[65ch] text-[13px] text-body-text leading-[1.55]">
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
    <span
      className={cn(
        "font-mono font-semibold text-[11px] text-muted-text uppercase tracking-[0.12em]",
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
          <p className="max-w-[65ch] text-[12px] text-muted-text">{note}</p>
        ) : null}
      </div>
      {/* Elevation is almost absent in this system: a card is 1px of border on
          white, never a shadow. The one exception is the calendar date chip. */}
      <div
        className={cn(
          "rounded-[10px] border border-line bg-white p-5 text-ink",
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
    <div className="grid items-center gap-x-6 gap-y-2 border-line-soft border-t py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr]">
      <span className="font-medium text-[12px] text-muted-text">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------- copy */

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
        "group inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-[4px] border border-transparent px-1.5 py-0.5 font-mono text-[11px] outline-none transition-[background-color,box-shadow] hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent-blue",
        className,
      )}
      onClick={copy}
      type="button"
    >
      <span className="truncate">{label ?? value}</span>
      {copied ? (
        <CheckIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-status-clear"
        />
      ) : (
        <CopyIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ tokens */

const NO_TOKENS: Record<string, string> = {};

/**
 * Computed styles are an external store, not React state — so this subscribes
 * to them rather than mirroring them into state in an effect.
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
 * Resolves CSS custom properties to the values the browser actually computed,
 * so the printed hex cannot drift from the token it documents.
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

/** One colour token: chip, name, resolved hex, and what it is for. */
export function TokenSwatch({
  token,
  label,
  use,
  value,
}: {
  token: string;
  label: string;
  use?: string;
  value?: string;
}): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div
        className="h-12 w-full rounded-[6px] border border-line"
        style={{ backgroundColor: `var(--${token})` }}
      />
      <span className="truncate font-medium text-[12px] text-ink">{label}</span>
      <CopyChip
        className="justify-start px-0 text-muted-text hover:bg-transparent"
        // Pre-hydration there is no computed value; the em dash keeps the row
        // height stable instead of reflowing when the real hex arrives.
        label={value ? value.toUpperCase() : "—"}
        value={value || `var(--${token})`}
      />
      {use ? (
        <span className="text-[11px] text-muted-text leading-[1.4]">{use}</span>
      ) : null}
    </div>
  );
}
