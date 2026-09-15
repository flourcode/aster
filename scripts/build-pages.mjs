/* ==========================================================================
   build-pages.mjs

   Turns asteroid.html into one real page per asteroid at  /a/<SPK-ID>/ ,
   each with its own title and social-share preview. This is what makes a
   link look right when someone pastes it into Instagram or a group chat.

   Run it:  npm run build
   Run it again after every sale (once you've updated data/claimed.json).
   ========================================================================== */

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

main().catch((err) => {
  console.error("\n  Failed: " + err.message + "\n");
  process.exit(1);
});

async function main() {
  const cfg = await loadConfig();
  const site = String(cfg.siteUrl || "").replace(/\/$/, "");

  const file = JSON.parse(await readFile(resolve(ROOT, "data/asteroids.json"), "utf8"));
  const claimed = JSON.parse(
    await readFile(resolve(ROOT, "data/claimed.json"), "utf8").catch(() => "{}")
  );
  const template = await readFile(resolve(ROOT, "asteroid.html"), "utf8");
  const rocks = file.asteroids || [];

  if (!rocks.length) throw new Error("data/asteroids.json has no asteroids. Run: npm run fetch");

  console.log(`\n  Building ${rocks.length.toLocaleString("en-US")} pages…`);

  // Start clean so deleted asteroids don't leave orphan pages behind.
  await rm(resolve(ROOT, "a"), { recursive: true, force: true });

  const urls = [];
  for (const rock of rocks) {
    const claim = claimed[String(rock.id)];
    const displayName = claim ? claim.nickname : rock.fullName;
    const title = `${displayName} — ${cfg.siteName}`;
    const desc = describe(rock, claim, cfg);

    let html = template
      // Pages live two folders deep, so every relative path shifts up two.
      // This also rewrites data-base="./" to data-base="../../" for the scripts.
      .replaceAll('="./', '="../../')
      .replace('<html lang="en"', `<html lang="en" data-spkid="${rock.id}"`)
      .replace(
        "<title>Asteroid record — Adopt an Asteroid</title>",
        `<title>${esc(title)}</title>`
      )
      .replaceAll(
        'content="Orbital record for a real near-Earth asteroid. Claim it, name it, get a certificate."',
        `content="${esc(desc)}"`
      )
      .replaceAll(
        'content="Asteroid record — Adopt an Asteroid"',
        `content="${esc(title)}"`
      )
      .replace(
        '<meta property="og:url" content="">',
        `<meta property="og:url" content="${esc(site)}/a/${rock.id}/">`
      )
      // Give crawlers and no-JS visitors something real to read.
      .replace(
        '<p class="result-count">Loading record…</p>',
        fallback(rock, claim, displayName)
      );

    const dir = resolve(ROOT, "a", String(rock.id));
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, "index.html"), html);
    urls.push(`${site}/a/${rock.id}/`);
  }

  await writeFile(resolve(ROOT, "sitemap.xml"), sitemap([site + "/", ...urls]));
  await writeFile(
    resolve(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\nDisallow: /certificate.html\nSitemap: ${site}/sitemap.xml\n`
  );

  console.log(`  Wrote /a/…  plus sitemap.xml and robots.txt`);
  if (!site || site.includes("yourname.github.io")) {
    console.log(`\n  Heads up: siteUrl in config.js is still the placeholder.`);
    console.log(`  Share links and the sitemap will point at the wrong domain.`);
  }
  console.log(`\n  Commit and push. GitHub Pages will publish in about a minute.\n`);
}

/* --- Bits ------------------------------------------------------------- */

function describe(rock, claim, cfg) {
  const ld = isFinite(rock.moid) ? (rock.moid * 389.17).toFixed(1) : null;
  if (claim) {
    return `${rock.fullName} is registered here as “${claim.nickname}”` +
      (claim.dedicatedTo ? `, in honour of ${claim.dedicatedTo}` : "") +
      `. A real asteroid tracked by NASA. A completely unofficial name.`;
  }
  return `${rock.fullName} is a real ${rock.pha ? "potentially hazardous " : "near-Earth "}` +
    `asteroid tracked by NASA` + (ld ? `, passing within ${ld} lunar distances of Earth's orbit` : "") +
    `. Unclaimed. Name it for ${cfg.price || "$5"}.`;
}

function fallback(rock, claim, displayName) {
  const ld = isFinite(rock.moid) ? (rock.moid * 389.17).toFixed(1) + " lunar distances" : "unknown";
  return `<div class="record__head">
      <h1>${esc(displayName)}</h1>
      <p>NASA designation ${esc(rock.fullName)}, SPK-ID ${esc(rock.id)}.
      ${rock.pha ? "Flagged by NASA as potentially hazardous." : "A near-Earth object."}
      Comes within ${esc(ld)} of Earth's orbit.
      ${claim ? "Already claimed in this registry." : "Currently unclaimed."}</p>
    </div>`;
}

function sitemap(urls) {
  const body = urls
    .map((u) => `  <url><loc>${esc(u)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** config.js is written for the browser; run it in a tiny fake window. */
async function loadConfig() {
  const src = await readFile(resolve(ROOT, "config.js"), "utf8");
  const win = {};
  new Function("window", "module", src)(win, {});
  if (!win.SITE_CONFIG) throw new Error("Could not read config.js");
  return win.SITE_CONFIG;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
