"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { getHomeForUser } from "@/lib/user-home";
import {
  looksLikeEmail,
  syntheticEmail,
  DEFAULT_ORG_SLUG,
} from "@/lib/auth/username";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

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
      const msg =
        err instanceof Error ? err.message : "Could not sign in";
      toast.error(msg);
      form.setError("password", { message: " " });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold tracking-widest">
            CC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Car Capital UK
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </div>

        <Card className="p-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username or email</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        autoComplete="username"
                        placeholder="username"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-baseline justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="mt-2"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>
        </Card>

        {process.env.NODE_ENV !== "production" && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Dev seed users: shared password{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              CarCapUAT!2026
            </code>
            .
          </p>
        )}
      </div>
    </div>
  );
}
