/* ==========================================================================
   orbit.js — draws a real orbit from real numbers.

   This is not decoration. It takes the orbital elements NASA publishes for
   each rock (a, e, i, om, w, ma) and plots the actual ellipse, viewed from
   above the plane of the solar system, with Earth's orbit for scale.

   You do not need to understand the maths to run the site. If you want to:
     a  = semimajor axis      how big the orbit is, in AU (1 AU = Earth's distance from the Sun)
     e  = eccentricity        0 is a circle, 0.9 is a long cigar
     i  = inclination         how tilted the orbit is
     om = longitude of node   which way the tilt points
     w  = argument of perihelion   where the closest approach to the Sun sits
     ma = mean anomaly        where along the orbit the rock was at the epoch
   ========================================================================== */

const TAU = Math.PI * 2;
const rad = (deg) => (deg * Math.PI) / 180;

/* Rotate a point from the orbit's own plane into the ecliptic, then throw
   away the vertical component — that gives us the top-down view. */
function project(xOrb, yOrb, iR, omR, wR) {
  const ci = Math.cos(iR), co = Math.cos(omR), so = Math.sin(omR);
  const cw = Math.cos(wR), sw = Math.sin(wR);
  return {
    x: xOrb * (co * cw - so * sw * ci) - yOrb * (co * sw + so * cw * ci),
    y: xOrb * (so * cw + co * sw * ci) - yOrb * (so * sw - co * cw * ci)
  };
}

/* Solve Kepler's equation so we can put a dot where the rock actually was. */
function eccentricAnomaly(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let n = 0; n < 24; n++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

/**
 * Build an SVG string for one asteroid's orbit.
 * @param {object} rock   a record from data/asteroids.json
 * @param {object} [opts] { width, height, showLabels }
 * @returns {string} SVG markup
 */
export function orbitSvg(rock, opts = {}) {
  const width = opts.width || 560;
  const height = opts.height || 460;
  const showLabels = opts.showLabels !== false;
  const pad = 26;

  const a = Number(rock.a);
  let e = Number(rock.e);
  if (!isFinite(a) || !isFinite(e) || a <= 0) {
    return `<svg class="orbit" viewBox="0 0 ${width} ${height}" role="img"
      aria-label="Orbit data unavailable"><text class="orbit__text" x="${width / 2}" y="${height / 2}"
      text-anchor="middle">ORBIT DATA UNAVAILABLE</text></svg>`;
  }
  // Very high eccentricity draws as an unreadable sliver; nudge it for the plot only.
  if (e > 0.985) e = 0.985;

  const iR = rad(Number(rock.i) || 0);
  const omR = rad(Number(rock.om) || 0);
  const wR = rad(Number(rock.w) || 0);
  const p = a * (1 - e * e);

  // Trace the ellipse.
  const pts = [];
  const STEPS = 240;
  for (let s = 0; s <= STEPS; s++) {
    const nu = (s / STEPS) * TAU;
    const r = p / (1 + e * Math.cos(nu));
    pts.push(project(r * Math.cos(nu), r * Math.sin(nu), iR, omR, wR));
  }

  // Where it sat at the epoch of the orbit solution.
  let body = null;
  if (isFinite(Number(rock.ma))) {
    const M = rad(Number(rock.ma));
    const E = eccentricAnomaly(((M % TAU) + TAU) % TAU, e);
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
    const r = a * (1 - e * Math.cos(E));
    body = project(r * Math.cos(nu), r * Math.sin(nu), iR, omR, wR);
  }

  // Perihelion sits at true anomaly 0.
  const peri = project(p / (1 + e), 0, iR, omR, wR);

  // Fit everything, plus Earth's orbit, inside the box.
  let extent = 1.18;
  for (const pt of pts) extent = Math.max(extent, Math.abs(pt.x), Math.abs(pt.y));
  const scale = (Math.min(width, height) / 2 - pad) / extent;
  const cx = width / 2, cy = height / 2;
  const X = (v) => (cx + v * scale).toFixed(2);
  const Y = (v) => (cy - v * scale).toFixed(2);

  const path = pts.map((pt, n) => `${n ? "L" : "M"}${X(pt.x)},${Y(pt.y)}`).join("") + "Z";
  const hazard = rock.pha ? " orbit__path--hazard" : "";
  const earthR = (scale * 1).toFixed(2);

  // A 1 AU scale bar in the bottom-left corner.
  const barY = height - 14;
  const barLen = Math.min(scale, width / 3);

  const label = rock.pha
    ? `Orbit of ${rock.fullName}, a potentially hazardous asteroid, crossing near Earth's orbit`
    : `Orbit of ${rock.fullName} shown against Earth's orbit`;

  return `<svg class="orbit" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">
  <circle class="orbit__earth-path" cx="${cx}" cy="${cy}" r="${earthR}"/>
  <path class="orbit__path${hazard}" d="${path}"/>
  <circle class="orbit__sun" cx="${cx}" cy="${cy}" r="4"/>
  <circle class="orbit__earth" cx="${X(1)}" cy="${Y(0)}" r="3"/>
  <line class="orbit__tick" x1="${X(peri.x)}" y1="${Y(peri.y)}" x2="${cx}" y2="${cy}" stroke-dasharray="2 4"/>
  ${body ? `<circle class="orbit__body" cx="${X(body.x)}" cy="${Y(body.y)}" r="4.5"/>` : ""}
  ${showLabels ? `
  <line class="orbit__tick" x1="16" y1="${barY}" x2="${16 + barLen}" y2="${barY}"/>
  <line class="orbit__tick" x1="16" y1="${barY - 3}" x2="16" y2="${barY + 3}"/>
  <line class="orbit__tick" x1="${16 + barLen}" y1="${barY - 3}" x2="${16 + barLen}" y2="${barY + 3}"/>
  <text class="orbit__text" x="16" y="${barY - 7}">1 AU</text>
  <text class="orbit__text" x="${X(1)}" y="${Number(Y(0)) - 9}" text-anchor="middle">EARTH</text>` : ""}
</svg>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
