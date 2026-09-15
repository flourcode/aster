/* ==========================================================================
   browse.js — powers the homepage: hero shuffle, search, filters, paging.
   ========================================================================== */

import {
  loadRegistry, claimOf, className, fmtMoid, fmtSize, recordUrl,
  esc, mountHeader, mountFooter, CONFIG, BASE
} from "./registry.js";
import { orbitSvg } from "./orbit.js";

const $ = (id) => document.getElementById(id);

mountHeader($("masthead"), "browse");
mountFooter($("footer"));

let DATA;
let shown = 0;
let filtered = [];

init();

async function init() {
  try {
    DATA = await loadRegistry();
  } catch (err) {
    $("count").textContent =
      "The inventory failed to load. If you have just cloned this repo, run: npm run fetch";
    console.error(err);
    return;
  }

  if (DATA.meta.sample && CONFIG.showSampleBanner !== false) {
    $("banner").className = "banner";
    $("banner").innerHTML =
      'Showing a handful of sample asteroids. Run <code>npm run fetch</code> to pull the real NASA inventory.';
  }

  buildClassOptions();
  wire();
  shuffleHero();
  apply();
}

function buildClassOptions() {
  const codes = [...new Set(DATA.rocks.map((r) => r.class))].sort();
  const sel = $("cls");
  for (const c of codes) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = className(c);
    sel.appendChild(o);
  }
}

function wire() {
  ["q", "cls", "sort", "unclaimed", "phaonly"].forEach((id) =>
    $(id).addEventListener("input", apply)
  );
  $("more").addEventListener("click", () => render(true));
  $("shuffle").addEventListener("click", shuffleHero);
}

/* --- Hero ------------------------------------------------------------- */

function shuffleHero() {
  const scary = DATA.rocks.filter((r) => r.pha && isFinite(r.a));
  const pool = scary.length ? scary : DATA.rocks;
  const rock = pool[Math.floor(Math.random() * pool.length)];
  if (!rock) return;

  $("hero-orbit").innerHTML = orbitSvg(rock, { width: 520, height: 420 });
  const moid = fmtMoid(rock.moid);
  const claim = claimOf(DATA.claimed, rock);

  $("hero-caption").innerHTML = `
    <span>
      <span class="field-label">Currently plotted</span>
      <b><a href="${recordUrl(rock)}">${esc(claim ? claim.nickname : rock.fullName)}</a></b>
    </span>
    <span>
      <span class="field-label">Misses Earth by (LD)</span>
      <b class="num">${esc(moid.ldNum)}</b>
    </span>`;
}

/* --- Filtering -------------------------------------------------------- */

function apply() {
  const q = $("q").value.trim().toLowerCase();
  const cls = $("cls").value;
  const unclaimedOnly = $("unclaimed").checked;
  const phaOnly = $("phaonly").checked;
  const sort = $("sort").value;

  filtered = DATA.rocks.filter((r) => {
    if (cls && r.class !== cls) return false;
    if (phaOnly && !r.pha) return false;
    if (unclaimedOnly && claimOf(DATA.claimed, r)) return false;
    if (q) {
      const claim = claimOf(DATA.claimed, r);
      const hay = (r.fullName + " " + (r.name || "") + " " + (claim ? claim.nickname : "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered.sort((x, y) => {
    if (sort === "size") return (y.diameterKm || 0) - (x.diameterKm || 0);
    if (sort === "name") return String(x.fullName).localeCompare(String(y.fullName));
    return (x.moid ?? 99) - (y.moid ?? 99);
  });

  shown = 0;
  $("grid").innerHTML = "";
  render(true);
}

function render(append) {
  const size = CONFIG.pageSize || 60;
  const slice = filtered.slice(shown, shown + size);
  shown += slice.length;

  if (!filtered.length) {
    $("grid").innerHTML =
      '<p class="empty">No rocks match that. Try clearing the filters — the whole point is that there are thousands of them.</p>';
    $("count").textContent = "0 asteroids";
    $("more").hidden = true;
    return;
  }

  $("grid").insertAdjacentHTML("beforeend", slice.map(card).join(""));
  $("count").textContent =
    `Showing ${shown.toLocaleString("en-US")} of ${filtered.length.toLocaleString("en-US")} asteroids`;
  $("more").hidden = shown >= filtered.length;
}

function card(rock) {
  const claim = claimOf(DATA.claimed, rock);
  const moid = fmtMoid(rock.moid);
  return `
  <a class="rock" href="${recordUrl(rock)}">
    <div class="rock__top">
      <span class="rock__name">${esc(rock.fullName)}</span>
      <span class="stamp ${claim ? "stamp--no" : "stamp--ok"}">${claim ? "Claimed" : "Unclaimed"}</span>
    </div>
    ${claim ? `<span class="rock__nick">Known here as “${esc(claim.nickname)}”</span>` : ""}
    <div class="rock__stats">
      <span>
        <span class="field-label">Orbit class</span>
        <b>${esc(className(rock.class))}</b>
      </span>
      <span>
        <span class="field-label">Misses Earth by</span>
        <b>${esc(moid.ld)}</b>
      </span>
      <span>
        <span class="field-label">Size</span>
        <b>${esc(fmtSize(rock))}</b>
      </span>
      <span>
        <span class="field-label">Hazard flag</span>
        <b>${rock.pha ? "Yes" : "No"}</b>
      </span>
    </div>
  </a>`;
}
