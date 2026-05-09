// One-shot generator: reads work_list.csv and emits a TypeScript VEHICLE_SEEDS literal.
// Usage: node scripts/csv-to-seeds.mjs
import fs from "node:fs";

const CSV_PATH = "C:/Users/MSI/Downloads/work_list.csv";
const raw = fs.readFileSync(CSV_PATH, "utf-8");

// ---- Tiny CSV parser (handles quoted commas) ----
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
      if (c === '"') { inQ = false; continue; }
      cell += c;
      continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === ",") { row.push(cell); cell = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
      continue;
    }
    cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const rows = parseCsv(raw);
const header = rows[0]; // the header row
const dataRows = rows.slice(1).filter(r => r.some(c => c.trim()));

// ---- Mappers ----
const FUEL = {
  "PETROL": "petrol",
  "DIESEL": "diesel",
  "ELECTRIC": "electric",
  "PETROL HYBRID": "hybrid",
  "PETROL PLUG-IN HYBRID": "hybrid",
};
const BODY = {
  "Hatchback": "hatchback",
  "Saloon": "saloon",
  "SUV": "suv",
  "MPV": "mpv",
  "Coupe": "coupe",
  "Pickup": "estate", // BodyType enum has no "pickup" — closest match
  "Estate": "estate",
  "Convertible": "convertible",
};
const TRANS = {
  "Automatic": "automatic",
  "Manual": "manual",
  "SEMI AUTO": "automatic",
};

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
}

function yearFromReg(reg, motIso) {
  const cleaned = reg.replace(/\s/g, "").toUpperCase();
  // Standard format AA00AAA
  const m = cleaned.match(/^[A-Z]{2}(\d{2})[A-Z]{3}$/);
  if (m) {
    const code = parseInt(m[1], 10);
    return code <= 50 ? 2000 + code : 2000 + code - 50;
  }
  // Fallback: estimate from MOT (UK new cars get 3-year MOT)
  if (motIso) {
    const yr = parseInt(motIso.slice(0, 4), 10);
    if (!Number.isNaN(yr)) return yr - 4;
  }
  return 2018;
}

function parseMot(uk) {
  const t = uk.trim();
  if (!t || t === "N/A") return null;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseImages(s) {
  const m = s.match(/Images \((\d+)\)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function parsePriceAndStatus(s) {
  const t = s.trim();
  const num = parseFloat(t.replace(/[^\d.]/g, ""));
  let status = "listed";
  if (/SOLD/i.test(t)) status = "sold";
  else if (/DEPOSIT/i.test(t)) status = "reserved";
  return { price: Number.isFinite(num) ? Math.round(num) : null, status };
}

function parseEnq(s) {
  const m = s.match(/Live:\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function localOrImport(loc) {
  const t = loc.trim().toLowerCase();
  if (t.includes("import") || t.includes("non zuto")) return "import";
  return "local";
}

// Some early CSV columns: ["", "Reg No", "Make", "Model", "Edition", "Fuel Type", "Body", "Colour", "Mileage", "Transmission", "Location", "Days in Stock", "", "", "Web Price", "Images", "Advert Spec", "eBay", "Next MOT Date", "Auto Trader", "Enquiries"]
// Indices: reg=1, make=2, model=3, edition=4, fuel=5, body=6, colour=7, mileage=8, trans=9, loc=10, days=11, price=14, images=15, mot=18, autoTrader=19, enq=20

const seeds = [];
let stockIdx = 1;
for (const r of dataRows) {
  const regRaw = (r[1] ?? "").trim();
  if (!regRaw) continue;
  const reg = regRaw.replace(/\s+/g, "").toUpperCase();

  const make = (r[2] ?? "").trim();
  if (!make) continue;
  const model = (r[3] ?? "").trim();
  const edition = (r[4] ?? "").trim();
  const fuel = FUEL[(r[5] ?? "").trim().toUpperCase()] ?? "petrol";
  const body = BODY[(r[6] ?? "").trim()] ?? "hatchback";
  const colour = titleCase((r[7] ?? "").trim().split("/")[0] || "Other");
  const mileage = parseInt((r[8] ?? "0").replace(/[^\d]/g, ""), 10) || 0;
  const trans = TRANS[(r[9] ?? "").trim()] ?? "automatic";
  const loc = localOrImport(r[10] ?? "");
  const days = parseInt((r[11] ?? "0").replace(/[^\d]/g, ""), 10) || 0;
  const { price: listingPrice, status } = parsePriceAndStatus(r[14] ?? "");
  const imagesCount = parseImages(r[15] ?? "");
  const motExpiry = parseMot(r[18] ?? "");
  const autoTrader = (r[19] ?? "").trim() === "1";
  const enquiriesCount = parseEnq(r[20] ?? "");
  const year = yearFromReg(reg, motExpiry);

  // Estimate buying price from listing — used-car typical margin ~28%
  const buyingPrice = listingPrice ? Math.round(listingPrice * 0.72 / 50) * 50 : 5000;
  // Source label
  const source = loc === "import" ? "Japan Import" : "BCA Auction";

  const id = `vehicle-${stockIdx}`;
  const stockId = `CC-${String(stockIdx).padStart(4, "0")}`;
  seeds.push({
    id, stockId, registration: regRaw.replace(/\s+/g, " ").trim(),
    make, model, variant: edition,
    bodyType: body, fuelType: fuel, transmission: trans,
    status, daysInStock: days, source,
    buyingPrice, listingPrice,
    year, colour, mileage,
    imagesCount, motExpiry, autoTrader, enquiriesCount,
    localOrImport: loc,
  });
  stockIdx++;
}

// ---- Emit TypeScript ----
function fmt(v) {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

const lines = seeds.map(s => {
  const fields = [
    `id: ${fmt(s.id)}`,
    `stockId: ${fmt(s.stockId)}`,
    `registration: ${fmt(s.registration)}`,
    `make: ${fmt(s.make)}`,
    `model: ${fmt(s.model)}`,
    `variant: ${fmt(s.variant)}`,
    `bodyType: ${fmt(s.bodyType)}`,
    `fuelType: ${fmt(s.fuelType)}`,
    `transmission: ${fmt(s.transmission)}`,
    `status: ${fmt(s.status)}`,
    `daysInStock: ${fmt(s.daysInStock)}`,
    `source: ${fmt(s.source)}`,
    `buyingPrice: ${fmt(s.buyingPrice)}`,
    `listingPrice: ${fmt(s.listingPrice)}`,
    `year: ${fmt(s.year)}`,
    `colour: ${fmt(s.colour)}`,
    `mileage: ${fmt(s.mileage)}`,
    `imagesCount: ${fmt(s.imagesCount)}`,
    `motExpiry: ${fmt(s.motExpiry)}`,
    `autoTrader: ${fmt(s.autoTrader)}`,
    `enquiriesCount: ${fmt(s.enquiriesCount)}`,
    `localOrImport: ${fmt(s.localOrImport)}`,
  ].join(", ");
  return `  { ${fields} },`;
});

console.log(`// Auto-generated from work_list.csv on ${new Date().toISOString()}`);
console.log(`// ${seeds.length} vehicles`);
console.log(`const VEHICLE_SEEDS: VehicleSeed[] = [`);
console.log(lines.join("\n"));
console.log(`];`);

// Also emit summary stats so we can sanity-check
console.error(`Generated ${seeds.length} seeds.`);
console.error(`Statuses:`, seeds.reduce((a, s) => (a[s.status] = (a[s.status] || 0) + 1, a), {}));
console.error(`localOrImport:`, seeds.reduce((a, s) => (a[s.localOrImport] = (a[s.localOrImport] || 0) + 1, a), {}));
console.error(`Body types:`, seeds.reduce((a, s) => (a[s.bodyType] = (a[s.bodyType] || 0) + 1, a), {}));
console.error(`Fuel types:`, seeds.reduce((a, s) => (a[s.fuelType] = (a[s.fuelType] || 0) + 1, a), {}));
