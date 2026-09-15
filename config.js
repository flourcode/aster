/* ==========================================================================
   CONFIG — this is the only file you need to edit to launch.
   Everything here is plain text. Change the values between the quote marks.
   ========================================================================== */

const SITE_CONFIG = {

  /* --- Your site ------------------------------------------------------- */

  // What the registry is called. Shows in the header and on certificates.
  siteName: "Adopt an Asteroid",

  // The bureaucratic-sounding subtitle. This is part of the joke.
  officeName: "Orbital Registry Office",

  // Your live URL, no trailing slash. Used for share links and sitemap.xml.
  // GitHub Pages project site: "https://yourname.github.io/asteroid-registry"
  // Custom domain:             "https://adoptanasteroid.com"
  siteUrl: "https://flourcode.github.io/aster",

  // Where people email you. Shown in the footer.
  contactEmail: "hello@example.com",


  /* --- Money ----------------------------------------------------------- */

  // Displayed price. Just text — the real price lives in Stripe.
  price: "$5",

  // Your Stripe Payment Link. Create one at dashboard.stripe.com/payment-links
  // Leave as "" while testing; the button will explain it isn't wired up yet.
  // See README section 4 for the two custom fields you must add to the link.
  stripePaymentLink: "",


  /* --- Behaviour ------------------------------------------------------- */

  // How many asteroids to show before the "Load more" button.
  pageSize: 60,

  // Show the "sample data" warning banner until you run the fetch script.
  // The fetch script sets this automatically — you can ignore it.
  showSampleBanner: true
};

/* Don't edit below this line. This makes the config work in both the
   browser and the Node build scripts. */
if (typeof window !== "undefined") window.SITE_CONFIG = SITE_CONFIG;
if (typeof module !== "undefined") module.exports = SITE_CONFIG;
