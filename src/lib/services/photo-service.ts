/**
 * Client wrapper for the server-side OpenAI proxy at /api/photo/generate.
 * The key never lands in the browser bundle.
 *
 * TODO: Supabase: when storage lands, persist generated images to a bucket
 * and store the public URL in `vehicle_photos`.
 */

export type PhotoSize = "1024x1024" | "1024x1536" | "1536x1024";

export interface GenerateInput {
  prompt: string;
  size?: PhotoSize;
}

export const photoService = {
  async generate(input: GenerateInput): Promise<{ dataUrl: string }> {
    const res = await fetch("/api/photo/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as {
      dataUrl?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.error ?? `Image generation failed (${res.status}).`);
    }
    if (!json.dataUrl) {
      throw new Error("No image returned.");
    }
    return { dataUrl: json.dataUrl };
  },
};

export type CarAngle = "hero" | "front" | "rear" | "side" | "interior";

export const CAR_ANGLES: CarAngle[] = ["hero", "front", "rear", "side", "interior"];

const ANGLE_FRAMING: Record<CarAngle, string> = {
  hero: "three-quarter front view, eye-level, exterior, full vehicle visible",
  front: "dead-on front, slightly low angle, headlights as focal point, exterior",
  rear: "three-quarter rear view, taillights and badging visible, exterior",
  side: "strict profile shot, full body in frame, shows wheelbase and silhouette, exterior",
  interior:
    "driver's seat looking over the dashboard, steering wheel and infotainment screen, no occupants, interior cabin",
};

export function carPhotoPrompt(args: {
  year: number;
  make: string;
  model: string;
  colour: string;
  variant?: string | null;
  backdrop?: string;
  angle?: CarAngle;
}): string {
  const variant = args.variant ? ` ${args.variant}` : "";
  const backdrop = args.backdrop ?? "neutral grey studio";
  const angle = args.angle ?? "hero";
  const framing = ANGLE_FRAMING[angle];
  return `Photorealistic ${args.year} ${args.make} ${args.model}${variant} in ${args.colour.toLowerCase()}, ${framing}, sharp clean lines, ${backdrop} background, studio lighting, no logos, dealership marketing photo.`;
}

export function backdropPrompt(label: string, hint?: string): string {
  const hintText = hint ? ` (${hint})` : "";
  return `Empty automotive photography backdrop: ${label}${hintText}. No vehicles, no people, no text. Soft photographic lighting, suitable for dropping a car into the foreground. Wide aspect ratio, clean composition.`;
}
