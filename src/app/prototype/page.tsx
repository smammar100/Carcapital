"use client";

import { cn } from "@/lib/utils";

/**
 * /prototype — design comparison surface (auth-free).
 *
 * Holds 5 side-by-side variations of the CURRENT feature being designed. The
 * user picks a winner, then it gets built for real. Replace the variations each
 * time we move to a new screen (see the `prototype` skill).
 *
 * Current feature: LOGIN. References (Mobbin): Air, Kraken, Cloudflare (centered
 * cards); YNAB, WRITER, Lindy, Deputy, Lovable (split-screen brand panels);
 * Lovable/Air (SSO-led).
 */
export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Prototype — Login · 5 variations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a winner (A–E). Each is built from real Nord components +
          Mobbin-referenced layouts. Toggle your OS dark mode to preview both
          themes.
        </p>
      </header>

      <div className="flex flex-wrap gap-6">
        <Frame label="A — Centered card" sub="Air / Kraken">
          <VariationA />
        </Frame>
        <Frame label="B — Split-screen brand panel" sub="YNAB / WRITER" wide>
          <VariationB />
        </Frame>
        <Frame label="C — Minimal, no card" sub="Lindy / WRITER">
          <VariationC />
        </Frame>
        <Frame label="D — Accent-header card" sub="branded header band">
          <VariationD />
        </Frame>
        <Frame label="E — SSO-led card" sub="Lovable / Air">
          <VariationE />
        </Frame>
      </div>
    </div>
  );
}

function Frame({
  label,
  sub,
  wide,
  children,
}: {
  label: string;
  sub: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        wide ? "w-full xl:w-[760px]" : "w-full sm:w-[400px]",
      )}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      <div className="h-[540px] overflow-auto">{children}</div>
    </section>
  );
}

function Logo({
  size = "md",
  onAccent,
}: {
  size?: "md" | "lg";
  onAccent?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-bold tracking-widest",
        size === "lg" ? "h-14 w-14 text-base" : "h-11 w-11 text-sm",
        onAccent
          ? "bg-primary-foreground text-primary"
          : "bg-primary text-primary-foreground shadow-sm",
      )}
    >
      CC
    </div>
  );
}

function ForgotLink({ className }: { className?: string }) {
  return (
    <a
      href="#"
      className={cn(
        "text-xs text-muted-foreground underline-offset-4 hover:underline",
        className,
      )}
    >
      Forgot password?
    </a>
  );
}

/* A — Centered card (Air / Kraken) */
function VariationA() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-[320px]">
        <nord-card padding="l">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in to your Car Capital account
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <nord-input expand label="Username or email" placeholder="username" />
            <nord-input expand type="password" label="Password" />
            <ForgotLink className="-mt-1 self-end" />
            <nord-button variant="primary" expand>
              Sign in
            </nord-button>
          </div>
        </nord-card>
      </div>
    </div>
  );
}

/* B — Split-screen brand panel (YNAB / WRITER) */
function VariationB() {
  return (
    <div className="grid h-full grid-cols-1 sm:grid-cols-2">
      <div className="flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-[300px]">
          <Logo />
          <h2 className="mt-5 text-lg font-semibold tracking-tight">
            Sign in to your account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back — let&apos;s get to work.
          </p>
          <div className="mt-6 flex flex-col gap-4">
            <nord-input expand label="Email" placeholder="you@dealer.uk" />
            <nord-input expand type="password" label="Password" />
            <nord-button variant="primary" expand>
              Sign in
            </nord-button>
            <ForgotLink className="self-center" />
          </div>
        </div>
      </div>
      <div
        className="relative hidden flex-col justify-end p-8 text-primary-foreground sm:flex"
        style={{
          background:
            "linear-gradient(135deg, var(--n-color-accent), color-mix(in srgb, var(--n-color-accent) 55%, #000))",
        }}
      >
        <div className="max-w-[280px]">
          <div className="text-2xl font-semibold leading-tight">
            Run your forecourt, end to end.
          </div>
          <p className="mt-3 text-sm opacity-80">
            Inventory, inspections, sales and warranties — one platform for the
            whole dealership.
          </p>
        </div>
      </div>
    </div>
  );
}

/* C — Minimal, no card (Lindy / WRITER) */
function VariationC() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-[300px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Welcome back to Car Capital
            </p>
          </div>
        </div>
        <div className="mt-7 flex flex-col gap-4">
          <nord-input expand label="Username or email" />
          <nord-input expand type="password" label="Password" />
          <nord-button variant="primary" expand>
            Continue
          </nord-button>
          <ForgotLink className="self-center" />
        </div>
      </div>
    </div>
  );
}

/* D — Accent-header card */
function VariationD() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-[320px] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col items-center gap-2 bg-primary px-6 py-7 text-center text-primary-foreground">
          <Logo onAccent />
          <div className="text-base font-semibold">Car Capital UK</div>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <p className="text-center text-sm text-muted-foreground">
            Sign in to continue
          </p>
          <nord-input expand label="Username or email" />
          <nord-input expand type="password" label="Password" />
          <nord-button variant="primary" expand>
            Sign in
          </nord-button>
          <ForgotLink className="self-center" />
        </div>
      </div>
    </div>
  );
}

/* E — SSO-led card (Lovable / Air) */
function VariationE() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-[320px]">
        <nord-card padding="l">
          <div className="flex flex-col items-center gap-2 text-center">
            <Logo />
            <h2 className="text-lg font-semibold tracking-tight">Log in</h2>
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <nord-button expand>
              <nord-icon slot="start" name="generic-mail" />
              Continue with email
            </nord-button>
            <nord-button expand>
              <nord-icon slot="start" name="generic-google" />
              Continue with Google
            </nord-button>
          </div>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-4">
            <nord-input expand label="Email" placeholder="you@dealer.uk" />
            <nord-input expand type="password" label="Password" />
            <nord-button variant="primary" expand>
              Sign in
            </nord-button>
          </div>
        </nord-card>
      </div>
    </div>
  );
}
