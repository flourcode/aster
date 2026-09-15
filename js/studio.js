/* ==========================================================================
   studio.js — the page where you pick a rock and make a print.

   Exporting:
   - "Save as PDF" prints the chart at its true physical size. The result is
     a real vector PDF, which is what a print shop or Printful wants.
   - "Download SVG" gives you the raw vector file for Illustrator, Inkscape,
     or anywhere that wants to scale it further.
   ========================================================================== */

import { loadRegistry, esc, mountHeader, mountFooter } from "./registry.js";
import { posterSvg, PALETTES, SIZES } from "./poster.js";

const $ = (id) => document.getElementById(id);

mountHeader($("masthead"), "poster");
mountFooter($("footer"));

let DATA, current = null;
const state = { palette: "cyanotype", size: "a2", dedication: "", bleed: false };

init();

async function init() {
  try {
    DATA = await loadRegistry();
  } catch {
    $("paper").textContent = "Couldn't load data/asteroids.json.";
    return;
  }

  fillSelect($("palette"), Object.entries(PALETTES).map(([k, v]) => [k, v.name]));
  fillSelect($("size"), Object.entries(SIZES).map(([k, v]) => [k, v.name]));
  fillRocks(DATA.rocks);

  $("rock").addEventListener("change", () => select($("rock").value));
  $("q").addEventListener("input", onSearch);
  $("palette").addEventListener("change", (e) => { state.palette = e.target.value; draw(); });
  $("size").addEventListener("change", (e) => { state.size = e.target.value; draw(); });
  $("dedication").addEventListener("input", (e) => { state.dedication = e.target.value; draw(); });
  $("bleed").addEventListener("change", (e) => { state.bleed = e.target.checked; draw(); });
  $("shuffle").addEventListener("click", shuffle);
  $("pdf").addEventListener("click", toPdf);
  $("svg").addEventListener("click", toSvg);

  // Deep link: poster.html?id=2003200
  const wanted = new URLSearchParams(location.search).get("id");
  select(wanted && DATA.byId.has(wanted) ? wanted : pickInteresting().id);
}

/* --- Choosing --------------------------------------------------------- */

function fillSelect(el, pairs) {
  el.innerHTML = pairs
    .map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`)
    .join("");
}

function fillRocks(rocks) {
  // Named rocks first — they make better posters than "2011 AG5".
  const sorted = [...rocks].sort((a, b) => {
    if (Boolean(a.name) !== Boolean(b.name)) return a.name ? -1 : 1;
    return (a.moid ?? 99) - (b.moid ?? 99);
  });
  $("rock").innerHTML = sorted
    .slice(0, 800)
    .map((r) => `<option value="${esc(r.id)}">${esc(r.fullName)}</option>`)
    .join("");
}

function onSearch() {
  const q = $("q").value.trim().toLowerCase();
  if (!q) return fillRocks(DATA.rocks);
  const hits = DATA.rocks.filter((r) =>
    (r.fullName + " " + (r.name || "")).toLowerCase().includes(q));
  fillRocks(hits);
  if (hits.length) select($("rock").value || hits[0].id);
}

function select(id) {
  current = DATA.byId.get(String(id));
  if (!current) return;
  $("rock").value = current.id;
  draw();
}

/** An eccentric orbit makes a far more striking print than a near-circle. */
function pickInteresting() {
  const good = DATA.rocks.filter((r) => r.name && r.e > 0.4);
  const pool = good.length ? good : DATA.rocks;
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle() {
  $("q").value = "";
  fillRocks(DATA.rocks);
  select(pickInteresting().id);
}

/* --- Drawing ---------------------------------------------------------- */

function draw() {
  if (!current) return;
  const svg = posterSvg(current, state);
  $("paper").innerHTML = svg;
  $("printlayer").innerHTML = svg;

  const size = SIZES[state.size];
  $("note").textContent =
    `${size.name} · vector, so it stays sharp at any size · ` +
    (state.bleed ? "3 mm bleed included" : "no bleed");

  // Match the print page to the chosen paper, including bleed.
  const b = state.bleed ? 6 : 0;
  pageRule(`@page { size: ${size.w + b}mm ${size.h + b}mm; margin: 0; }`);
}

let pageStyle;
function pageRule(css) {
  if (!pageStyle) {
    pageStyle = document.createElement("style");
    document.head.appendChild(pageStyle);
  }
  pageStyle.textContent = css;
}

/* --- Exporting -------------------------------------------------------- */

function toPdf() {
  window.print();
}

function toSvg() {
  const svg = posterSvg(current, state);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orbit-chart-${slug(current.fullName)}-${state.size}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
