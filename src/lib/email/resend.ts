import "server-only";
import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend {
  if (!cached) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set in environment variables");
    cached = new Resend(key);
  }
  return cached;
}

// Defaults to Resend's built-in onboarding@resend.dev — works with no domain
// and no DNS setup (only delivers to your Resend signup email). Override with
// EMAIL_FROM once you've verified your own sending domain for production.
export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Car Capital UK <onboarding@resend.dev>";
