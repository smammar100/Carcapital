"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";
import { getHomeForUser } from "@/lib/user-home";
import {
  looksLikeEmail,
  syntheticEmail,
  DEFAULT_ORG_SLUG,
} from "@/lib/auth/username";
import { Button } from "@/components/ui/button";
import { NordInputField } from "@/components/nord/form";

const schema = z.object({
  identifier: z.string().min(1, "Enter your username or email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  // useSearchParams must be inside a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, signIn, signOut } = useAuth();
  const explicitNext = search.get("next");
  // Set when hydrate() signs out an inactive profile, so the bounce back here
  // carries an explanation instead of looking like a failed password.
  const signedOutReason = search.get("reason");
  // Dealership for username logins (scopes the internal synthetic email). From
  // ?org=<slug>, else the default single dealership. Email logins ignore this.
  const orgSlug = search.get("org") ?? DEFAULT_ORG_SLUG;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "" },
  });

  const justSubmittedRef = useRef(false);
  const clearedRef = useRef(false);

  // Landing on /login means "I want to authenticate." If a PRE-EXISTING session
  // is present (e.g. switching accounts), sign it out ONCE so the form is usable
  // and the next sign-in starts clean — never auto-redirect a logged-in user
  // away (that bounced account-switchers back as the old user).
  //
  // CRITICAL: skip when the session is one our own onSubmit just created
  // (justSubmittedRef) — otherwise this signs the freshly-logged-in user right
  // back out. Guarded by clearedRef so it fires at most once per visit.
  useEffect(() => {
    if (clearedRef.current || justSubmittedRef.current) return;
    if (user) {
      clearedRef.current = true;
      void signOut();
    }
  }, [user, signOut]);

  // After a successful sign-in, `user` hydrates → route to the role's home
  // (or the explicit ?next= deep-link if one was provided).
  useEffect(() => {
    if (justSubmittedRef.current && user) {
      router.replace(explicitNext ?? getHomeForUser(user));
    }
  }, [user, explicitNext, router]);

  async function onSubmit(values: FormValues) {
    try {
      justSubmittedRef.current = true;
      // No "@" → treat as a username and map to the dealership's internal
      // synthetic email; otherwise sign in with the email directly.
      const email = looksLikeEmail(values.identifier)
        ? values.identifier.trim().toLowerCase()
        : syntheticEmail(orgSlug, values.identifier);
      await signIn(email, values.password);
      toast.success("Signed in");
      // The effect above performs the redirect once `user` hydrates.
    } catch (err) {
      justSubmittedRef.current = false;
      const msg = err instanceof Error ? err.message : "Could not sign in";
      toast.error(msg);
      form.setError("password", { message: " " });
    }
  }

  // form.handleSubmit wraps onSubmit, which reads submission-guard refs — a
  // standard RHF + ref pattern the react-hooks/refs rule over-flags.
  // eslint-disable-next-line react-hooks/refs
  const handleFormSubmit = form.handleSubmit(onSubmit);

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left — sign-in form */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[360px]">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-sm font-bold tracking-widest text-primary-foreground shadow-sm">
            CC
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            Sign in to your account
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Welcome back, let&apos;s get to work.
          </p>

          {/* A deactivated account is signed out mid-session, which without
              this reads as "my password stopped working" (GEN-125). Name the
              cause and the person who can undo it. */}
          {signedOutReason === "deactivated" && (
            <div
              role="status"
              className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
            >
              This account has been deactivated. Ask an administrator to restore
              your access.
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="mt-7 flex flex-col gap-4">
            <NordInputField
              control={form.control}
              name="identifier"
              label="Username or email"
              type="text"
              autoComplete="username"
              placeholder="username"
            />
            <NordInputField
              control={form.control}
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
            />
            <Button
              type="submit"
              expand
              loading={form.formState.isSubmitting}
              className="mt-1"
            >
              Sign in
            </Button>
            <Link
              href="/forgot-password"
              className="self-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </form>

          {process.env.NODE_ENV !== "production" && (
            <p className="mt-8 text-xs text-muted-foreground">
              Dev seed users: shared password{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                CarCapUAT!2026
              </code>
              .
            </p>
          )}
        </div>
      </div>

      {/* Right — branded car panel (Unsplash). Hidden on small screens. */}
      <div className="relative hidden lg:block">
        {/* UK car on a UK street with a UK plate (Unsplash, free license). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1676802584541-dc901dcaa815?auto=format&fit=crop&w=1400&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <div className="text-3xl font-semibold leading-tight">
            Run your forecourt, end to end.
          </div>
          <p className="mt-3 max-w-md text-sm text-white/85">
            Inventory, inspections, sales and warranties: one platform for the
            whole dealership.
          </p>
        </div>
      </div>
    </div>
  );
}
