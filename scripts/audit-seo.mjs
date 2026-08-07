/**
 * POST-BUILD SEO GATE
 *
 * Runs over dist/ after every build and fails the build on anything that would
 * quietly damage search performance. This is the mechanism that keeps page 40
 * as correct as page 1 — SEO problems are invisible in a browser, so without an
 * automated check they accumulate silently for months.
 *
 * Run: node scripts/audit-seo.mjs   (npm run build does it automatically)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('dist/ not found — run `astro build` first.');
  process.exit(1);
}

/* ── Limits ──────────────────────────────────────────────────────────────── */

const TITLE_MAX = 65; // Google truncates around here; 50-60 is the sweet spot
const DESC_MIN = 70;
const DESC_MAX = 160;

const errors = [];
const warnings = [];

const fail = (page, message) => errors.push(`${page}: ${message}`);
const warn = (page, message) => warnings.push(`${page}: ${message}`);

/* ── Collect HTML pages ──────────────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = walk(dist);

/** dist/compress-jpg/index.html -> /compress-jpg/ ; dist/404.html -> /404.html */
function urlPathFor(file) {
  const rel = relative(dist, file).split('\\').join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel;
}

/* ── Tiny HTML helpers (regex is fine for output we generate ourselves) ──── */

const pick = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/* ── Audit each page ─────────────────────────────────────────────────────── */

const titles = new Map();
const descriptions = new Map();
const indexablePaths = [];
const linkTargets = new Map(); // target -> [source pages]
const missingAssets = new Map(); // asset path -> how many pages reference it

for (const file of files) {
  const page = urlPathFor(file);
  const html = readFileSync(file, 'utf8');
  const head = html.slice(0, html.indexOf('</head>') + 7);

  const robots = pick(head, /<meta\s+name="robots"\s+content="([^"]*)"/i) ?? '';
  const noindex = /noindex/i.test(robots);

  /* Title */
  const title = pick(head, /<title>([\s\S]*?)<\/title>/i);
  if (!title) {
    fail(page, 'missing <title>');
  } else {
    const clean = decode(title);
    if (clean.length > TITLE_MAX) {
      fail(page, `title is ${clean.length} chars (max ${TITLE_MAX}): "${clean}"`);
    }
    if (!noindex) {
      const seen = titles.get(clean);
      if (seen) fail(page, `duplicate <title> — also used by ${seen}`);
      else titles.set(clean, page);
    }
  }

  /* Meta description */
  const desc = pick(head, /<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!desc) {
    fail(page, 'missing meta description');
  } else {
    const clean = decode(desc);
    if (clean.length > DESC_MAX) {
      fail(page, `meta description is ${clean.length} chars (max ${DESC_MAX})`);
    } else if (clean.length < DESC_MIN && !noindex) {
      // Length only matters where the page can appear in results.
      warn(page, `meta description is only ${clean.length} chars (aim for ${DESC_MIN}+)`);
    }
    if (!noindex) {
      const seen = descriptions.get(clean);
      if (seen) fail(page, `duplicate meta description — also used by ${seen}`);
      else descriptions.set(clean, page);
    }
  }

  /* Canonical */
  const canonical = pick(head, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
  if (!canonical) {
    fail(page, 'missing canonical link');
  } else {
    if (!/^https?:\/\//.test(canonical)) {
      fail(page, `canonical is not absolute: ${canonical}`);
    } else {
      const canonicalPath = new URL(canonical).pathname;
      if (!noindex && canonicalPath !== page) {
        fail(page, `canonical points at ${canonicalPath}, expected ${page}`);
      }
    }
  }

  /* Exactly one h1 */
  const h1s = html.match(/<h1[\s>]/gi) ?? [];
  if (h1s.length !== 1) fail(page, `found ${h1s.length} <h1> elements, expected exactly 1`);

  /* Open Graph */
  for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (!head.includes(`property="${property}"`)) fail(page, `missing ${property}`);
  }

  /* Structured data must parse */
  for (const match of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      fail(page, `invalid JSON-LD: ${error.message}`);
    }
  }

  /* Language */
  if (!/<html[^>]+lang=/i.test(html)) fail(page, 'missing lang attribute on <html>');

  if (!noindex) indexablePaths.push(page);

  /*
   * Referenced static assets must exist. A missing OG image means every social
   * share of that page renders as a blank card, and a missing favicon is a 404
   * on every single page load — neither is visible while browsing the site.
   */
  const assetRefs = [
    pick(head, /<meta\s+property="og:image"\s+content="([^"]*)"/i),
    ...[...head.matchAll(/<link\s+rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]*)"/gi)].map(
      (m) => m[1],
    ),
  ].filter(Boolean);

  for (const ref of assetRefs) {
    let assetPath = ref;
    if (/^https?:\/\//.test(ref)) {
      assetPath = new URL(ref).pathname;
    } else if (!ref.startsWith('/')) {
      continue;
    }
    if (!existsSync(join(dist, assetPath))) {
      missingAssets.set(assetPath, (missingAssets.get(assetPath) ?? 0) + 1);
    }
  }

  /* Internal links — collect for the broken-link pass */
  for (const match of html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)) {
    const href = match[1];
    if (
      href.startsWith('http') ||
      href.startsWith('mailto:') ||
      href.startsWith('#') ||
      href.startsWith('tel:')
    ) {
      continue;
    }
    const target = href.split('#')[0].split('?')[0];
    if (!target) continue;
    const list = linkTargets.get(target) ?? [];
    list.push(page);
    linkTargets.set(target, list);
  }
}

/* ── Internal links must resolve to a real file ──────────────────────────── */

for (const [target, sources] of linkTargets) {
  const candidates = [
    join(dist, target),
    join(dist, target, 'index.html'),
    join(dist, target.replace(/\/$/, '') + '.html'),
  ];
  if (!candidates.some((c) => existsSync(c))) {
    fail(sources[0], `broken internal link to ${target} (linked from ${sources.length} page(s))`);
  }
}

/* ── Referenced icons and OG images must exist ───────────────────────────── */

for (const [asset, count] of missingAssets) {
  errors.push(`GLOBAL: ${asset} is referenced by ${count} page(s) but does not exist in dist/`);
}

/* ── Sitemap must contain every indexable page ───────────────────────────── */

const sitemapFiles = readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f));
if (sitemapFiles.length === 0) {
  errors.push('GLOBAL: no sitemap was generated — is `site` set in astro.config.mjs?');
} else {
  const sitemapXml = sitemapFiles
    .map((f) => readFileSync(join(dist, f), 'utf8'))
    .join('\n');

  for (const page of indexablePaths) {
    if (page.endsWith('.html')) continue; // 404 and friends
    if (!sitemapXml.includes(`${page}<`) && !sitemapXml.includes(`${page}</loc>`)) {
      fail(page, 'indexable page is missing from the sitemap');
    }
  }

  // Nothing noindexed should be advertised in the sitemap.
  if (sitemapXml.includes('/404')) {
    errors.push('GLOBAL: sitemap contains the 404 page');
  }
}

/* ── robots.txt ──────────────────────────────────────────────────────────── */

const robotsPath = join(dist, 'robots.txt');
if (!existsSync(robotsPath)) {
  errors.push('GLOBAL: robots.txt is missing');
} else {
  const robots = readFileSync(robotsPath, 'utf8');
  if (!/^Sitemap:\s*https?:\/\/\S+/m.test(robots)) {
    errors.push('GLOBAL: robots.txt has no absolute Sitemap: line');
  }
  if (/^Disallow:\s*\/\s*$/m.test(robots)) {
    errors.push('GLOBAL: robots.txt disallows the entire site');
  }
}

/* ── 404 must exist at the root for Cloudflare Pages ─────────────────────── */

if (!existsSync(join(dist, '404.html'))) {
  errors.push('GLOBAL: dist/404.html is missing — Cloudflare Pages needs it at the root');
}

/* ── Report ──────────────────────────────────────────────────────────────── */

console.log(`\nSEO audit — ${files.length} pages, ${indexablePaths.length} indexable\n`);

if (warnings.length) {
  console.log(`${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ~ ${w}`);
  console.log('');
}

if (errors.length) {
  console.error(`${errors.length} error(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('\nSEO audit FAILED\n');
  process.exit(1);
}

console.log('SEO audit passed — titles unique, canonicals correct, no broken internal links.\n');
