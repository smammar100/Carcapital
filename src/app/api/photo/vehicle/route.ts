import { NextResponse } from "next/server";
import { vehicleService } from "@/lib/services/vehicle-service";
import { CAR_ANGLES, carPhotoPrompt, type CarAngle } from "@/lib/services/photo-service";
import {
  readCarImageUrl,
  writeCarImage,
} from "@/lib/services/photo-storage";

export const runtime = "nodejs";

const SAFE_KEY = /^[a-z0-9-_]{1,32}$/i;

function fileBase(angle: CarAngle, backdropKey?: string): string {
  if (angle === "composed" && backdropKey) {
    return `composed-${backdropKey}`;
  }
  return angle;
}

// ---- In-flight dedupe ----------------------------------------------------
const inFlight = new Map<string, Promise<string>>();

// ---- Rate limit: 30 generations / 60s rolling window ---------------------
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const recentTimestamps: number[] = [];

function rateLimitOk(): boolean {
  const now = Date.now();
  while (recentTimestamps.length && now - recentTimestamps[0] > WINDOW_MS) {
    recentTimestamps.shift();
  }
  if (recentTimestamps.length >= MAX_PER_WINDOW) return false;
  recentTimestamps.push(now);
  return true;
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      n: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image data.");
  return b64;
}

async function generateAndPersist(
  companyId: string,
  vehicleId: string,
  angle: CarAngle,
  prompt: string,
  apiKey: string,
  backdropKey?: string,
): Promise<string> {
  const b64 = await callOpenAI(prompt, apiKey);
  const buf = Buffer.from(b64, "base64");
  const base = fileBase(angle, backdropKey);
  const url = await writeCarImage(companyId, vehicleId, base, buf);
  if (angle === "hero") {
    await vehicleService.setHeroImageUrl(vehicleId, url);
  }
  // eslint-disable-next-line no-console
  console.log(`[photo] generated ${companyId}/${vehicleId}/${base} → ${url}`);
  return url;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured on the server." },
      { status: 503 },
    );
  }

  let body: {
    vehicleId?: unknown;
    angle?: unknown;
    backdropKey?: unknown;
    backdropHint?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const vehicleId =
    typeof body.vehicleId === "string" ? body.vehicleId.trim() : "";
  if (!vehicleId) {
    return NextResponse.json(
      { error: "`vehicleId` is required." },
      { status: 400 },
    );
  }
  if (
    vehicleId.includes("/") ||
    vehicleId.includes("\\") ||
    vehicleId.includes("..")
  ) {
    return NextResponse.json(
      { error: "Invalid vehicleId." },
      { status: 400 },
    );
  }
  const angleRaw = typeof body.angle === "string" ? body.angle : "hero";
  if (!CAR_ANGLES.includes(angleRaw as CarAngle)) {
    return NextResponse.json(
      { error: `\`angle\` must be one of ${CAR_ANGLES.join(", ")}.` },
      { status: 400 },
    );
  }
  const angle = angleRaw as CarAngle;

  let backdropKey: string | undefined;
  let backdropHint: string | undefined;
  if (angle === "composed") {
    if (
      typeof body.backdropKey !== "string" ||
      !SAFE_KEY.test(body.backdropKey)
    ) {
      return NextResponse.json(
        { error: "`backdropKey` is required for composed (a-z, 0-9, -, _; max 32)." },
        { status: 400 },
      );
    }
    backdropKey = body.backdropKey;
    backdropHint =
      typeof body.backdropHint === "string"
        ? body.backdropHint.slice(0, 200)
        : undefined;
  }

  // Look up vehicle (we need company_id for the storage path).
  const vehicle = await vehicleService.getById(vehicleId);
  if (!vehicle) {
    return NextResponse.json(
      { error: `Vehicle ${vehicleId} not found.` },
      { status: 404 },
    );
  }
  const companyId = vehicle.companyId;

  const base = fileBase(angle, backdropKey);

  // 1. Already in storage? Return immediately.
  const existingUrl = await readCarImageUrl(companyId, vehicleId, base);
  if (existingUrl) {
    if (angle === "hero") {
      await vehicleService.setHeroImageUrl(vehicleId, existingUrl);
    }
    return NextResponse.json({ url: existingUrl, cached: true });
  }

  // 2. In-flight dedupe.
  const key = `${vehicleId}:${angle}${backdropKey ? `:${backdropKey}` : ""}`;
  const existing = inFlight.get(key);
  if (existing) {
    try {
      const url = await existing;
      return NextResponse.json({ url, cached: false, deduped: true });
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error ? e.message : "In-flight generation failed.",
        },
        { status: 502 },
      );
    }
  }

  // 3. Rate limit.
  if (!rateLimitOk()) {
    return NextResponse.json(
      {
        error: `Rate limit hit (${MAX_PER_WINDOW} generations / ${WINDOW_MS / 1000}s). Try again in a minute.`,
      },
      { status: 429 },
    );
  }

  const prompt = carPhotoPrompt({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    colour: vehicle.colour,
    variant: vehicle.variantCode,
    angle,
    backdrop: angle === "composed" ? backdropHint : undefined,
  });

  // 4. Kick off generation, register the in-flight promise.
  const promise = generateAndPersist(
    companyId,
    vehicleId,
    angle,
    prompt,
    apiKey,
    backdropKey,
  );
  inFlight.set(key, promise);
  try {
    const url = await promise;
    return NextResponse.json({ url, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed." },
      { status: 502 },
    );
  } finally {
    inFlight.delete(key);
  }
}
