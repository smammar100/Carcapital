import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/require-user";

/**
 * Server-only proxy to OpenAI's image-generation API. The key lives in
 * `process.env.OPENAI_API_KEY` and never reaches the browser.
 *
 * POST { prompt: string, size?: "1024x1024" | "1024x1536" | "1536x1024" }
 *  → { dataUrl: "data:image/png;base64,..." }
 */
export const runtime = "nodejs";

const ALLOWED_SIZES = new Set([
  "1024x1024",
  "1024x1536",
  "1536x1024",
]);

export async function POST(request: Request) {
  // AuthZ: must be a signed-in, active user (any role). Blocks anonymous and
  // deactivated callers from spending OpenAI credits.
  try {
    await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured on the server." },
      { status: 503 },
    );
  }

  let body: { prompt?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json(
      { error: "`prompt` is required." },
      { status: 400 },
    );
  }
  if (prompt.length > 1000) {
    return NextResponse.json(
      { error: "`prompt` is too long (max 1000 chars)." },
      { status: 400 },
    );
  }

  const size =
    typeof body.size === "string" && ALLOWED_SIZES.has(body.size)
      ? body.size
      : "1024x1024";

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
        n: 1,
      }),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? `Network error: ${e.message}`
            : "Network error reaching OpenAI.",
      },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      {
        error: `OpenAI ${res.status}: ${text.slice(0, 500)}`,
      },
      { status: res.status },
    );
  }

  const json = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const item = json.data?.[0];
  if (!item) {
    return NextResponse.json(
      { error: "OpenAI returned no image data." },
      { status: 502 },
    );
  }

  if (item.b64_json) {
    return NextResponse.json({
      dataUrl: `data:image/png;base64,${item.b64_json}`,
    });
  }
  if (item.url) {
    return NextResponse.json({ dataUrl: item.url });
  }
  return NextResponse.json(
    { error: "OpenAI response missing both b64_json and url." },
    { status: 502 },
  );
}
