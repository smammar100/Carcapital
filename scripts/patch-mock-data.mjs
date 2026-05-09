// Applies CSV-derived seeds to src/lib/mock-data.ts.
// Reads the generator output (scripts/seeds.generated.txt), splices it into
// mock-data.ts, expands VehicleSeed interface + buildVehicle to consume the
// new optional fields, and bumps Company.nextStockSeq.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("D:/Design Engineering/Carcap/.claude/worktrees/hungry-chebyshev-e30d9d");
const MOCK = path.join(ROOT, "src/lib/mock-data.ts");
const GEN = path.join(ROOT, "scripts/seeds.generated.txt");

let src = fs.readFileSync(MOCK, "utf-8");
const generated = fs.readFileSync(GEN, "utf-8");

// Detect original line ending so we can write back the same style
const origEol = src.includes("\r\n") ? "\r\n" : "\n";
// Normalize to LF for in-script string matching
src = src.replace(/\r\n/g, "\n");
const generatedLf = generated.replace(/\r\n/g, "\n");

// 1) Replace the VEHICLE_SEEDS array (anchored from `const VEHICLE_SEEDS:` to its closing `];`).
{
  const startMarker = "const VEHICLE_SEEDS: VehicleSeed[] = [";
  const start = src.indexOf(startMarker);
  if (start < 0) throw new Error("VEHICLE_SEEDS start marker not found");
  // Find the closing `];` after this start
  const endIdx = src.indexOf("\n];", start);
  if (endIdx < 0) throw new Error("VEHICLE_SEEDS end marker not found");
  const before = src.slice(0, start);
  const after = src.slice(endIdx + 3); // skip past "];"
  // The generated file already includes the `const VEHICLE_SEEDS: VehicleSeed[] = [` line and `];` close.
  src = before + generatedLf.trimEnd() + after;
}

// 2) Expand VehicleSeed interface to include the new optional fields used by the seed array.
{
  const oldIface = `interface VehicleSeed {
  id: string;
  stockId: string;
  registration: string;
  make: string;
  model: string;
  variant: string;
  bodyType: Vehicle["bodyType"];
  fuelType: Vehicle["fuelType"];
  transmission: Vehicle["transmission"];
  status: Vehicle["status"];
  daysInStock: number;
  source: string;
  buyingPrice: number;
  listingPrice: number | null;
  year: number;
  colour: string;
  mileage: number;
}`;
  const newIface = `interface VehicleSeed {
  id: string;
  stockId: string;
  registration: string;
  make: string;
  model: string;
  variant: string;
  bodyType: Vehicle["bodyType"];
  fuelType: Vehicle["fuelType"];
  transmission: Vehicle["transmission"];
  status: Vehicle["status"];
  daysInStock: number;
  source: string;
  buyingPrice: number;
  listingPrice: number | null;
  year: number;
  colour: string;
  mileage: number;
  // Optional CSV-derived fields (work_list.csv)
  imagesCount?: number;
  motExpiry?: string | null;
  autoTrader?: boolean;
  enquiriesCount?: number;
  localOrImport?: "local" | "import";
}`;
  if (!src.includes(oldIface)) throw new Error("VehicleSeed interface not found");
  src = src.replace(oldIface, newIface);
}

// 3) Update buildVehicle to consume new optional fields.
{
  // Replace the imagesCount line
  const oldImages = `imagesCount: ["listed", "ready"].includes(s.status) ? 12 : 0,`;
  const newImages = `imagesCount: s.imagesCount ?? (["listed", "ready"].includes(s.status) ? 12 : 0),`;
  if (!src.includes(oldImages)) throw new Error("imagesCount line not found");
  src = src.replace(oldImages, newImages);

  // Replace the motExpiry line
  const oldMot = `motExpiry: inDays(180),`;
  const newMot = `motExpiry: s.motExpiry !== undefined ? s.motExpiry : inDays(180),`;
  if (!src.includes(oldMot)) throw new Error("motExpiry line not found");
  src = src.replace(oldMot, newMot);

  // Replace the localOrImport line
  const oldLoi = `localOrImport: "local",`;
  const newLoi = `localOrImport: s.localOrImport ?? "local",`;
  if (!src.includes(oldLoi)) throw new Error("localOrImport line not found");
  src = src.replace(oldLoi, newLoi);

  // Replace heroImageUrl line — seed images only exist for vehicle-1..vehicle-15
  const oldHero = "heroImageUrl: `/cars/seed/${s.id}.png`,";
  const newHero = "heroImageUrl: SEED_IMAGE_IDS.has(s.id) ? `/cars/seed/${s.id}.png` : null,";
  if (!src.includes(oldHero)) throw new Error("heroImageUrl line not found");
  src = src.replace(oldHero, newHero);

  // Add SEED_IMAGE_IDS const just above buildVehicle definition
  const buildVehicleAnchor = "function buildVehicle(s: VehicleSeed): Vehicle {";
  const seedImageDecl = `// Vehicle IDs that have a pre-rendered hero image at /cars/seed/<id>.png.
const SEED_IMAGE_IDS = new Set<string>([
  "vehicle-1", "vehicle-2", "vehicle-3", "vehicle-4", "vehicle-5",
  "vehicle-6", "vehicle-7", "vehicle-8", "vehicle-9", "vehicle-10",
  "vehicle-11", "vehicle-12", "vehicle-13", "vehicle-14", "vehicle-15",
]);

`;
  if (!src.includes(buildVehicleAnchor)) throw new Error("buildVehicle anchor not found");
  src = src.replace(buildVehicleAnchor, seedImageDecl + buildVehicleAnchor);
}

// 4) Bump Company.nextStockSeq from 16 to 115 (next after CC-0114).
{
  const oldSeq = `    nextStockSeq: 16,`;
  const newSeq = `    nextStockSeq: 115,`;
  if (!src.includes(oldSeq)) throw new Error("nextStockSeq not found");
  src = src.replace(oldSeq, newSeq);
}

// Restore original line endings before writing
const out = origEol === "\r\n" ? src.replace(/\r?\n/g, "\r\n") : src;
fs.writeFileSync(MOCK, out, "utf-8");
console.log("Patched mock-data.ts successfully.");
console.log("File size:", out.length, "bytes");
console.log("Line count:", out.split(/\r?\n/).length);
console.log("Line endings:", origEol === "\r\n" ? "CRLF" : "LF");
