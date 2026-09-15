/* ==========================================================================
   fetch-asteroids.mjs

   Pulls your inventory from NASA/JPL's Small-Body Database Query API
   and writes it to data/asteroids.json.

   Run it:
     npm run fetch                      2,500 potentially hazardous asteroids
     npm run fetch -- --group=neo       all near-Earth objects instead
     npm run fetch -- --limit=500       fewer, for a faster site
     npm run fetch -- --named-only      only rocks that already have a name

   No API key. No account. No rate limit worth worrying about.
   Re-run it every few months; NASA keeps finding more.
   ========================================================================== */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://ssd-api.jpl.nasa.gov/sbdb_query.api";

/* Everything we'd like. If JPL ever retires one of these names the request
   fails, so we fall back to a smaller set that has been stable for years. */
const FIELDS_FULL = "spkid,full_name,pdes,name,class,neo,pha,moid,H,diameter," +
  "albedo,a,e,i,om,w,ma,per,q,ad,condition_code,n_obs_used";
const FIELDS_CORE = "spkid,full_name,pdes,class,neo,pha,moid,H,a,e,i,om,w,ma,per,q,ad";

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v === undefined ? true : v];
    })
);

const group = args.group === "neo" ? "neo" : "pha";
const limit = Number(args.limit) || 2500;
const namedOnly = Boolean(args["named-only"]);

main().catch((err) => {
  console.error("\n  Failed: " + err.message);
  console.error("  If this is a network error, check you're online and try again.\n");
  process.exit(1);
});

async function main() {
  console.log(`\n  Asking NASA/JPL for ${group.toUpperCase()} asteroids…`);

  let raw;
  try {
    raw = await query(FIELDS_FULL);
  } catch (err) {
    console.warn("  Full field list was rejected, retrying with core fields.");
    console.warn("  (" + err.message + ")");
    raw = await query(FIELDS_CORE);
  }

  const idx = Object.fromEntries(raw.fields.map((f, n) => [f, n]));
  const pick = (row, f) => (f in idx ? row[idx[f]] : null);

  let rocks = raw.data
    .map((row) => {
      const a = numOf(pick(row, "a"));
      const e = numOf(pick(row, "e"));
      if (a === null || e === null) return null;   // can't plot it, skip it

      const H = numOf(pick(row, "H"));
      const albedo = numOf(pick(row, "albedo"));
      const per = numOf(pick(row, "per"));

      return clean({
        id: String(pick(row, "spkid")),
        fullName: tidyName(pick(row, "full_name") || pick(row, "pdes")),
        name: (pick(row, "name") || "").trim() || null,
        class: pick(row, "class"),
        neo: pick(row, "neo") === "Y",
        pha: pick(row, "pha") === "Y",
        moid: round(numOf(pick(row, "moid")), 6),
        H: round(H, 2),
        diameterKm: round(diameter(numOf(pick(row, "diameter")), H, albedo), 4),
        diameterEstimated: numOf(pick(row, "diameter")) === null,
        a: round(a, 6),
        e: round(e, 6),
        i: round(numOf(pick(row, "i")), 4),
        om: round(numOf(pick(row, "om")), 4),
        w: round(numOf(pick(row, "w")), 4),
        ma: round(numOf(pick(row, "ma")), 4),
        q: round(numOf(pick(row, "q")), 5),
        ad: round(numOf(pick(row, "ad")), 5),
        periodYears: round(per === null ? null : per / 365.25, 4),
        conditionCode: numOf(pick(row, "condition_code")),
        obsUsed: numOf(pick(row, "n_obs_used"))
      });
    })
    .filter(Boolean);

  if (namedOnly) rocks = rocks.filter((r) => r.name);

  // Closest to Earth first — those are the ones people want to buy.
  rocks.sort((x, y) => (x.moid ?? 99) - (y.moid ?? 99));

  const total = rocks.length;
  rocks = rocks.slice(0, limit);

  const out = {
    meta: {
      generated: new Date().toISOString(),
      source: "NASA/JPL Small-Body Database Query API",
      sourceUrl: "https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html",
      group,
      matched: total,
      count: rocks.length,
      sample: false
    },
    asteroids: rocks
  };

  await mkdir(resolve(ROOT, "data"), { recursive: true });
  const file = resolve(ROOT, "data/asteroids.json");
  await writeFile(file, JSON.stringify(out, null, 0));

  const kb = Math.round(JSON.stringify(out).length / 1024);
  console.log(`  Matched ${total.toLocaleString("en-US")} objects, kept ${rocks.length.toLocaleString("en-US")}.`);
  console.log(`  Wrote data/asteroids.json (${kb} KB).`);
  console.log(`\n  Next:  npm run build      (generates a page per asteroid)\n`);
}

/* --- API -------------------------------------------------------------- */

async function query(fields) {
  const url = new URL(API);
  url.searchParams.set("fields", fields);
  url.searchParams.set("sb-kind", "a");     // asteroids only, no comets
  url.searchParams.set("sb-group", group);  // "pha" or "neo"

  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`JPL returned non-JSON (HTTP ${res.status})`);
  }
  if (!res.ok || !json.fields || !json.data) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json;
}

/* --- Tidying ---------------------------------------------------------- */

function numOf(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(v, dp) {
  return v === null || v === undefined ? null : Number(v.toFixed(dp));
}

/* JPL pads full_name with spaces for column alignment. */
function tidyName(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/* If nobody has measured the rock, estimate its size from how bright it is.
   Standard relation: D = 1329 / sqrt(albedo) * 10^(-H/5), albedo assumed 0.14
   for a typical stony asteroid. Flagged as estimated in the data. */
function diameter(measured, H, albedo) {
  if (measured !== null) return measured;
  if (H === null) return null;
  const p = albedo && albedo > 0 ? albedo : 0.14;
  return (1329 / Math.sqrt(p)) * Math.pow(10, -H / 5);
}

function clean(obj) {
  for (const k of Object.keys(obj)) if (obj[k] === null) delete obj[k];
  return obj;
}
