/* ==========================================================================
   asteroid.js — renders one rock's record page.

   Works two ways:
     asteroid.html?id=2099942        (handy while you're developing)
     /a/2099942/                     (built by scripts/build-pages.mjs)
   ========================================================================== */

import {
  loadRegistry, claimOf, className, fmtMoid, fmtSize, fmtPeriod, sizeJoke,
  claimUrl, esc, mountHeader, mountFooter, CONFIG, BASE, AU_KM
} from "./registry.js";
import { orbitSvg } from "./orbit.js";

const $ = (id) => document.getElementById(id);

mountHeader($("masthead"));
mountFooter($("footer"));

const spkid =
  document.documentElement.dataset.spkid ||
  new URLSearchParams(location.search).get("id");

init();

async function init() {
  const out = $("record");

  if (!spkid) {
    out.innerHTML = notFound("No asteroid was specified.");
    return;
  }

  let data;
  try {
    data = await loadRegistry();
  } catch (err) {
    out.innerHTML = notFound("The inventory failed to load. Run <code>npm run fetch</code>, then reload.");
    console.error(err);
    return;
  }

  const rock = data.byId.get(String(spkid));
  if (!rock) {
    out.innerHTML = notFound("That asteroid isn't in this registry.");
    return;
  }

  const claim = claimOf(data.claimed, rock);
  document.title = `${claim ? claim.nickname : rock.fullName} — ${CONFIG.siteName}`;
  out.innerHTML = record(rock, claim);
  wireShare(rock, claim);
}

/* --- Markup ----------------------------------------------------------- */

function record(rock, claim) {
  const moid = fmtMoid(rock.moid);
  const url = claimUrl(rock);

  return `
  <div class="record__head">
    <span class="field-label">Orbital registration record · SPK-ID ${esc(rock.id)}</span>
    <h1>${esc(claim ? claim.nickname : rock.fullName)}</h1>
    <div class="record__badges">
      <span class="stamp ${claim ? "stamp--no" : "stamp--ok"}">
        ${claim ? "Claimed" : "Unclaimed"}
      </span>
      ${rock.pha ? '<span class="stamp stamp--hazard">Potentially hazardous</span>' : ""}
      <span class="stamp" style="color:var(--chalk-2)">${esc(className(rock.class))} orbit</span>
    </div>
    ${claim ? `<p class="prose" style="color:var(--chalk-2);margin:1.25rem 0 0;">
      NASA still files this rock under <span class="num">${esc(rock.fullName)}</span>.
      Everyone who lands on this page sees it under the name above.</p>` : ""}
  </div>

  <div class="record__grid">
    <div>
      <figure class="plate">
        <div>${orbitSvg(rock, { width: 560, height: 470 })}</div>
        <figcaption class="field-label" style="margin:.75rem 0 0;text-align:center;">
          Orbit viewed from above the solar system · position shown at the epoch of NASA's solution
        </figcaption>
      </figure>
      <small class="plate__source">
        Plotted from NASA's own orbital elements.
        <a href="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${esc(rock.id)}"
           rel="noopener">Check our figures against the JPL record</a>.
      </small>
    </div>

    <div>
      <h2>Threat metrics</h2>
      <p style="color:var(--chalk-2);margin:.5rem 0 1.25rem;font-size:.95rem;">
        All figures below are NASA's, unedited. We have not made this rock sound
        scarier than it is. It does that by itself.
      </p>

      <dl class="titleblock">
        ${row("Closest it gets to Earth's orbit", moid.ld, `${moid.au} · ${moid.km}`)}
        ${row("Hazard classification", rock.pha ? "Potentially hazardous" : "Not hazardous",
              rock.pha ? "Big enough and close enough that NASA watches it" : "NASA is relaxed about this one")}
        ${row("Orbit class", className(rock.class), rock.class)}
        ${row("Size", fmtSize(rock), sizeJoke(rock))}
        ${row("One year here lasts", fmtPeriod(rock), "")}
        ${row("Closest to the Sun", au(rock.q), "")}
        ${row("Farthest from the Sun", au(rock.ad), "")}
        ${row("Eccentricity", num(rock.e, 4), rock.e > 0.5 ? "A long, stretched, dramatic orbit" : "Fairly tidy")}
        ${row("Tilt of its orbit", num(rock.i, 2) + "°", "")}
        ${row("Brightness (absolute magnitude)", num(rock.H, 2), "Lower means bigger and brighter")}
        ${row("How well we know its path", orbitQuality(rock.conditionCode), rock.obsUsed
              ? `${Number(rock.obsUsed).toLocaleString("en-US")} observations used` : "")}
      </dl>

      ${claim ? claimedBox(rock, claim) : buyBox(rock, url)}
    </div>
  </div>`;
}

function buyBox(rock, url) {
  const price = esc(CONFIG.price || "$5");
  const live = Boolean(url);
  return `
  <div class="buybox">
    <h2>Claim and rename this asteroid — ${price}</h2>
    <p>At checkout you'll be asked two things: the name you want this rock to
      carry, and who the certificate is for. Everything else is automatic.</p>
    ${live
      ? `<a class="btn btn--claim" href="${esc(url)}">Claim ${esc(rock.fullName)} for ${price}</a>`
      : `<span class="btn btn--claim" aria-disabled="true">Checkout not connected yet</span>`}
    ${live ? "" : `<p class="buybox__fine">Add your Stripe Payment Link to
      <code>config.js</code> to switch this button on. See README step 4.</p>`}
    <p class="buybox__fine">
      What you get: a printable certificate by email, and this page updated with
      your name on it. What you don't get: anything the International
      Astronomical Union, NASA, or any court recognises. This is a gag gift, and
      we would rather tell you now than argue about it later.
    </p>
  </div>`;
}

function claimedBox(rock, claim) {
  return `
  <div class="claimed-note">
    <h2>Already claimed</h2>
    <p>Registered${claim.claimedOn ? ` on ${esc(claim.claimedOn)}` : ""}
      ${claim.dedicatedTo ? `in honour of <strong style="color:var(--chalk)">${esc(claim.dedicatedTo)}</strong>` : ""}.
      ${claim.note ? esc(claim.note) : ""}</p>
    <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.25rem;">
      <button class="btn" type="button" id="share">Copy link to this page</button>
      <a class="btn" href="${BASE}index.html#registry">Find another rock</a>
    </div>
  </div>`;
}

function wireShare(rock, claim) {
  const btn = $("share");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const url = `${CONFIG.siteUrl}/a/${rock.id}/`;
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy link to this page"), 2000);
    } catch {
      btn.textContent = url;
    }
  });
}

/* --- Bits ------------------------------------------------------------- */

function row(label, value, sub) {
  return `<div class="titleblock__row">
    <dt>${esc(label)}</dt>
    <dd>${esc(value)}${sub ? `<small>${esc(sub)}</small>` : ""}</dd>
  </div>`;
}

const num = (v, dp) => (isFinite(v) ? Number(v).toFixed(dp) : "—");
const au = (v) => (isFinite(v)
  ? `${Number(v).toFixed(3)} AU (${Math.round(v * AU_KM / 1e6).toLocaleString("en-US")} million km)`
  : "—");

function orbitQuality(code) {
  const c = Number(code);
  if (!isFinite(c)) return "Not stated";
  if (c === 0) return "Pinned down precisely";
  if (c <= 2) return "Very well known";
  if (c <= 5) return "Reasonably well known";
  if (c <= 7) return "Roughly known";
  return "Frankly, a bit of a guess";
}

function notFound(msg) {
  return `<div class="empty">
    <p>${msg}</p>
    <p style="margin-top:1rem;"><a class="btn" href="${BASE}index.html">Back to the registry</a></p>
  </div>`;
}
