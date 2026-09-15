# Adopt an Asteroid

A novelty registry of real, NASA-tracked near-Earth asteroids. People pay $5 to
put a name on one and get a printable certificate.

Plain HTML, CSS and JavaScript. No framework, no build tool, no server, no
database, no monthly bills. It runs on GitHub Pages for free, and two small Node
scripts do the only heavy lifting.

---

## What's actually happening

| Piece | How it works |
|---|---|
| The inventory | A script asks NASA/JPL for thousands of asteroids and saves them to `data/asteroids.json`. No API key needed. |
| The pages | A script turns that JSON into one real page per asteroid at `/a/<SPK-ID>/`, each with its own title and link preview. |
| The orbit diagrams | Drawn in the browser from each rock's actual orbital elements. Not stock art — the shape of the ellipse is that rock's real orbit. |
| Checkout | A Stripe Payment Link. The asteroid's ID rides along in the URL so you always know which rock was bought. |
| The certificate | An HTML page you print to PDF. No Bannerbear, no Placid, no subscription. |
| The claimed list | A single file, `data/claimed.json`, that you edit after each sale. |

---

## Setup, start to finish

You need [Node.js](https://nodejs.org) (version 18 or newer) and a GitHub
account. That's it.

### 1. Get it running on your machine

```bash
git clone https://github.com/YOURNAME/asteroid-registry.git
cd asteroid-registry
npm run serve
```

Open the address it prints. You'll see ten sample asteroids so you can look
around before doing anything else.

### 2. Pull the real inventory from NASA

```bash
npm run fetch
```

That downloads every **potentially hazardous asteroid** JPL knows about, keeps
the 2,500 that pass closest to Earth, and writes `data/asteroids.json`.

Other options:

```bash
npm run fetch -- --group=neo      # all near-Earth objects, not just hazardous ones
npm run fetch -- --limit=500      # a smaller, faster site
npm run fetch -- --named-only     # only rocks with real names (Bennu, Apophis, Eros…)
```

Potentially hazardous is the better inventory to sell. "Potentially hazardous
asteroid" is a real NASA classification, it sounds alarming, and it is the whole
gift.

### 3. Point the site at your domain, then build

Open `config.js` and set `siteUrl` to wherever this will live:

- GitHub Pages project site: `https://yourname.github.io/asteroid-registry`
- Custom domain: `https://adoptanasteroid.com`

Then:

```bash
npm run build
```

This writes a folder per asteroid into `a/`, plus `sitemap.xml` and
`robots.txt`. Commit everything — the generated pages are meant to be in the
repo, that's what GitHub Pages serves.

### 4. Wire up Stripe

In your Stripe dashboard, go to **Payment Links** and create one:

- Product: "Asteroid registration", price $5, one-time
- Under **Advanced options → Custom fields**, add two text fields:
  1. Label: `Name for this asteroid` — required
  2. Label: `Who is this certificate for?` — required

Copy the link (it looks like `https://buy.stripe.com/aBc123`) into
`stripePaymentLink` in `config.js`, then `npm run build` again.

The site appends `?client_reference_id=<SPK-ID>` to that link automatically, so
every payment in your Stripe dashboard shows exactly which rock it was for.

### 5. Publish

Push to GitHub, then **Settings → Pages → Source: Deploy from a branch →
`main` / root**. Live in about a minute.

`.nojekyll` is already in the repo, which stops GitHub from mangling the folder
structure.

---

## Running it: what you do after each sale

Stripe emails you. It takes about two minutes.

1. Open the payment in Stripe. Note the `client_reference_id` (the SPK-ID) and
   the two custom field answers.
2. Go to `yoursite.com/certificate.html?id=THAT_ID`
3. Type the name and the dedication into the toolbar at the top. The certificate
   updates as you type.
4. **Save as PDF** → email it to the buyer.
5. **Copy registry entry** → paste into `data/claimed.json` → commit → push.

That last step flips the page to `CLAIMED`, swaps the headline to the buyer's
name, and gives them a public URL to share. Which is the entire point.

`data/claimed.json` looks like this:

```json
{
  "2099942": {
    "nickname": "The Kevin Doomsday Rock",
    "dedicatedTo": "Kevin M.",
    "claimedOn": "2026-03-14",
    "note": ""
  }
}
```

Delete the example entry that ships in that file before you go live.

> You don't need to re-run `npm run build` after every sale — the site reads
> `claimed.json` live in the browser. Re-run it occasionally so the link
> previews and page titles catch up.

---

## The honesty rules, and why they're not optional

The disclaimers in the footer, in the buy box and on the certificate are load
bearing. Please don't strip them out.

Real minor-planet names are assigned by the **International Astronomical Union's
Working Group for Small Bodies Nomenclature**, and nobody else can do it. If a
buyer comes away believing they bought something official, you have sold a
misrepresented product. In practice that means chargebacks, and payment
processors close accounts over patterns of chargebacks and hold the balance
while they investigate. Star-naming registries have been fighting consumer
protection complaints over exactly this for decades. It is a solved problem and
the solution is to be upfront.

The good news: the honest version is funnier. "A certificate that looks far more
official than it has any right to be" is a better line than pretending. A seal
that reads `NOVELTY · NOT RECOGNISED BY ANY SCIENTIFIC BODY` around the rim is a
better joke than a fake one. Leaning into the bureaucratic absurdity is the
product.

Two specific things to avoid in your marketing:

- ❌ "When NASA tracks it, it'll have their name on it." This is false. NASA
  will not.
- ❌ "Officially registered as…" Drop the word *officially*.

Hooks that work just as well and are true:

- ✅ "I found the asteroid most likely to hit Earth and named it after my ex. $5."
- ✅ "This rock is 340 metres wide, passes closer to us than the Moon, and is now
  legally named nothing, because I made the registry up. It still comes with a
  certificate."
- ✅ "Naming a star costs $50 and is fake. This is $5 and equally fake, but the
  asteroid is real and it's coming towards us."

Self-aware sells better than sincere here. The buyer is in on the joke — that's
what makes it shareable.

---

## Files

```
config.js                  ← the only file you must edit
index.html                 browse and search the registry
asteroid.html              the template for a single rock's page
certificate.html           the printable certificate
css/style.css              the site
css/certificate.css        the certificate, including print layout
js/registry.js             loads the data, formats numbers
js/orbit.js                draws the orbit from real orbital elements
js/browse.js               homepage: search, filters, hero shuffle
js/asteroid.js             single record page
js/certificate.js          certificate rendering and the copy-to-JSON helper
data/asteroids.json        the inventory (generated — don't hand-edit)
data/claimed.json          who bought what (hand-edited, after every sale)
scripts/fetch-asteroids.mjs   NASA → data/asteroids.json
scripts/build-pages.mjs       data → /a/<id>/ + sitemap.xml
a/                         generated pages (commit these)
```

---

## Changing how it looks

Colours are eleven lines at the top of `css/style.css`, under `:root`. Change
`--sheet` and the whole site follows. The theme is a cyanotype blueprint: dark
blue sheet, white linework, ink stamps for the claimed/unclaimed status.

Wording lives in the HTML files and in `mountFooter()` in `js/registry.js`.

---

## Troubleshooting

**"The inventory failed to load"** — you opened `index.html` by double-clicking
it. Browsers block `fetch` on `file://` URLs. Use `npm run serve`.

**`npm run fetch` fails** — check you're online. If JPL reports an unknown
field, the script automatically retries with a smaller, older field list; if
that also fails, JPL is probably down. Try again later.

**Pages 404 on GitHub Pages** — you didn't commit the `a/` folder, or `siteUrl`
in `config.js` doesn't match your real URL. Fix it and run `npm run build`.

**Certificate prints across two pages** — print at 100% scale with margins set
to None, and tick "Background graphics".

**The site feels slow** — you fetched too many asteroids. `npm run fetch --
--limit=1000` and rebuild. The whole JSON file loads on first visit.

---

## Data

Orbital data comes from the [NASA/JPL Small-Body Database Query
API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html), which is open and free.
NASA, JPL and Caltech don't endorse this and aren't affiliated with it. Keep the
attribution in the footer.

---

# Orbit charts (the print side)

`poster.html` is a separate thing from the registry: it turns any asteroid in
your inventory into a print-ready chart you can sell as a poster. It shares the
same `data/asteroids.json`, so there's nothing extra to set up.

## What's on the chart

- **The orbit**, plotted from NASA's real orbital elements for that rock.
- **Equal-time markers** — the asteroid's position every 1/24th of its year.
  They crowd together where it's crawling at its farthest point and spread
  apart where it whips around the Sun. That's Kepler's second law, visible.
  On Phaethon the spacing varies seventeenfold; on Bennu, barely at all.
- **A broken line** where the orbit passes below the plane of Earth's orbit.
- **Context rings** for Earth, Mars and Jupiter, drawn only when they're
  relevant to that rock's orbit.
- **A side view** showing the same orbit edge on, which is the only way to see
  how tilted it is.
- **A dedication line**, optional, set small at the foot of the sheet.

## Making a file to sell

1. Open `poster.html`, pick an asteroid, pick a colourway and size.
2. **Save as PDF.** Print at 100% scale, margins None, background graphics on.
   You get a true vector PDF at the exact physical size — sharp at any scale.
3. Or **Download SVG** if your printer wants vector artwork to work from.

Tick "Add 3 mm bleed" if a print shop asks for it. Most print-on-demand
services don't need it.

## Which rocks make good posters

Eccentricity is what makes a chart interesting to look at. A near-circular
orbit is a boring circle; a stretched one is a striking ellipse with the dots
piling up at one end. Sort by eccentricity and start there.

Reliable picks from the sample data: **Phaethon** (e=0.89, extreme),
**Icarus** (0.83), **Toutatis** (0.63), **Apollo** (0.56). **Apophis**,
**Bennu** and **Ryugu** are rounder but sell on name recognition.

The "Surprise me" button is weighted towards named rocks with eccentric orbits
for exactly this reason.

## Why this is a better business than the naming registry

The naming idea had a structural problem: the disclaimers that keep it honest
only work when the framing is a joke, which rules out every sincere occasion —
and sincere occasions are where gift money actually is.

A print has no such problem. You are selling a real object with real data
printed on it. There is nothing to disclaim, because nothing is being claimed.
The dedication line does the emotional work a gift needs, the same way a
dedication in a book does, without asserting that anyone owns an asteroid.

## Running it as a shop

The lowest-effort version has **no per-order work at all**: make twenty charts
of famous asteroids once, upload them to a print-on-demand service, list them,
and never touch them again. Orders fulfil themselves.

Personalised charts — a dedication, a custom colourway — are the upsell, and
they're the only ones that need you to open the studio and generate a file.
Charge more for them, because they cost you ten minutes.

Before you commit to a price, check the current base cost and shipping for the
size you want on whichever service you pick, then work backwards. Poster base
costs and marketplace fees both move around, so use their live pricing pages
rather than any number you read in a guide. The things to add up: base print
cost, shipping, marketplace listing and transaction fees, and payment
processing. What's left is your margin.

Worth knowing: astronomy and data-visualisation prints are an established
category with real search demand, which the naming registry never had. You can
find buyers without needing a viral moment.
