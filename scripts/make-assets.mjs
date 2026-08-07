/**
 * Generates the static brand assets into public/: favicons, app icons, and a
 * unique Open Graph card for every tool, category and guide.
 *
 * Run once, and again whenever the brand name, accent colour or tool list
 * changes:  npm run assets
 *
 * The favicon.ico is written with the site's OWN ICO writer (src/lib/ico.ts) —
 * the same code path the favicon generator ships to visitors. If it can build
 * this site's icon, it works.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildIco } from '../src/lib/ico.ts';
import { SITE } from '../src/config.ts';
import { TOOLS, CATEGORIES } from '../src/data/tools.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const ogDir = join(publicDir, 'og');

/* Must track the tokens in src/styles/global.css. These are baked into the
   favicon and the Open Graph cards, so a palette change here needs
   `npm run assets` to actually reach the pixels. */
const ACCENT = '#16171a';
const INK = '#16171a';
const PAPER = '#f2f0ec';
const MUTED = '#8d8a84';

await mkdir(ogDir, { recursive: true });

/* ══════════════════════════════ BRAND MARK ═══════════════════════════════ */

/**
 * The same mark as .brand__mark in the header: a solid square with a notch
 * bitten out of the bottom-right corner — a crop handle, reduced until it
 * still reads at 16 pixels.
 *
 * Solid rather than a stroked outline on purpose. The previous mark was a
 * 1.8px-stroke line drawing, which at favicon size collapses into grey mush;
 * a filled shape keeps its silhouette all the way down.
 */
function markSvg(size, color = ACCENT, background = null) {
  const bg = background
    ? `<rect width="24" height="24" fill="${background}"/>`
    : '';
  // The notch is punched with an even-odd fill rather than a second shape in
  // the background colour, so the icon stays correct on any backdrop.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  ${bg}
  <path fill="${color}" fill-rule="evenodd" d="M5 2.5h14a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 19V5A2.5 2.5 0 0 1 5 2.5Zm8.6 18.9h5.4a2.4 2.4 0 0 0 2.4-2.4v-5.4a2 2 0 0 0-2-2h-3.8a2 2 0 0 0-2 2v5.8Z"/>
</svg>`;
}

const pngFromSvg = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/* ── Favicon SVG (scales to any size, adapts to dark mode) ────────────────── */

await writeFile(
  join(publicDir, 'favicon.svg'),
  // Ink on light, and light on dark. The mark inverts for a dark browser
  // chrome so it never disappears into a dark tab strip — the SITE is
  // light-only, but a favicon has to survive whatever UI surrounds it.
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <style>
    .mark { fill: ${INK}; }
    @media (prefers-color-scheme: dark) { .mark { fill: #f2f0ec; } }
  </style>
  <path class="mark" fill-rule="evenodd" d="M5 2.5h14a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 19V5A2.5 2.5 0 0 1 5 2.5Zm8.6 18.9h5.4a2.4 2.4 0 0 0 2.4-2.4v-5.4a2 2 0 0 0-2-2h-3.8a2 2 0 0 0-2 2v5.8Z"/>
</svg>`,
);

/* ── PNG icon set ────────────────────────────────────────────────────────── */

const iconSpecs = [
  { size: 16, file: 'favicon-16x16.png', bg: null },
  { size: 32, file: 'favicon-32x32.png', bg: null },
  { size: 48, file: 'favicon-48x48.png', bg: null },
  // Apple and Android icons are composited onto solid colour: iOS gives
  // transparent icons a black background, which looks broken.
  { size: 180, file: 'apple-touch-icon.png', bg: PAPER },
  { size: 192, file: 'android-chrome-192x192.png', bg: PAPER },
  { size: 512, file: 'android-chrome-512x512.png', bg: PAPER },
];

const icoSources = [];

for (const spec of iconSpecs) {
  const png = await pngFromSvg(markSvg(spec.size, ACCENT, spec.bg), spec.size);
  await writeFile(join(publicDir, spec.file), png);
  if ([16, 32, 48].includes(spec.size)) icoSources.push({ size: spec.size, png });
}

/* ── favicon.ico, built with the site's own writer ───────────────────────── */

await writeFile(join(publicDir, 'favicon.ico'), Buffer.from(buildIco(icoSources)));

/* ═════════════════════════════ OPEN GRAPH ════════════════════════════════ */

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Naive width-based wrapping — good enough for two or three short lines. */
function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line.trim());
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';

function ogSvg(heading, kicker) {
  const lines = wrap(heading, 24).slice(0, 3);
  // Anchor the LAST line to a fixed baseline and grow upward, so a one-line
  // heading and a three-line heading are both balanced against the footer
  // rather than one of them floating in the middle of the card.
  const lastBaseline = 430;
  const startY = lastBaseline - (lines.length - 1) * 78;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <rect x="0" y="0" width="1200" height="10" fill="${ACCENT}"/>

  <g transform="translate(80, 74) scale(2.1)">
    <g fill="none" stroke="${ACCENT}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="6.5" width="12" height="12" rx="2.5"/>
      <path d="M9.5 6.5V5A2.5 2.5 0 0 1 12 2.5h6.5a3 3 0 0 1 3 3V12a2.5 2.5 0 0 1-2.5 2.5h-1.5"/>
      <path d="M2.5 14.5l3.2-3.2a2 2 0 0 1 2.8 0l5.5 5.5"/>
    </g>
    <circle cx="10.4" cy="10.4" r="1.3" fill="${ACCENT}"/>
  </g>
  <text x="140" y="108" font-family="${FONT}" font-size="30" font-weight="700" fill="${INK}">${escapeXml(
    SITE.name,
  )}</text>

  <text x="80" y="188" font-family="${FONT}" font-size="21" font-weight="600"
        letter-spacing="2.4" fill="${ACCENT}">${escapeXml(kicker.toUpperCase())}</text>

  ${lines
    .map(
      (line, i) =>
        `<text x="80" y="${startY + i * 78}" font-family="${FONT}" font-size="66" font-weight="700" fill="${INK}">${escapeXml(
          line,
        )}</text>`,
    )
    .join('\n  ')}

  <text x="80" y="556" font-family="${FONT}" font-size="26" fill="${MUTED}">Runs in your browser. Nothing is uploaded.</text>
</svg>`;
}

async function writeOg(name, heading, kicker) {
  const png = await sharp(Buffer.from(ogSvg(heading, kicker)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(ogDir, `${name}.png`), png);
}

await writeOg('default', 'Image tools that never upload your files', SITE.tagline);

for (const tool of TOOLS) {
  await writeOg(tool.slug, tool.h1, 'Free image tool');
}

for (const category of CATEGORIES) {
  await writeOg(category.slug, category.h1, 'Image tools');
}

console.log(
  `Assets written: ${iconSpecs.length} icons + favicon.ico + favicon.svg, ` +
    `${TOOLS.length + CATEGORIES.length + 1} Open Graph cards`,
);
