/* ==========================================================================
   certificate.js

   Your fulfilment workflow, start to finish:
     1. Stripe emails you: payment received, client_reference_id = 2099942,
        plus the two custom fields the buyer filled in.
     2. Open  certificate.html?id=2099942  on your site.
     3. Type the buyer's name and dedication into the toolbar.
     4. "Save as PDF" -> email it to them.
     5. "Copy registry entry" -> paste into data/claimed.json, commit, done.

   Everything is client-side. No server, no PDF service, no subscription.
   ========================================================================== */

import {
  loadRegistry, claimOf, className, fmtMoid, fmtSize, fmtPeriod,
  esc, CONFIG
} from "./registry.js";
import { orbitSvg } from "./orbit.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

let rock = null;
let state = { nickname: "", dedicatedTo: "", claimedOn: today() };

init();

async function init() {
  const id = params.get("id");
  if (!id) {
    $("hint").textContent = "Add ?id=SPKID to the address, e.g. certificate.html?id=2099942";
    return;
  }

  let data;
  try {
    data = await loadRegistry();
  } catch {
    $("hint").textContent = "Could not load data/asteroids.json.";
    return;
  }

  rock = data.byId.get(String(id));
  if (!rock) {
    $("hint").textContent = `No asteroid with SPK-ID ${id} in this registry.`;
    return;
  }

  // Pre-fill from claimed.json if it's already recorded, then let the URL win.
  const existing = claimOf(data.claimed, rock);
  if (existing) state = { ...state, ...existing };
  if (params.get("name")) state.nickname = params.get("name");
  if (params.get("for")) state.dedicatedTo = params.get("for");
  if (params.get("on")) state.claimedOn = params.get("on");

  $("t-name").value = state.nickname;
  $("t-for").value = state.dedicatedTo;
  $("hint").textContent = `${rock.fullName} · SPK-ID ${rock.id}`;

  $("t-name").addEventListener("input", (e) => { state.nickname = e.target.value; draw(); });
  $("t-for").addEventListener("input", (e) => { state.dedicatedTo = e.target.value; draw(); });
  $("print").addEventListener("click", () => window.print());
  $("copyjson").addEventListener("click", copyEntry);
  window.addEventListener("resize", fit);

  draw();
  fit();
}

/* --- Draw the sheet --------------------------------------------------- */

function draw() {
  const moid = fmtMoid(rock.moid);
  const nickname = state.nickname || "—";
  const dedicatedTo = state.dedicatedTo || "—";
  const certNo = `AAR-${rock.id}-${String(state.claimedOn).replace(/-/g, "")}`;

  $("inner").innerHTML = `
    <header class="cert-head">
      <div class="cert-office">${esc(CONFIG.siteName)} · ${esc(CONFIG.officeName)}</div>
      <h1 class="cert-title">Certificate of Orbital Registry</h1>
      <div class="cert-rule"></div>
    </header>

    <section class="cert-body">
      <div class="cert-statement">
        <p>The small body catalogued by NASA's Jet Propulsion Laboratory as
        <strong>${esc(rock.fullName)}</strong>, SPK-ID ${esc(rock.id)}, is hereby
        entered into this registry under the name</p>

        <div class="cert-designation">${esc(nickname)}</div>

        <div class="cert-for">
          <span class="lbl">Registered in honour of</span>
          <span class="val">${esc(dedicatedTo)}</span>
        </div>

        <dl class="cert-data">
          <div><dt>Orbit class</dt><dd>${esc(className(rock.class))}</dd></div>
          <div><dt>Hazard flag</dt><dd>${rock.pha ? "Potentially hazardous" : "Non-hazardous"}</dd></div>
          <div><dt>Closest to Earth's orbit</dt><dd>${esc(moid.au)}</dd></div>
          <div><dt>In Moon-distances</dt><dd>${esc(moid.ld)}</dd></div>
          <div><dt>Size</dt><dd>${esc(fmtSize(rock))}</dd></div>
          <div><dt>Orbital period</dt><dd>${esc(fmtPeriod(rock))}</dd></div>
        </dl>
      </div>

      <figure class="cert-plot">
        ${orbitSvg(rock, { width: 300, height: 260, showLabels: true })}
        <figcaption>Orbit as plotted from JPL elements · Earth's orbit shown dashed</figcaption>
      </figure>
    </section>

    <footer class="cert-foot">
      <div class="cert-sig">
        <span class="scrawl">${esc(CONFIG.officeName)}</span>
        <div class="line">Registrar, ${esc(CONFIG.siteName)}</div>
      </div>

      ${seal()}

      <div class="cert-sig" style="text-align:right;">
        <div style="font-family:var(--mono);font-size:11px;">${esc(certNo)}</div>
        <div class="line">Certificate number · issued ${esc(state.claimedOn)}</div>
      </div>

      <p class="cert-fine">
        <b>This certificate is a novelty item and confers no rights of any kind.</b>
        Official names for minor planets are assigned solely by the International
        Astronomical Union's Working Group for Small Bodies Nomenclature. The name
        above appears in this registry and nowhere else. Orbital data is real, sourced
        from the NASA/JPL Small-Body Database; NASA, JPL and Caltech are not
        affiliated with this registry and do not endorse it.
        Verify this entry at ${esc(stripScheme(CONFIG.siteUrl))}/a/${esc(rock.id)}/
      </p>
    </footer>`;
}

function seal() {
  return `
  <svg class="cert-seal" viewBox="0 0 120 120" role="img" aria-label="Registry seal">
    <defs>
      <path id="sealArc" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"/>
    </defs>
    <circle class="ring" cx="60" cy="60" r="55" stroke-width="2"/>
    <circle class="ring" cx="60" cy="60" r="51" stroke-width="0.6"/>
    <circle class="ring" cx="60" cy="60" r="34" stroke-width="0.6" stroke-dasharray="2 3"/>
    <text><textPath href="#sealArc" startOffset="50%" text-anchor="middle">
      NOVELTY · NOT RECOGNISED BY ANY SCIENTIFIC BODY ·
    </textPath></text>
    <text class="core" x="60" y="57">DULY</text>
    <text class="core" x="60" y="72">ENTERED</text>
  </svg>`;
}

/* --- Helpers ---------------------------------------------------------- */

/** Copy a ready-made line to paste into data/claimed.json. */
async function copyEntry() {
  const entry = {
    nickname: state.nickname,
    dedicatedTo: state.dedicatedTo,
    claimedOn: state.claimedOn,
    note: ""
  };
  const text = `  "${rock.id}": ${JSON.stringify(entry, null, 2).replace(/\n/g, "\n  ")},`;
  const btn = $("copyjson");
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied — paste into claimed.json";
  } catch {
    btn.textContent = "Press Ctrl+C";
    window.prompt("Copy this into data/claimed.json:", text);
  }
  setTimeout(() => (btn.textContent = "Copy registry entry"), 2600);
}

/** Shrink the A4 sheet so it fits narrow screens without a scrollbar. */
function fit() {
  const sheet = $("sheet");
  const available = document.documentElement.clientWidth - 32;
  const natural = sheet.offsetWidth;
  const ratio = Math.min(1, available / natural);
  sheet.style.setProperty("--fit", ratio);
  sheet.style.marginBottom = ratio < 1 ? `${-(1 - ratio) * sheet.offsetHeight}px` : "0";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function stripScheme(url) {
  return String(url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}
