"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Spec v3.0 · Module E.3 — fires `true` once the host element is pinned
 * by `position: sticky` (i.e. its sentinel above it has left the
 * viewport). Lets the host swap on a subtle shadow to signal "content
 * is scrolling under me".
 *
 * Pure IntersectionObserver — no scroll listeners, no relayout.
 */
export function useStickyShadow<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  isStuck: boolean;
} {
  const ref = useRef<T | null>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    // Insert a 1px sentinel directly above the sticky element. When the
    // sentinel scrolls out of view, the sticky element is "stuck".
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:relative;top:-1px;height:1px;width:100%;pointer-events:none;";
    parent.insertBefore(sentinel, el);

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  return { ref, isStuck };
}
