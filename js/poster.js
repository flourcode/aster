/* ==========================================================================
   poster.js — builds a print-ready orbit chart as one big SVG.

   Everything is drawn in millimetres so the exported PDF is physically
   correct at any size. It's vector line art, so it stays sharp whether
   you print it at A4 or two metres wide.

   What's on the chart, and why each bit is there:

   - The orbit itself, plotted from NASA's real orbital elements.
   - Equal-time markers: the asteroid's position every 1/24th of its year.
     They crowd together where it's crawling at its farthest point and
     spread apart where it whips around the Sun. That's Kepler's second
     law, and it looks completely different on every rock.
   - Context rings for Earth, Mars and Jupiter, so the scale means something.
   - A side-view inset showing the orbit edge-on, which is the only way to
     see how tilted it is.
   - Perihelion and aphelion marked with real distances.
   ========================================================================== */

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
const AU_KM = 149597870.7;

export const PALETTES = {
  cyanotype: {
    name: "Cyanotype",
    ground: "#0C2A47", line: "#DCE9F4", dim: "#7CA3C4", faint: "#1E4husk",
    rule: "#2A567F", accent: "#F2A03D", orbit: "#DCE9F4", marker: "#F2A03D"
  },
  obsidian: {
    name: "Obsidian",
    ground: "#12100E", line: "#EDE6D8", dim: "#8C8375", faint: "#221E1A",
    rule: "#3A342C", accent: "#D4622A", orbit: "#EDE6D8", marker: "#D4622A"
  },
  bone: {
    name: "Bone",
    ground: "#F2EDE3", line: "#1E2A33", dim: "#6E7C86", faint: "#E2DACB",
    rule: "#B9AF9D", accent: "#8C2F26", orbit: "#1E2A33", marker: "#8C2F26"
  }
};
// (typo guard — see note in css; kept explicit so the palette object stays readable)
PALETTES.cyanotype.faint = "#143A5E";

export const SIZES = {
  a2:    { name: "A2 · 420 × 594 mm",   w: 420, h: 594, unit: "mm" },
  a1:    { name: "A1 · 594 × 841 mm",   w: 594, h: 841, unit: "mm" },
  in1824:{ name: '18" × 24"',           w: 457.2, h: 609.6, unit: "mm" },
  in2436:{ name: '24" × 36"',           w: 609.6, h: 914.4, unit: "mm" }
};

/* --- Orbital mechanics ------------------------------------------------- */

function eccentricAnomaly(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let n = 0; n < 40; n++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Position at a given true anomaly, in AU, in a frame where the ascending
    node lies along +x. Returns the top-down view and the edge-on view. */
function position(el, nu) {
  const p = el.a * (1 - el.e * el.e);
  const r = p / (1 + el.e * Math.cos(nu));
  const u = el.wR + nu;                       // angle from the ascending node
  return {
    r,
    top:  { x: r * Math.cos(u), y: r * Math.sin(u) * Math.cos(el.iR) },
    side: { x: r * Math.cos(u), y: r * Math.sin(u) * Math.sin(el.iR) }
  };
}

/** True anomaly at a given fraction through the orbital period. */
function nuAtTime(el, frac) {
  const M = ((frac * TAU) % TAU + TAU) % TAU;
  const E = eccentricAnomaly(M, el.e);
  return 2 * Math.atan2(
    Math.sqrt(1 + el.e) * Math.sin(E / 2),
    Math.sqrt(1 - el.e) * Math.cos(E / 2)
  );
}

function elements(rock) {
  let e = Number(rock.e);
  if (!isFinite(e) || e < 0) e = 0;
  if (e > 0.985) e = 0.985;            // draws as an unreadable sliver otherwise
  return {
    a: Number(rock.a),
    e,
    iR: rad(Number(rock.i) || 0),
    wR: rad(Number(rock.w) || 0)
  };
}

/* --- The poster -------------------------------------------------------- */

export function posterSvg(rock, opts = {}) {
  const size = SIZES[opts.size] || SIZES.a2;
  const pal = PALETTES[opts.palette] || PALETTES.cyanotype;
  const bleed = opts.bleed ? 3 : 0;
  const W = size.w, H = size.h;
  const el = elements(rock);

  if (!isFinite(el.a) || el.a <= 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"></svg>`;
  }

  const M = W * 0.082;                               // margin
  const t = {                                        // type scale, in mm
    eyebrow: W * 0.0155,
    title:   W * 0.088,
    sub:     W * 0.026,
    label:   W * 0.0125,
    value:   W * 0.0225,
    caption: W * 0.0135,
    credit:  W * 0.0115
  };

  const parts = [];
  const px = (n) => Number(n).toFixed(3);

  /* Header ------------------------------------------------------------- */
  let y = M + t.eyebrow;
  parts.push(text(M, y, seriesLine(rock), {
    size: t.eyebrow, fill: pal.dim, mono: true, tracking: t.eyebrow * 0.34
  }));

  y += t.title * 0.96;
  const display = (opts.title || rock.name || bareDesignation(rock)).toUpperCase();
  parts.push(text(M, y, display, {
    size: fitTitle(display, W - 2 * M, t.title), fill: pal.line, display: true
  }));

  y += t.sub * 1.5;
  parts.push(text(M, y, subtitle(rock), { size: t.sub, fill: pal.dim }));

  y += t.sub * 0.9;
  parts.push(rule(M, y, W - M, pal.rule, W * 0.0011));

  /* Plot --------------------------------------------------------------- */
  const dataH = W * 0.375;
  const plotTop = y + W * 0.05;
  const plotW = W - 2 * M;
  const plotH = H - plotTop - dataH - M;

  parts.push(topDownPlot(el, rock, M, plotTop, plotW, plotH, pal, t));

  /* Data block --------------------------------------------------------- */
  let dy = plotTop + plotH + W * 0.03;
  parts.push(rule(M, dy, W - M, pal.rule, W * 0.0011));
  dy += W * 0.04;

  const insetW = (W - 2 * M) * 0.36;
  const tableW = (W - 2 * M) - insetW - W * 0.055;
  const rowH = t.value * 2.3;

  parts.push(statTable(rock, el, M, dy, tableW, pal, t, rowH));
  parts.push(sideView(el, rock, W - M - insetW, dy, insetW, W * 0.135, pal, t));

  // Everything below hangs off one cursor, so it can never collide.
  let fy = dy + rowH * 4 + W * 0.004;

  parts.push(`<line x1="${px(M)}" y1="${px(fy - t.label * 0.34)}"
      x2="${px(M + W * 0.032)}" y2="${px(fy - t.label * 0.34)}"
      stroke="${pal.orbit}" stroke-width="${px(W * 0.0013)}" opacity="0.55"
      stroke-dasharray="${px(W * 0.008)} ${px(W * 0.008)}"/>`);
  parts.push(text(M + W * 0.042, fy, "BROKEN LINE: THE ORBIT IS BELOW EARTH'S ORBITAL PLANE", {
    size: t.label, fill: pal.dim, mono: true, tracking: t.label * 0.2
  }));

  if (opts.dedication && opts.dedication.trim()) {
    fy += t.caption * 2.4;
    parts.push(rule(M, fy - t.caption * 1.2, W - M, pal.rule, W * 0.0008));
    fy += t.caption * 1.1;
    parts.push(text(W / 2, fy, opts.dedication.trim(), {
      size: t.caption * 1.3, fill: pal.line, anchor: "middle", display: true,
      tracking: t.caption * 0.1
    }));
  }

  /* Credit ------------------------------------------------------------- */
  const by = H - M;
  parts.push(text(M, by, credit(), {
    size: t.credit, fill: pal.dim, mono: true, tracking: t.credit * 0.16
  }));
  parts.push(text(W - M, by, `SPK-ID ${rock.id}`, {
    size: t.credit, fill: pal.dim, mono: true, anchor: "end", tracking: t.credit * 0.16
  }));

  /* Bleed marks -------------------------------------------------------- */
  const bleedMarks = bleed ? `
    <rect x="0" y="0" width="${px(W)}" height="${px(H)}" fill="none"
          stroke="${pal.accent}" stroke-width="0.2" stroke-dasharray="3 3" opacity="0.7"/>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg"
   width="${px(W + bleed * 2)}mm" height="${px(H + bleed * 2)}mm"
   viewBox="${px(-bleed)} ${px(-bleed)} ${px(W + bleed * 2)} ${px(H + bleed * 2)}">
  <rect x="${px(-bleed)}" y="${px(-bleed)}" width="${px(W + bleed * 2)}"
        height="${px(H + bleed * 2)}" fill="${pal.ground}"/>
  ${bleedMarks}
  ${parts.join("\n  ")}
</svg>`;
}

/* --- Plot pieces ------------------------------------------------------- */

function topDownPlot(el, rock, px0, py0, pw, ph, pal, t) {
  const q = el.a * (1 - el.e);
  const Q = el.a * (1 + el.e);

  // Context rings, only where they'd mean something.
  const rings = [{ r: 1, label: "EARTH" }];
  if (Q > 1.35) rings.push({ r: 1.524, label: "MARS" });
  if (Q > 4.6) rings.push({ r: 5.204, label: "JUPITER" });
  const ringMax = rings[rings.length - 1].r;

  // Sample the orbit once and keep the vertical offset so we can show which
  // half of the orbit sits below the plane of Earth's orbit.
  const samples = [];
  for (let n = 0; n <= 360; n++) {
    const nu = (n / 360) * TAU;
    const pt = position(el, nu);
    const u = el.wR + nu;
    samples.push({ x: pt.top.x, y: pt.top.y, below: Math.sin(u) * Math.sin(el.iR) < 0 });
  }

  // Fit the drawing to the space rather than centring on the Sun — the Sun
  // sits at a focus, so a centred ellipse wastes half the paper.
  let minX = -ringMax, maxX = ringMax, minY = -ringMax, maxY = ringMax;
  for (const pt of samples) {
    minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
    minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
  }
  const pad = 0.15;                                  // clear space for the labels
  const spanX = (maxX - minX) * (1 + pad);
  const spanY = (maxY - minY) * (1 + pad);
  const s = Math.min(pw / spanX, ph / spanY);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  const cx = px0 + pw / 2, cy = py0 + ph / 2;
  const X = (v) => (cx + (v - midX) * s).toFixed(3);
  const Y = (v) => (cy - (v - midY) * s).toFixed(3);

  const box = Math.min(pw, ph);                      // for sizing marks and type
  const out = [];

  for (const ring of rings) {
    out.push(`<circle cx="${X(0)}" cy="${Y(0)}" r="${(ring.r * s).toFixed(3)}"
      fill="none" stroke="${pal.dim}" stroke-width="${(box * 0.0011).toFixed(3)}"
      stroke-dasharray="${(box * 0.005).toFixed(2)} ${(box * 0.008).toFixed(2)}" opacity="0.5"/>`);
    out.push(text(X(0), Number(Y(ring.r)) - box * 0.009, ring.label, {
      size: box * 0.016, fill: pal.dim, anchor: "middle", mono: true,
      tracking: box * 0.0045, raw: true
    }));
  }

  // Draw the orbit in two passes: the half above Earth's orbital plane
  // solid, the half below it broken. That's the only cue in a flat drawing
  // that the orbit is tilted through the plane rather than lying in it.
  const stroke = (box * 0.0038).toFixed(3);
  for (const below of [true, false]) {
    let d = "", open = false;
    for (const pt of samples) {
      if (pt.below === below) {
        d += `${open ? "L" : "M"}${X(pt.x)},${Y(pt.y)}`;
        open = true;
      } else {
        open = false;
      }
    }
    if (!d) continue;
    out.push(`<path d="${d}" fill="none" stroke="${pal.orbit}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-linejoin="round"
      ${below ? `stroke-dasharray="${(box * 0.011).toFixed(2)} ${(box * 0.011).toFixed(2)}" opacity="0.55"` : ""}/>`);
  }

  // Equal-time markers: the asteroid's position every 1/24th of its year.
  for (let n = 0; n < 24; n++) {
    const pt = position(el, nuAtTime(el, n / 24));
    out.push(`<circle cx="${X(pt.top.x)}" cy="${Y(pt.top.y)}"
      r="${(box * 0.0058).toFixed(3)}" fill="${pal.marker}"/>`);
  }

  out.push(`<circle cx="${X(0)}" cy="${Y(0)}" r="${(box * 0.0105).toFixed(3)}" fill="${pal.accent}"/>`);

  // Perihelion and aphelion. Just a crosshair and a one-word label here —
  // the distances live in the table below, where they can't land on the line.
  for (const [nu, name] of [[0, "NEAREST"], [Math.PI, "FARTHEST"]]) {
    const pt = position(el, nu).top;
    const len = Math.hypot(pt.x, pt.y) || 1;
    const ux = pt.x / len, uy = pt.y / len;
    const fs = box * 0.016;
    out.push(tick(X(pt.x), Y(pt.y), box, pal.line));
    out.push(text(
      Number(X(pt.x)) + ux * box * 0.032,
      Number(Y(pt.y)) - uy * box * 0.032 + fs * 0.36,
      name,
      {
        size: fs, fill: pal.line, mono: true, raw: true,
        anchor: ux >= 0 ? "start" : "end", tracking: box * 0.0035
      }
    ));
  }

  return out.join("\n  ");
}

function sideView(el, rock, x, y, w, h, pal, t) {
  const Q = el.a * (1 + el.e);
  const s = (w / 2) / (Q * 1.04);
  const cx = x + w / 2;
  const cy = y + t.label * 1.8 + (h - t.label * 1.8) * 0.5;
  const X = (v) => (cx + v * s).toFixed(3);
  const Y = (v) => (cy - v * s).toFixed(3);

  const path = [];
  for (let n = 0; n <= 360; n++) {
    const p = position(el, (n / 360) * TAU);
    path.push(`${n ? "L" : "M"}${X(p.side.x)},${Y(p.side.y)}`);
  }

  return `
  <line x1="${X(-1)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(0)}"
        stroke="${pal.dim}" stroke-width="${(w * 0.004).toFixed(3)}"
        stroke-dasharray="${(w * 0.012).toFixed(2)} ${(w * 0.016).toFixed(2)}"/>
  <path d="${path.join("")}Z" fill="none" stroke="${pal.orbit}" stroke-width="${(w * 0.0075).toFixed(3)}"/>
  <circle cx="${X(0)}" cy="${Y(0)}" r="${(w * 0.016).toFixed(3)}" fill="${pal.accent}"/>
  ${text(x, y, `THE SAME ORBIT EDGE ON · TILTED ${Number(rock.i || 0).toFixed(1)}°`, {
    size: t.label, fill: pal.dim, mono: true, tracking: t.label * 0.2, raw: true
  })}`;
}

function statTable(rock, el, x, y, w, pal, t, rowH) {
  const q = el.a * (1 - el.e), Q = el.a * (1 + el.e);
  const cells = [
    ["ORBIT CLASS", className(rock.class)],
    ["ORBITAL PERIOD", rock.periodYears ? fmtPeriod(rock.periodYears) : "—"],
    ["NEAREST THE SUN", q.toFixed(3) + " AU"],
    ["FARTHEST FROM THE SUN", Q.toFixed(3) + " AU"],
    ["ECCENTRICITY", isFinite(rock.e) ? Number(rock.e).toFixed(4) : "—"],
    ["DIAMETER", fmtSize(rock)],
    ["TILT TO EARTH'S ORBIT", Number(rock.i || 0).toFixed(1) + "°"],
    ["CLOSEST TO EARTH'S ORBIT", isFinite(rock.moid)
      ? (rock.moid * 389.17).toFixed(2) + " LUNAR DISTANCES" : "—"]
  ];

  const cols = 2;
  const colW = w / cols;
  const out = [];

  cells.forEach(([label, value], n) => {
    const cx = x + (n % cols) * colW;
    const cy = y + Math.floor(n / cols) * rowH;
    out.push(text(cx, cy, label, {
      size: t.label, fill: pal.dim, mono: true, tracking: t.label * 0.2
    }));
    out.push(text(cx, cy + t.value * 1.15, String(value).toUpperCase(), {
      size: t.value, fill: pal.line, display: true, tracking: t.value * 0.015
    }));
  });

  return out.join("\n  ");
}

/* --- Small builders ---------------------------------------------------- */

function text(x, y, content, o = {}) {
  const family = o.mono
    ? "'IBM Plex Mono', monospace"
    : o.display
      ? "'Antonio', 'Arial Narrow', sans-serif"
      : "'IBM Plex Sans', sans-serif";
  const weight = o.display ? 400 : 500;
  return `<text x="${o.raw ? x : Number(x).toFixed(3)}" y="${o.raw ? y : Number(y).toFixed(3)}"
    font-family="${family}" font-size="${Number(o.size).toFixed(3)}"
    font-weight="${weight}" fill="${o.fill}"
    ${o.anchor ? `text-anchor="${o.anchor}"` : ""}
    ${o.tracking ? `letter-spacing="${Number(o.tracking).toFixed(3)}"` : ""}
    >${esc(content)}</text>`;
}

function rule(x1, y, x2, color, w) {
  return `<line x1="${x1.toFixed(3)}" y1="${y.toFixed(3)}" x2="${x2.toFixed(3)}"
    y2="${y.toFixed(3)}" stroke="${color}" stroke-width="${w.toFixed(3)}"/>`;
}

function tick(x, y, box, color) {
  const r = box * 0.014;
  return `<g stroke="${color}" stroke-width="${(box * 0.0022).toFixed(3)}">
    <line x1="${Number(x) - r}" y1="${y}" x2="${Number(x) + r}" y2="${y}"/>
    <line x1="${x}" y1="${Number(y) - r}" x2="${x}" y2="${Number(y) + r}"/>
  </g>`;
}

/* Antonio is condensed, so roughly 0.42em per character. Shrink long names
   rather than letting them run off the edge of the paper. */
function fitTitle(str, maxWidth, base) {
  const estimated = str.length * base * 0.44;
  return estimated > maxWidth ? base * (maxWidth / estimated) : base;
}

/* "3200 Phaethon (1983 TB)" -> "3200 Phaethon"; "(2011 AG5)" -> "2011 AG5" */
function bareDesignation(rock) {
  const m = String(rock.fullName || "").match(/^\s*\(?([^()]+?)\)?\s*$/);
  return (m ? m[1] : rock.fullName || "").trim();
}

function seriesLine(rock) {
  return rock.pha
    ? "POTENTIALLY HAZARDOUS ASTEROID · ORBITAL CHART"
    : "NEAR-EARTH ASTEROID · ORBITAL CHART";
}

function subtitle(rock) {
  // The title shows the name when there is one, otherwise the designation.
  // Only repeat the full designation underneath when it adds something.
  const cls = className(rock.class) + " orbit";
  return rock.name ? `${rock.fullName} · ${cls}` : cls;
}

function credit() {
  return "ORBIT PLOTTED FROM NASA/JPL SMALL-BODY DATABASE ELEMENTS";
}

function className(code) {
  return ({
    IEO: "Atira", ATE: "Aten", APO: "Apollo", AMO: "Amor",
    MCA: "Mars-crossing", IMB: "Inner main belt", MBA: "Main belt",
    OMB: "Outer main belt", TJN: "Jupiter trojan", AST: "Asteroid",
    CEN: "Centaur", TNO: "Trans-Neptunian"
  })[code] || code || "Unclassified";
}

function fmtPeriod(y) {
  return y < 2 ? (y * 12).toFixed(1) + " months" : y.toFixed(2) + " years";
}

function fmtSize(rock) {
  const d = rock.diameterKm;
  if (!isFinite(d) || d <= 0) return "Unmeasured";
  return d < 1 ? Math.round(d * 1000) + " metres" : d.toFixed(2) + " km";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
