/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SITE CONFIGURATION — this is the only file you need to edit to rebrand.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Everything downstream follows `name` and `url`: page titles, canonical
 *  URLs, sitemap, robots.txt, Open Graph tags, structured data, nav, footer
 *  and legal pages.
 *
 *  `url` must be the ONE canonical origin — apex or www, never both, or every
 *  page ends up reachable at two addresses that compete with each other.
 *  Cloudflare Pages redirects the other form; see docs/deploy.md.
 *
 *  After changing `name`, run `npm run assets` to redraw the favicons and
 *  Open Graph cards, which have the brand name baked into the pixels.
 */

export const SITE = {
  /** Brand name. Appears in the nav, footer, titles and structured data. */
  name: 'The Image Prep',

  /** Home-screen label when installed as a PWA. Android truncates past ~12. */
  shortName: 'Image Prep',

  /** Absolute origin, no trailing slash. Drives canonicals, sitemap, robots. */
  url: 'https://theimageprep.com',

  /** Short positioning line. Used in the header and Organization schema. */
  tagline: 'Image tools for creators and online sellers',

  /** Homepage meta description. Keep under 155 characters. */
  description:
    'Free image tools that run entirely in your browser. Compress, convert, resize, crop and clean up photos for Etsy, Amazon, YouTube and Instagram.',

  /** Public contact address. Shown on /contact/ and required for AdSense. */
  email: 'hello@theimageprep.com',

  locale: 'en',
  language: 'en-GB',

  /**
   * AdSense stays OFF until the site has content and has been approved.
   * Flip `enabled` to true and paste your publisher ID to switch every ad
   * slot on at once. See docs/adsense-setup.md.
   */
  adsense: {
    enabled: false,
    /** e.g. 'ca-pub-1234567890123456' */
    client: '',
    /** Per-placement slot IDs, created in the AdSense dashboard. */
    slots: {
      inArticle: '',
      belowContent: '',
      footer: '',
    },
  },

  /** Site verification tokens. Leave blank to omit the meta tags entirely. */
  verification: {
    /** Google Search Console → HTML tag method → the content="..." value */
    google: '',
    /** Bing Webmaster Tools → HTML meta tag */
    bing: '',
  },

  /** Optional privacy-friendly analytics. Leave blank to ship no analytics. */
  analytics: {
    /** Plausible domain, e.g. 'theimageprep.com'. Blank = disabled. */
    plausibleDomain: '',
  },
} as const;

/** Absolute URL helper. Always returns a trailing slash except for files. */
export function absoluteUrl(path = '/'): string {
  const base = SITE.url.replace(/\/+$/, '');
  if (!path.startsWith('/')) path = '/' + path;
  const isFile = /\.[a-z0-9]{2,5}$/i.test(path);
  if (!isFile && !path.endsWith('/')) path += '/';
  return base + path;
}
