/**
 * Two-mode storage for AI-generated car images.
 *
 * Local dev: PNG files under `public/generated/cars/<id>/<fileBase>.png`,
 * served as static assets by Next.js.
 * Netlify production: stored in a Netlify Blobs store named "cars",
 * served by a streaming GET handler at /api/photo/cars/[id]/[fileBase].
 *
 * In both modes, calling `writeCarImage` returns the public URL that the
 * UI can drop into an `<img src>` directly.
 */
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export const CARS_BLOB_STORE = "cars";
const PUBLIC_DIR = path.join(process.cwd(), "public", "generated", "cars");

function fsPath(vehicleId: string, fileBase: string): string {
  return path.join(PUBLIC_DIR, vehicleId, `${fileBase}.png`);
}

function fsUrl(vehicleId: string, fileBase: string): string {
  return `/generated/cars/${vehicleId}/${fileBase}.png`;
}

function blobUrl(vehicleId: string, fileBase: string): string {
  return `/api/photo/cars/${encodeURIComponent(vehicleId)}/${encodeURIComponent(fileBase)}`;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

type BlobsModule = typeof import("@netlify/blobs");
let blobsCache: BlobsModule | null | undefined;

async function getBlobs(): Promise<BlobsModule | null> {
  if (blobsCache !== undefined) return blobsCache;
  try {
    blobsCache = await import("@netlify/blobs");
  } catch {
    blobsCache = null;
  }
  return blobsCache;
}

async function getStore() {
  const blobs = await getBlobs();
  if (!blobs) return null;
  try {
    return blobs.getStore({ name: CARS_BLOB_STORE, consistency: "strong" });
  } catch {
    // Outside Netlify runtime (e.g. local dev), getStore throws.
    return null;
  }
}

/** Returns the public URL if the image already exists, else null. */
export async function readCarImageUrl(
  vehicleId: string,
  fileBase: string,
): Promise<string | null> {
  // 1. Local filesystem first (fast in dev).
  if (await fileExists(fsPath(vehicleId, fileBase))) {
    return fsUrl(vehicleId, fileBase);
  }
  // 2. Netlify Blobs.
  const store = await getStore();
  if (!store) return null;
  try {
    const meta = await store.getMetadata(`${vehicleId}/${fileBase}`);
    if (meta) return blobUrl(vehicleId, fileBase);
  } catch {
    /* miss or store unavailable */
  }
  return null;
}

/** Writes the buffer using whichever backend is available. */
export async function writeCarImage(
  vehicleId: string,
  fileBase: string,
  buffer: Buffer,
): Promise<string> {
  // 1. Try local filesystem (dev).
  try {
    const filePath = fsPath(vehicleId, fileBase);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return fsUrl(vehicleId, fileBase);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "EROFS" && code !== "EACCES") throw err;
  }
  // 2. Filesystem is read-only → Netlify Blobs.
  const store = await getStore();
  if (!store) {
    throw new Error(
      "Persistent storage unavailable: filesystem is read-only and Netlify Blobs is not reachable.",
    );
  }
  // Blobs `set` accepts ArrayBuffer, not Node Buffer — convert.
  const ab = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  await store.set(`${vehicleId}/${fileBase}`, ab, {
    metadata: { contentType: "image/png" },
  });
  return blobUrl(vehicleId, fileBase);
}

/** Reads raw bytes from blob storage (used by the streaming GET route). */
export async function readCarImageBytes(
  vehicleId: string,
  fileBase: string,
): Promise<ArrayBuffer | null> {
  const store = await getStore();
  if (!store) return null;
  const buf = await store.get(`${vehicleId}/${fileBase}`, {
    type: "arrayBuffer",
  });
  return (buf as ArrayBuffer | null) ?? null;
}
