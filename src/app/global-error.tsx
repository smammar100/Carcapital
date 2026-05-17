"use client";

import { useEffect } from "react";

/**
 * SPEC Point 9 — last-resort boundary for errors thrown in the root layout
 * itself (which `(dashboard)/error.tsx` cannot catch). Replaces the root
 * layout when active, so it must render its own <html>/<body> and cannot
 * rely on app fonts/providers/Tailwind — inline styles only.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fafafa",
          color: "#111",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px" }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={btn(false)}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={btn(true)}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    border: primary ? "none" : "1px solid #d4d4d4",
    background: primary ? "#111" : "#fff",
    color: primary ? "#fff" : "#111",
  };
}
