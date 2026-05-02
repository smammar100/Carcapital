import { NextResponse } from "next/server";
import { readCarImageBytes } from "@/lib/services/photo-storage";

export const runtime = "nodejs";

const SAFE = /^[a-zA-Z0-9_-]+$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vehicleId: string; fileBase: string }> },
) {
  const { vehicleId, fileBase } = await params;
  if (!SAFE.test(vehicleId) || !SAFE.test(fileBase)) {
    return new NextResponse("Bad request", { status: 400 });
  }
  let bytes: ArrayBuffer | null;
  try {
    bytes = await readCarImageBytes(vehicleId, fileBase);
  } catch (e) {
    return new NextResponse(
      e instanceof Error ? e.message : "Storage error",
      { status: 500 },
    );
  }
  if (!bytes) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Generated images are immutable — once a vehicleId/fileBase is
      // produced it never changes (regenerate writes a new key in practice
      // because the disk path is the cache).
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
