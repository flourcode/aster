/* ==========================================================================
   registry.js — loads the data and formats it. Shared by every page.
   ========================================================================== */

/* Pages generated into /a/<id>/ sit two folders deep, so every page carries
   a data-base attribute telling the scripts where the project root is. */
export const BASE = document.documentElement.dataset.base || "./";

export const CONFIG = window.SITE_CONFIG || {};

export const AU_KM = 149597870.7;
export const AU_LD = 389.17;   // 1 AU expressed in Moon-distances

export const ORBIT_CLASSES = {
  IEO: "Atira",
  ATE: "Aten",
  APO: "Apollo",
  AMO: "Amor",
  MCA: "Mars-crossing",
  IMB: "Inner main belt",
  MBA: "Main belt",
  OMB: "Outer main belt",
  TJN: "Jupiter trojan",
  AST: "Unclassified asteroid",
  CEN: "Centaur",
  TNO: "Trans-Neptunian"
};

let cache = null;

/** Load asteroids.json and claimed.json once, then hand back a tidy object. */
export async function loadRegistry() {
  if (cache) return cache;

  const [dataRes, claimedRes] = await Promise.all([
    fetch(BASE + "data/asteroids.json"),
    fetch(BASE + "data/claimed.json").catch(() => null)
  ]);

  if (!dataRes || !dataRes.ok) {
    throw new Error("Could not load data/asteroids.json");
  }

  const file = await dataRes.json();
  const claimed = claimedRes && claimedRes.ok ? await claimedRes.json() : {};

  const rocks = file.asteroids || [];
  const byId = new Map(rocks.map((r) => [String(r.id), r]));

  cache = { meta: file.meta || {}, rocks, byId, claimed: claimed || {} };
  return cache;
}

/** Has this rock been sold? Returns the claim record, or null. */
export function claimOf(claimed, rock) {
  return claimed[String(rock.id)] || null;
}

/* --- Formatting ------------------------------------------------------- */

export function className(code) {
  return ORBIT_CLASSES[code] || code || "Unknown";
}

export function fmtMoid(moid) {
  if (!isFinite(moid)) return { au: "—", ld: "—", km: "—", ldNum: "—" };
  const ld = moid * AU_LD;
  // The really close ones are the sellable ones, so don't round their
  // interesting digits away: 0.06 lunar distances beats "0.1".
  const dp = ld < 1 ? 3 : ld < 10 ? 2 : 1;
  return {
    au: moid.toFixed(5) + " AU",
    ldNum: ld.toFixed(dp),
    ld: ld.toFixed(dp) + " lunar distances",
    km: Math.round(moid * AU_KM).toLocaleString("en-US") + " km"
  };
}

export function fmtSize(rock) {
  const d = rock.diameterKm;
  if (!isFinite(d) || d <= 0) return "Unmeasured";
  if (d < 1) return Math.round(d * 1000).toLocaleString("en-US") + " m across";
  return d.toFixed(2) + " km across";
}

/** A plain-English size comparison. Purely for the joke; clearly rough. */
export function sizeJoke(rock) {
  const d = rock.diameterKm;
  if (!isFinite(d) || d <= 0) return "size unknown — could be anything";
  const m = d * 1000;
  if (m < 30) return "about the length of a bowling lane";
  if (m < 80) return "roughly a blue whale, but made of rock";
  if (m < 200) return "about the height of the Great Pyramid";
  if (m < 400) return "comfortably taller than the Empire State Building";
  if (m < 1200) return "roughly the length of Central Park's reservoir";
  if (m < 5000) return "about the size of a mid-sized city";
  return "genuinely enormous — the kind that ends an epoch";
}

export function fmtPeriod(rock) {
  const y = rock.periodYears;
  if (!isFinite(y)) return "—";
  return y < 2 ? (y * 12).toFixed(1) + " months" : y.toFixed(2) + " years";
}

/* --- Checkout --------------------------------------------------------- */

/**
 * Build the Stripe Checkout URL for one rock.
 * client_reference_id carries the NASA SPK-ID through to your Stripe
 * dashboard, so you always know which rock the payment was for.
 */
export function claimUrl(rock) {
  const link = CONFIG.stripePaymentLink;
  if (!link) return null;
  const sep = link.includes("?") ? "&" : "?";
  return `${link}${sep}client_reference_id=${encodeURIComponent(rock.id)}`;
}

export function recordUrl(rock) {
  return `${BASE}a/${rock.id}/`;
}

/* --- Small helpers ---------------------------------------------------- */

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function mountFooter(el) {
  const year = new Date().getFullYear();
  el.innerHTML = `
    <div class="wrap footer__grid">
      <div>
        <p><strong>This is a novelty registry.</strong> Names recorded here are
        recognised by this website and by absolutely no one else. Real asteroid
        names are assigned by the International Astronomical Union's Working
        Group for Small Bodies Nomenclature, which has never heard of us and
        would not return our calls.</p>
        <p>You are buying a certificate and a page on the internet. You are not
        buying an asteroid, a share in an asteroid, naming rights, mineral
        rights, or any interest recognised by any government or scientific
        body. It is a gift. It is meant to be funny.</p>
      </div>
      <div>
        <p>Orbital data from the
        <a href="https://ssd.jpl.nasa.gov/tools/sbdb_query.html">NASA/JPL
        Small-Body Database</a>, used under their open data policy.
        Not affiliated with or endorsed by NASA, JPL or Caltech.</p>
        <p>Questions, refunds, complaints:
        <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a></p>
        <p>&copy; ${year} ${esc(CONFIG.siteName)}</p>
      </div>
    </div>`;
}

export function mountHeader(el, current) {
  el.innerHTML = `
    <div class="wrap masthead__inner">
      <a class="masthead__mark" href="${BASE}index.html">
        ${esc(CONFIG.siteName)} <span>${esc(CONFIG.officeName)}</span>
      </a>
      <nav class="masthead__nav">
        <a href="${BASE}index.html"${current === "browse" ? ' aria-current="page"' : ""}>Browse the registry</a>
        <a href="${BASE}index.html#how">How it works</a>
      </nav>
    </div>`;
}
