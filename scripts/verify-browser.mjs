/**
 * End-to-end browser verification.
 *
 * A green `astro build` proves nothing about whether the tools WORK: the
 * workers, the WebAssembly codecs, Preact hydration and the canvas APIs only
 * exist in a real browser. This drives an actual Chromium against the built
 * site, feeds real image files through each tool, and checks the output.
 *
 * Usage:  node scripts/verify-browser.mjs [tool-slug ...]
 *         (no arguments = run every check)
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'tests', 'fixtures');
const PORT = 4329;
const BASE = `http://localhost:${PORT}`;

/* ── Server ──────────────────────────────────────────────────────────────── */

function runAstro(args) {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['astro', ...args], { cwd: root, stdio: 'ignore' });
    proc.on('exit', resolve);
    proc.on('error', resolve);
  });
}

/**
 * Astro 7 runs `preview` as a DETACHED DAEMON, so spawning it and later calling
 * .kill() on the returned child does nothing — the server survives, holds the
 * port, and every subsequent run silently reuses it. Stop any existing daemon
 * first, and stop it again properly at the end.
 */
async function startServer() {
  await runAstro(['preview', 'stop']);

  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + '/');
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  await runAstro(['preview', 'stop']);
  throw new Error('Preview server did not start in time');
}

const stopServer = () => runAstro(['preview', 'stop']);

/* ── Assertions ──────────────────────────────────────────────────────────── */

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? '  ok  ' : ' FAIL ';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

/* ── Checks ──────────────────────────────────────────────────────────────── */

/**
 * Drives a tool page: upload files, wait for a finished result row, and hand
 * back what the UI is reporting.
 */
async function runTool(page, slug, files, { waitFor = 'download', timeout = 60_000 } = {}) {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(`${BASE}/${slug}/`, { waitUntil: 'domcontentloaded' });

  // Hydration must have happened for the input to exist.
  await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
  await page.setInputFiles(
    'input[type=file]',
    files.map((f) => join(fixtures, f)),
  );

  if (waitFor === 'download') {
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout });
  } else {
    await page.waitForSelector(waitFor, { timeout });
  }

  const rows = await page.$$eval('.result-row', (nodes) =>
    nodes.map((n) => ({
      name: n.querySelector('.result-row__name')?.textContent ?? '',
      meta: n.querySelector('.result-row__meta')?.textContent ?? '',
      error: n.querySelector('.result-row__error')?.textContent ?? '',
    })),
  );

  return { rows, consoleErrors };
}

/** Parses "91.6 KB → 40.6 KB · 640 x 480 · quality 80" */
function parseMeta(meta) {
  const sizes = meta.match(/([\d.]+)\s*(B|KB|MB)/g) ?? [];
  const toBytes = (s) => {
    const [, n, u] = s.match(/([\d.]+)\s*(B|KB|MB)/);
    const mult = u === 'MB' ? 1024 * 1024 : u === 'KB' ? 1024 : 1;
    return parseFloat(n) * mult;
  };
  const dims = meta.match(/([\d,]+)\s*x\s*([\d,]+)/);
  return {
    before: sizes[0] ? toBytes(sizes[0]) : null,
    after: sizes[1] ? toBytes(sizes[1]) : null,
    width: dims ? Number(dims[1].replace(/,/g, '')) : null,
    height: dims ? Number(dims[2].replace(/,/g, '')) : null,
  };
}

const CHECKS = {
  'compress-jpg': async (page) => {
    const { rows, consoleErrors } = await runTool(page, 'compress-jpg', ['photo-with-exif.jpg']);
    record('compress-jpg: no console errors', consoleErrors.length === 0, consoleErrors[0]);
    record('compress-jpg: produced a result', rows.length === 1 && !rows[0].error, rows[0]?.error);

    const meta = parseMeta(rows[0]?.meta ?? '');
    record(
      'compress-jpg: file got smaller',
      meta.after !== null && meta.before !== null && meta.after < meta.before,
      rows[0]?.meta,
    );
    record(
      'compress-jpg: dimensions preserved (640x480)',
      meta.width === 640 && meta.height === 480,
      `${meta.width}x${meta.height}`,
    );
    record(
      'compress-jpg: output named .jpg',
      (rows[0]?.name ?? '').endsWith('.jpg'),
      rows[0]?.name,
    );
  },

  'compress-png': async (page) => {
    const { rows, consoleErrors } = await runTool(page, 'compress-png', ['graphic-with-meta.png']);
    record('compress-png: no console errors', consoleErrors.length === 0, consoleErrors[0]);
    record('compress-png: produced a result', rows.length === 1 && !rows[0].error, rows[0]?.error);
    const meta = parseMeta(rows[0]?.meta ?? '');
    record(
      'compress-png: lossless mode did not grow the file',
      meta.after !== null && meta.before !== null && meta.after <= meta.before,
      rows[0]?.meta,
    );
  },

  'png-to-jpg': async (page) => {
    const { rows, consoleErrors } = await runTool(page, 'png-to-jpg', ['graphic-plain.png']);
    record('png-to-jpg: no console errors', consoleErrors.length === 0, consoleErrors[0]);
    record(
      'png-to-jpg: output named .jpg',
      (rows[0]?.name ?? '').endsWith('.jpg'),
      rows[0]?.name,
    );
    const meta = parseMeta(rows[0]?.meta ?? '');
    record(
      'png-to-jpg: dimensions preserved (400x400)',
      meta.width === 400 && meta.height === 400,
      `${meta.width}x${meta.height}`,
    );
  },

  'jpg-to-webp': async (page) => {
    const { rows, consoleErrors } = await runTool(page, 'jpg-to-webp', ['photo-plain.jpg']);
    record('jpg-to-webp: no console errors', consoleErrors.length === 0, consoleErrors[0]);
    record(
      'jpg-to-webp: output named .webp',
      (rows[0]?.name ?? '').endsWith('.webp'),
      rows[0]?.name,
    );
  },

  'resize-image': async (page) => {
    await page.goto(`${BASE}/resize-image/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
    await page.setInputFiles('input[type=file]', join(fixtures, 'photo-plain.jpg'));
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 60_000 });

    // Ask for an exact size and confirm we get exactly that.
    const widthInput = page.locator('#num-width');
    await widthInput.fill('320');
    await page.waitForTimeout(1200);
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 60_000 });

    const meta = await page.$eval('.result-row__meta', (n) => n.textContent ?? '');
    const parsed = parseMeta(meta);
    record('resize-image: width honoured exactly', parsed.width === 320, meta);
  },

  'remove-exif-data': async (page) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    await page.goto(`${BASE}/remove-exif-data/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
    await page.setInputFiles('input[type=file]', join(fixtures, 'photo-with-exif.jpg'));

    // The point of this tool is showing what is in the file BEFORE removal.
    await page.waitForSelector('.meta-table', { timeout: 30_000 });
    const tableText = await page.$eval('.meta-table', (n) => n.textContent ?? '');
    record('remove-exif-data: shows camera make', /FixtureCam/i.test(tableText), tableText.slice(0, 120));
    record('remove-exif-data: surfaces GPS', /GPS/i.test(tableText));
    record('remove-exif-data: no page errors', consoleErrors.length === 0, consoleErrors[0]);
  },

  'change-image-dpi': async (page) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    await page.goto(`${BASE}/change-image-dpi/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
    await page.setInputFiles('input[type=file]', join(fixtures, 'photo-with-exif.jpg'));
    await page.waitForSelector('[data-testid=dpi-result]', { timeout: 30_000 });
    const text = await page.$eval('[data-testid=dpi-result]', (n) => n.textContent ?? '');
    record('change-image-dpi: reports a print size', /inch|cm/i.test(text), text.slice(0, 140));
    record('change-image-dpi: no page errors', consoleErrors.length === 0, consoleErrors[0]);
  },

  'compress-webp': async (page) => {
    const { rows, consoleErrors } = await runTool(page, 'compress-webp', ['photo-with-exif.webp']);
    record('compress-webp: no console errors', consoleErrors.length === 0, consoleErrors[0]);
    record(
      'compress-webp: output named .webp',
      (rows[0]?.name ?? '').endsWith('.webp'),
      rows[0]?.name,
    );
  },

  'crop-image': async (page) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    await page.goto(`${BASE}/crop-image/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
    await page.setInputFiles('input[type=file]', join(fixtures, 'photo-plain.jpg'));

    try {
      await page.waitForSelector('.cropper canvas', { timeout: 25_000 });
    } catch {
      // Report WHY rather than just that it timed out.
      record('crop-image: cropper canvas rendered', false, consoleErrors[0] ?? 'no error captured');
      return;
    }
    await page.waitForSelector('.results__summary:has-text("Result:")', { timeout: 45_000 });

    const summary = await page.$eval('.results__summary', (n) => n.textContent ?? '');
    // Source is 640x480; the default square crop should be exactly 480x480.
    record('crop-image: exact square output', /480 x 480/.test(summary), summary.trim());
    record('crop-image: no page errors', consoleErrors.length === 0, consoleErrors[0]);
  },

  'profile-picture-maker': async (page) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    await page.goto(`${BASE}/profile-picture-maker/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
    await page.setInputFiles('input[type=file]', join(fixtures, 'photo-plain.jpg'));
    await page.waitForSelector('.cropper canvas', { timeout: 30_000 });
    await page.waitForSelector('.results__summary:has-text("PNG")', { timeout: 45_000 });

    const summary = await page.$eval('.results__summary', (n) => n.textContent ?? '');
    record('profile-picture: 800x800 PNG produced', /800 x 800/.test(summary), summary.trim());
    record('profile-picture: no page errors', consoleErrors.length === 0, consoleErrors[0]);
  },

  'add-watermark': async (page) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    await page.goto(`${BASE}/add-watermark/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
    await page.setInputFiles('input[type=file]', join(fixtures, 'photo-plain.jpg'));
    await page.waitForSelector('.result-row__meta', { timeout: 45_000 });

    const meta = await page.$eval('.result-row__meta', (n) => n.textContent ?? '');
    record('add-watermark: produced an image', /\d/.test(meta), meta.trim());
    record('add-watermark: no page errors', consoleErrors.length === 0, consoleErrors[0]);
  },

  'social-media-image-sizes': async (page) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    await page.goto(`${BASE}/social-media-image-sizes/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
    await page.setInputFiles('input[type=file]:not([readonly])', join(fixtures, 'photo-plain.jpg'));
    await page.waitForSelector('.result-row', { timeout: 90_000 });

    // Several presets are selected by default, so several outputs must appear.
    const count = await page.$$eval('.result-row', (n) => n.length);
    record('social-sizes: generated multiple sizes at once', count >= 5, `${count} outputs`);
    record('social-sizes: no page errors', consoleErrors.length === 0, consoleErrors[0]);
  },

  'favicon-generator': async (page) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    await page.goto(`${BASE}/favicon-generator/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 15_000 });
    await page.setInputFiles('input[type=file]', join(fixtures, 'graphic-plain.png'));
    await page.waitForSelector('.output-item', { timeout: 45_000 });
    const count = await page.$$eval('.output-item', (n) => n.length);
    record('favicon-generator: generated the full icon set', count >= 7, `${count} files`);
    record('favicon-generator: no page errors', consoleErrors.length === 0, consoleErrors[0]);
  },
};

/* ── Static page checks (no JS needed) ───────────────────────────────────── */

async function checkStatic(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const h1Count = await page.$$eval('h1', (n) => n.length);
  record('homepage: exactly one h1', h1Count === 1, `${h1Count}`);

  // Navigation must work without JavaScript for crawlers to follow it.
  const navLinks = await page.$$eval('.site-header a[href]', (n) => n.length);
  record('homepage: header links are real anchors', navLinks >= 5, `${navLinks} links`);
}

/* ── Main ────────────────────────────────────────────────────────────────── */

const requested = process.argv.slice(2);
const toRun = requested.length
  ? requested.filter((s) => CHECKS[s])
  : Object.keys(CHECKS);

console.log(`Starting preview server on ${BASE} …`);
await startServer();
const browser = await chromium.launch();

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await checkStatic(page);

  for (const slug of toRun) {
    if (!existsSync(join(root, 'dist', slug, 'index.html'))) {
      record(`${slug}: page exists`, false, 'not built yet');
      continue;
    }
    const fresh = await context.newPage();
    try {
      await CHECKS[slug](fresh);
    } catch (error) {
      record(`${slug}: check threw`, false, String(error).split('\n')[0]);
    } finally {
      await fresh.close();
    }
  }
} finally {
  await browser.close();
  await stopServer();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed` +
    (failed.length ? `, ${failed.length} FAILED` : ''),
);
process.exit(failed.length ? 1 : 0);
