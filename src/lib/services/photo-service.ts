/**
 * Prompt builders and angle catalogue for the AI vehicle-photo pipeline.
 * The OpenAI call itself lives server-side in /api/photo/vehicle so the key
 * never lands in the browser bundle.
 */

export type CarAngle =
  | "hero"
  | "front"
  | "rear"
  | "side"
  | "interior"
  | "processed"
  | "composed";

export const CAR_ANGLES: CarAngle[] = [
  "hero",
  "front",
  "rear",
  "side",
  "interior",
  "processed",
  "composed",
];

const ANGLE_FRAMING: Record<CarAngle, string> = {
  hero: "three-quarter front view, eye-level, exterior, full vehicle visible",
  front: "dead-on front, slightly low angle, headlights as focal point, exterior",
  rear: "three-quarter rear view, taillights and badging visible, exterior",
  side: "strict profile shot, full body in frame, shows wheelbase and silhouette, exterior",
  interior:
    "driver's seat looking over the dashboard, steering wheel and infotainment screen, no occupants, interior cabin",
  processed:
    "three-quarter front view, vehicle perfectly isolated and centered, only a soft contact shadow on the floor, no environment elements, pure seamless white cyclorama backdrop",
  composed: "three-quarter front view, eye-level, exterior, full vehicle visible",
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
  const angle = args.angle ?? "hero";
  // Processed always overrides the backdrop (pure white).
  const backdrop =
    angle === "processed"
      ? "pure seamless white"
      : (args.backdrop ?? "neutral grey studio");
  const framing = ANGLE_FRAMING[angle];
  return `Photorealistic ${args.year} ${args.make} ${args.model}${variant} in ${args.colour.toLowerCase()}, ${framing}, sharp clean lines, ${backdrop} background, studio lighting, no logos, dealership marketing photo.`;
}
