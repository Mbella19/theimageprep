/**
 * DEEP OUTPUT VERIFICATION
 *
 * scripts/verify-browser.mjs checks that each tool *produces* something.
 * This checks that what it produces is *correct*: it drives the real browser,
 * captures the actual downloaded files, and inspects the bytes with sharp and
 * with the site's own container parsers.
 *
 * Run: node scripts/verify-outputs.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { unzipSync } from 'fflate';

import { parseIcoHeader } from '../src/lib/ico.ts';
import { detectFormat } from '../src/lib/sniff.ts';
import { readJpegDpi, parseJpeg, MARKER } from '../src/lib/metadata/jpeg.ts';
import { readPngDpi } from '../src/lib/metadata/png.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'tests', 'fixtures');
const PORT = 4343;
const BASE = `http://localhost:${PORT}`;

/* ── Reporting ───────────────────────────────────────────────────────────── */

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`[${ok ? '  ok  ' : ' FAIL '}] ${name}${detail ? ` — ${detail}` : ''}`);
};

/* ── Server ──────────────────────────────────────────────────────────────── */

const astro = (args) =>
  new Promise((resolve) => {
    const p = spawn('npx', ['astro', ...args], { cwd: root, stdio: 'ignore' });
    p.on('exit', resolve);
    p.on('error', resolve);
  });

async function startServer() {
  await astro(['preview', 'stop']);
  spawn('npx', ['astro', 'preview', '--port', String(PORT)], { cwd: root, stdio: 'ignore' });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(BASE + '/')).ok) return;
    } catch {
      /* waiting */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Preview server did not start');
}

/* ── Browser helpers ─────────────────────────────────────────────────────── */

async function openTool(context, slug, files) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${BASE}/${slug}/`, { waitUntil: 'load' });
  await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 20_000 });
  await page.setInputFiles(
    'input[type=file]',
    (Array.isArray(files) ? files : [files]).map((f) => join(fixtures, f)),
  );
  return { page, errors };
}

/** Clicks a download control and returns the bytes the browser actually saved. */
async function grabDownload(page, selector, timeout = 90_000) {
  const waiter = page.waitForEvent('download', { timeout });
  await page.click(selector);
  const download = await waiter;
  const path = await download.path();
  return { bytes: new Uint8Array(readFileSync(path)), filename: download.suggestedFilename() };
}

const rowDownload = '.result-row__actions button:has-text("Download")';
const footerDownload = '.results__actions button.btn--primary';

/* ── Pixel helpers ───────────────────────────────────────────────────────── */

async function raw(bytes) {
  return sharp(Buffer.from(bytes)).raw().toBuffer({ resolveWithObject: true });
}

async function meta(bytes) {
  return sharp(Buffer.from(bytes)).metadata();
}

async function pixelsIdentical(a, b) {
  const [ra, rb] = await Promise.all([raw(a), raw(b)]);
  return ra.data.length === rb.data.length && ra.data.equals(rb.data);
}

function distinctColors(data, channels) {
  const seen = new Set();
  for (let i = 0; i < data.length; i += channels) {
    seen.add(
      channels === 4
        ? (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]
        : (data[i] << 16) | (data[i + 1] << 8) | data[i + 2],
    );
  }
  return seen.size;
}

/* ══════════════════════════════ SCENARIOS ═══════════════════════════════ */

const scenarios = {
  /* ── The headline claim: phone photos must not come out sideways ───────── */
  async orientation(context) {
    const original = readFileSync(join(fixtures, 'photo-rotated.jpg'));
    const om = await meta(original);
    check(
      'fixture is stored landscape with an orientation tag',
      om.width === 640 && om.height === 480 && om.orientation === 6,
      `${om.width}x${om.height} tag=${om.orientation}`,
    );

    const { page, errors } = await openTool(context, 'compress-jpg', 'photo-rotated.jpg');
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 90_000 });
    const { bytes } = await grabDownload(page, rowDownload);
    const m = await meta(bytes);

    // The rotation must be BAKED INTO THE PIXELS, so the output is portrait...
    check(
      'ORIENTATION: rotated photo comes out upright (480x640)',
      m.width === 480 && m.height === 640,
      `${m.width}x${m.height}`,
    );
    // ...and must not also carry a tag, or viewers would rotate it a second time.
    check(
      'ORIENTATION: output carries no leftover rotation tag',
      !m.orientation || m.orientation === 1,
      `tag=${m.orientation ?? 'none'}`,
    );
    check('orientation: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Compression: real size reduction, valid output, target honoured ───── */
  async compressJpg(context) {
    const original = readFileSync(join(fixtures, 'photo-with-exif.jpg'));
    const { page, errors } = await openTool(context, 'compress-jpg', 'photo-with-exif.jpg');
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 90_000 });

    const { bytes, filename } = await grabDownload(page, rowDownload);
    const m = await meta(bytes);

    check('compress-jpg: output really is a JPEG', detectFormat(bytes) === 'jpeg');
    check('compress-jpg: filename ends .jpg', filename.endsWith('.jpg'), filename);
    check(
      'compress-jpg: dimensions preserved',
      m.width === 640 && m.height === 480,
      `${m.width}x${m.height}`,
    );
    check(
      'compress-jpg: genuinely smaller',
      bytes.length < original.length,
      `${original.length} → ${bytes.length} bytes`,
    );
    check('compress-jpg: no console errors', errors.length === 0, errors[0]);

    /* Target size mode must actually respect the budget. */
    await page.click('button:has-text("By target size")');
    await page.fill('#txt-target-file-size', '20 KB');
    await page.waitForTimeout(2500);
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 90_000 });
    const target = await grabDownload(page, rowDownload);

    check(
      'TARGET SIZE: output is under the 20 KB budget',
      target.bytes.length <= 20 * 1024,
      `${target.bytes.length} bytes (budget ${20 * 1024})`,
    );
    // Under budget is easy if you return garbage; it must also be close to it.
    check(
      'TARGET SIZE: uses the budget rather than over-compressing',
      target.bytes.length > 8 * 1024,
      `${target.bytes.length} bytes`,
    );
    const tm = await meta(target.bytes);
    check(
      'TARGET SIZE: still a valid full-size image',
      tm.width === 640 && tm.height === 480,
      `${tm.width}x${tm.height}`,
    );
    await page.close();
  },

  /* ── PNG: lossless must be bit-exact; lossy must bound the palette ─────── */
  async compressPng(context) {
    const original = readFileSync(join(fixtures, 'gradient-alpha.png'));
    const { page, errors } = await openTool(context, 'compress-png', 'gradient-alpha.png');
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 90_000 });

    const lossless = await grabDownload(page, rowDownload);
    check('compress-png: output really is a PNG', detectFormat(lossless.bytes) === 'png');
    check(
      'LOSSLESS PNG: pixels are byte-identical to the original',
      await pixelsIdentical(original, lossless.bytes),
    );
    check(
      'LOSSLESS PNG: file is not larger',
      lossless.bytes.length <= original.length,
      `${original.length} → ${lossless.bytes.length}`,
    );

    /*
     * On a SMOOTH GRADIENT, colour reduction legitimately loses: dithering turns
     * a compressible gradient into incompressible noise. The invariant that
     * matters is therefore not "smaller" but "never worse than the best option
     * the tool computed" — the user must not be punished for picking the mode
     * that suits their intent rather than their image.
     */
    await page.click('button:has-text("Reduce colours")');
    await page.waitForTimeout(600);
    await page.fill('#slider-colours', '32');
    await page.waitForTimeout(3500);
    const lossy = await grabDownload(page, rowDownload);
    const { data, info } = await raw(lossy.bytes);

    check(
      'QUANTISE (gradient): never worse than plain lossless optimisation',
      lossy.bytes.length <= lossless.bytes.length,
      `lossless ${lossless.bytes.length} vs colour-reduce mode ${lossy.bytes.length}`,
    );
    check('QUANTISE: alpha channel retained', info.channels === 4, `${info.channels} channels`);

    // Soft edges must stay soft rather than snapping to fully on/off.
    if (info.channels === 4) {
      let partial = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 8 && data[i] < 247) partial++;
      }
      check(
        'QUANTISE: partial transparency preserved (soft edges survive)',
        partial > 100,
        `${partial} semi-transparent pixels`,
      );
    }
    check('compress-png: no console errors', errors.length === 0, errors[0]);
    await page.close();

    /*
     * On a PHOTOGRAPH stored as PNG, colour reduction is the whole point and
     * must actually apply — palette bounded, file dramatically smaller.
     */
    const photoPage = await openTool(context, 'compress-png', 'photo.png');
    await photoPage.page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 90_000 });
    const photoLossless = await grabDownload(photoPage.page, rowDownload);

    await photoPage.page.click('button:has-text("Reduce colours")');
    await photoPage.page.waitForTimeout(600);
    await photoPage.page.fill('#slider-colours', '32');
    await photoPage.page.waitForTimeout(4000);
    const photoLossy = await grabDownload(photoPage.page, rowDownload);
    const photoRaw = await raw(photoLossy.bytes);

    check(
      'QUANTISE (photo): palette respects the 32-colour limit',
      distinctColors(photoRaw.data, photoRaw.info.channels) <= 32,
      `${distinctColors(photoRaw.data, photoRaw.info.channels)} colours`,
    );
    check(
      'QUANTISE (photo): substantially smaller than lossless',
      photoLossy.bytes.length < photoLossless.bytes.length * 0.5,
      `${photoLossless.bytes.length} → ${photoLossy.bytes.length}`,
    );
    check('compress-png photo: no console errors', photoPage.errors.length === 0, photoPage.errors[0]);
    await photoPage.page.close();
  },

  /* ── PNG to JPG: alpha must be flattened onto the chosen colour ────────── */
  async pngToJpg(context) {
    const { page, errors } = await openTool(context, 'png-to-jpg', 'graphic-plain.png');
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 90_000 });
    const { bytes } = await grabDownload(page, rowDownload);

    const { data, info } = await raw(bytes);
    check('png-to-jpg: output really is a JPEG', detectFormat(bytes) === 'jpeg');
    check(
      'png-to-jpg: alpha channel removed (JPEG cannot store it)',
      info.channels === 3,
      `${info.channels} channels`,
    );
    check(
      'png-to-jpg: dimensions preserved',
      info.width === 400 && info.height === 400,
      `${info.width}x${info.height}`,
    );
    // The fixture's corners are fully transparent; they must become white.
    const [r, g, b] = [data[0], data[1], data[2]];
    check(
      'FLATTEN: transparent corner became the white background',
      r > 245 && g > 245 && b > 245,
      `corner rgb(${r},${g},${b})`,
    );
    check('png-to-jpg: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── HEIC: the tool that had no automated coverage until now ───────────── */
  async heic(context) {
    if (!existsSync(join(fixtures, 'photo.heic'))) {
      check('HEIC: fixture available', false, 'photo.heic missing — run npm run fixtures on macOS');
      return;
    }
    const { page, errors } = await openTool(context, 'heic-to-jpg', 'photo.heic');
    // First use downloads a ~3 MB decoder, so this one gets a long leash.
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 180_000 });
    const { bytes, filename } = await grabDownload(page, rowDownload);
    const m = await meta(bytes);

    check('HEIC: real .heic file decoded and converted', detectFormat(bytes) === 'jpeg');
    check('HEIC: filename ends .jpg', filename.endsWith('.jpg'), filename);
    check(
      'HEIC: dimensions preserved',
      m.width === 640 && m.height === 480,
      `${m.width}x${m.height}`,
    );
    check(
      'HEIC: camera and GPS metadata not carried across',
      !m.exif,
      m.exif ? 'EXIF present — the page claims it is not' : '',
    );
    check('heic: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Resize: every fit mode must produce EXACT dimensions ──────────────── */
  async resize(context) {
    const { page, errors } = await openTool(context, 'resize-image', 'photo-plain.jpg');
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 90_000 });

    // "Keep proportions" is on by default, which is correct behaviour — it
    // makes width and height dependent. Turn it off to request a shape that
    // deliberately does not match the source, which is what exercises fit mode.
    await page.uncheck('label.checkbox-row:has-text("Keep proportions") input');
    await page.waitForTimeout(400);

    for (const [label, mode] of [
      ['fill', 'Fill and crop the overflow'],
      ['fit', 'Fit inside, leaving space'],
      ['stretch', 'Stretch to fit exactly'],
    ]) {
      await page.selectOption('#sel-if-the-shape-does-not-match', { label: mode });
      await page.fill('#num-width', '500');
      await page.fill('#num-height', '500');
      // Changing settings is debounced 250ms before the worker re-encodes.
      // Sleep past the debounce so the row has entered the working state, then
      // wait for it to LEAVE that state — however long the encode takes. The
      // previous fixed 2.2s sleep raced the worker on a loaded machine and made
      // this scenario fail intermittently. All three modes produce 500x500, so
      // the dimensions cannot themselves signal that the new run has finished.
      await page.waitForTimeout(700);
      await page.waitForFunction(
        () =>
          !Array.from(document.querySelectorAll('.result-row__meta')).some((el) =>
            el.textContent?.includes('Processing'),
          ),
        undefined,
        { timeout: 90_000 },
      );
      await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 90_000 });
      const { bytes } = await grabDownload(page, rowDownload);
      const m = await meta(bytes);
      check(
        `RESIZE ${label}: output is exactly 500x500`,
        m.width === 500 && m.height === 500,
        `${m.width}x${m.height}`,
      );
    }
    check('resize: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Crop: exact dimensions, and content actually cropped ──────────────── */
  async crop(context) {
    const { page, errors } = await openTool(context, 'crop-image', 'photo-plain.jpg');
    await page.waitForSelector('.cropper canvas', { timeout: 60_000 });
    await page.fill('#num-width', '300');
    await page.fill('#num-height', '200');
    await page.waitForTimeout(2500);
    await page.waitForSelector('.results__summary:has-text("Result:")', { timeout: 90_000 });
    const { bytes } = await grabDownload(page, footerDownload);
    const m = await meta(bytes);
    check(
      'CROP: output is exactly the requested 300x200',
      m.width === 300 && m.height === 200,
      `${m.width}x${m.height}`,
    );
    check('crop: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── EXIF removal: lossless, and the data really is gone ───────────────── */
  async removeExif(context) {
    const original = readFileSync(join(fixtures, 'photo-with-exif.jpg'));
    const before = await meta(original);
    check('exif fixture actually carries EXIF', Boolean(before.exif));

    const { page, errors } = await openTool(context, 'remove-exif-data', 'photo-with-exif.jpg');
    await page.waitForSelector('.meta-table', { timeout: 60_000 });
    const { bytes } = await grabDownload(
      page,
      'button:has-text("Download cleaned image")',
    );

    const after = await meta(bytes);
    check('REMOVE EXIF: EXIF block is gone from the downloaded file', !after.exif);
    check(
      'REMOVE EXIF: file is smaller',
      bytes.length < original.length,
      `${original.length} → ${bytes.length}`,
    );
    check(
      'REMOVE EXIF: pixels are byte-identical (genuinely lossless)',
      await pixelsIdentical(original, bytes),
    );

    // Prove it structurally too: no APP1 segment should remain.
    const parsed = parseJpeg(bytes);
    const app1 = parsed?.segments.filter((s) => s.marker === MARKER.APP1) ?? [];
    check('REMOVE EXIF: no APP1 segment remains in the container', app1.length === 0);
    check('remove-exif: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── DPI: written to BOTH fields, and verified independently ───────────── */
  async dpi(context) {
    const original = readFileSync(join(fixtures, 'photo-with-exif.jpg'));
    const { page, errors } = await openTool(context, 'change-image-dpi', 'photo-with-exif.jpg');
    await page.waitForSelector('[data-testid=dpi-result]', { timeout: 60_000 });
    await page.fill('#num-or-type-a-value', '300');
    await page.waitForTimeout(2000);
    const { bytes } = await grabDownload(page, '.results__actions button.btn--primary');

    // 1. sharp is an independent implementation.
    const m = await meta(bytes);
    check('DPI: sharp reads back 300', m.density === 300, `density=${m.density}`);

    // 2. Our own reader prefers EXIF, so this proves the EXIF path was written —
    //    the exact field most online DPI tools forget.
    const density = readJpegDpi(bytes);
    check(
      'DPI: EXIF resolution tags were updated (the bug most tools have)',
      density.x === 300 && density.source === 'exif',
      `${density.x} from ${density.source}`,
    );
    check('DPI: unit is inches', density.unit === 'inch', density.unit);
    check(
      'DPI: pixels untouched (metadata-only mode is lossless)',
      await pixelsIdentical(original, bytes),
    );
    check('dpi: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Profile picture: a real circular mask with transparent corners ────── */
  async profilePicture(context) {
    const { page, errors } = await openTool(context, 'profile-picture-maker', 'photo-plain.jpg');
    await page.waitForSelector('.cropper canvas', { timeout: 60_000 });
    await page.waitForSelector('.results__summary:has-text("PNG")', { timeout: 90_000 });
    const { bytes } = await grabDownload(page, '.results__actions button.btn--primary');

    const { data, info } = await raw(bytes);
    check('PROFILE: output is a PNG', detectFormat(bytes) === 'png');
    check(
      'PROFILE: exactly 800x800',
      info.width === 800 && info.height === 800,
      `${info.width}x${info.height}`,
    );
    check('PROFILE: has an alpha channel', info.channels === 4, `${info.channels} channels`);

    if (info.channels === 4) {
      const at = (x, y) => data[(y * info.width + x) * 4 + 3];
      const corners = [at(2, 2), at(797, 2), at(2, 797), at(797, 797)];
      const centre = at(400, 400);
      check(
        'CIRCLE MASK: all four corners are transparent',
        corners.every((a) => a === 0),
        `corner alphas ${corners.join(',')}`,
      );
      check('CIRCLE MASK: centre is opaque', centre === 255, `centre alpha ${centre}`);
      // The rim should be anti-aliased, not a hard staircase.
      let edge = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 10 && data[i] < 245) edge++;
      }
      check('CIRCLE MASK: edge is anti-aliased', edge > 200, `${edge} feathered pixels`);
    }
    check('profile-picture: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Watermark: pixels must actually change ────────────────────────────── */
  async watermark(context) {
    const original = readFileSync(join(fixtures, 'photo-plain.jpg'));
    const { page, errors } = await openTool(context, 'add-watermark', 'photo-plain.jpg');
    await page.waitForSelector('.result-row__meta', { timeout: 90_000 });

    // Make the mark large and fully opaque. The fixture is deliberately noisy,
    // so a small translucent watermark is swamped by ordinary JPEG re-encode
    // noise and the placement assertion below cannot distinguish them.
    await page.fill('#slider-size', '18');
    await page.fill('#slider-opacity', '100');
    await page.waitForTimeout(2500);
    await page.waitForSelector('.result-row__meta', { timeout: 90_000 });
    const { bytes } = await grabDownload(page, rowDownload);

    const m = await meta(bytes);
    check(
      'WATERMARK: dimensions preserved',
      m.width === 640 && m.height === 480,
      `${m.width}x${m.height}`,
    );
    check(
      'WATERMARK: pixels actually changed',
      !(await pixelsIdentical(original, bytes)),
    );

    // The default mark is bottom-right, so that region must differ more than
    // the top-left — proving placement works, not merely that something moved.
    const [ro, rw] = await Promise.all([raw(original), raw(bytes)]);
    const diffIn = (x0, y0, x1, y1) => {
      let sum = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * ro.info.width + x) * ro.info.channels;
          sum += Math.abs(ro.data[i] - rw.data[i]);
        }
      }
      return sum;
    };
    const bottomRight = diffIn(400, 380, 630, 470);
    const topLeft = diffIn(10, 10, 240, 100);
    check(
      'WATERMARK: applied to the bottom-right, as configured',
      bottomRight > topLeft * 3,
      `bottom-right diff ${bottomRight} vs top-left ${topLeft}`,
    );
    check('watermark: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Favicon pack: a valid multi-resolution ICO plus correct PNGs ──────── */
  async favicon(context) {
    const { page, errors } = await openTool(context, 'favicon-generator', 'graphic-plain.png');
    await page.waitForSelector('.output-item', { timeout: 90_000 });
    const { bytes, filename } = await grabDownload(
      page,
      'button:has-text("Download favicon pack")',
    );

    check('FAVICON: downloads a ZIP', filename.endsWith('.zip'), filename);
    const files = unzipSync(bytes);
    const names = Object.keys(files);

    for (const expected of [
      'favicon.ico',
      'favicon-16x16.png',
      'favicon-32x32.png',
      'favicon-48x48.png',
      'apple-touch-icon.png',
      'android-chrome-192x192.png',
      'android-chrome-512x512.png',
      'site.webmanifest',
    ]) {
      check(`FAVICON: pack contains ${expected}`, names.includes(expected));
    }

    /* The ICO must be a real multi-resolution icon, not a renamed PNG. */
    const ico = parseIcoHeader(files['favicon.ico']);
    check('FAVICON: favicon.ico has a valid ICO header', ico !== null);
    if (ico) {
      check('FAVICON: ICO holds 3 resolutions', ico.count === 3, `${ico.count} entries`);
      check(
        'FAVICON: ICO contains 16, 32 and 48',
        JSON.stringify(ico.entries.map((e) => e.width)) === '[16,32,48]',
        ico.entries.map((e) => e.width).join(','),
      );
      // Each entry must point at real PNG bytes inside the file.
      const allPng = ico.entries.every((e) => {
        const slice = files['favicon.ico'].slice(e.offset, e.offset + e.length);
        return detectFormat(slice) === 'png';
      });
      check('FAVICON: every ICO entry contains valid PNG data', allPng);
    }

    /* Each PNG must actually be the size its filename claims. */
    for (const [name, expected] of [
      ['favicon-16x16.png', 16],
      ['favicon-32x32.png', 32],
      ['apple-touch-icon.png', 180],
      ['android-chrome-512x512.png', 512],
    ]) {
      if (!files[name]) continue;
      const m = await meta(files[name]);
      check(
        `FAVICON: ${name} is ${expected}x${expected}`,
        m.width === expected && m.height === expected,
        `${m.width}x${m.height}`,
      );
    }

    const manifest = JSON.parse(new TextDecoder().decode(files['site.webmanifest']));
    check('FAVICON: manifest is valid JSON with icons', Array.isArray(manifest.icons));
    check('favicon: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Social sizes: every selected preset at its exact dimensions ───────── */
  async socialSizes(context) {
    const { page, errors } = await openTool(
      context,
      'social-media-image-sizes',
      'photo-plain.jpg',
    );
    await page.waitForSelector('.result-row', { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const { bytes, filename } = await grabDownload(page, '.results__actions button.btn--primary');

    check('SOCIAL: downloads a ZIP', filename.endsWith('.zip'), filename);
    const files = unzipSync(bytes);
    const names = Object.keys(files);
    check('SOCIAL: ZIP holds every selected preset', names.length >= 8, `${names.length} files`);

    // Filenames encode the dimensions; each file must actually match them.
    let mismatches = 0;
    let verified = 0;
    for (const name of names) {
      const dims = name.match(/(\d+)x(\d+)\.(jpg|png)$/);
      if (!dims) continue;
      const m = await meta(files[name]);
      verified++;
      if (m.width !== Number(dims[1]) || m.height !== Number(dims[2])) {
        mismatches++;
        console.log(`      ${name}: expected ${dims[1]}x${dims[2]}, got ${m.width}x${m.height}`);
      }
    }
    check(
      'SOCIAL: every output matches the dimensions in its filename',
      mismatches === 0 && verified > 0,
      `${verified} verified, ${mismatches} wrong`,
    );
    check(
      'SOCIAL: files are foldered by platform',
      names.some((n) => n.includes('/')),
      names[0],
    );
    check('social-sizes: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Batch + ZIP through the shared pipeline ───────────────────────────── */
  async batch(context) {
    const { page, errors } = await openTool(context, 'compress-jpg', [
      'photo-with-exif.jpg',
      'photo-plain.jpg',
      'photo-rotated.jpg',
    ]);
    await page.waitForSelector('.results__footer', { timeout: 120_000 });
    const rows = await page.$$eval('.result-row', (n) => n.length);
    check('BATCH: all three files processed', rows === 3, `${rows} rows`);

    const { bytes, filename } = await grabDownload(page, footerDownload);
    check('BATCH: downloads a ZIP', filename.endsWith('.zip'), filename);
    const files = unzipSync(bytes);
    check('BATCH: ZIP holds all three outputs', Object.keys(files).length === 3, Object.keys(files).join(', '));

    let allJpeg = true;
    for (const name of Object.keys(files)) {
      if (detectFormat(files[name]) !== 'jpeg') allJpeg = false;
    }
    check('BATCH: every file in the ZIP is a valid JPEG', allJpeg);
    check('batch: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },

  /* ── Edge case: a 2x2 image must not crash anything ────────────────────── */
  async tinyImage(context) {
    const { page, errors } = await openTool(context, 'compress-png', 'tiny.png');
    await page.waitForSelector('.result-row', { timeout: 90_000 });
    const failed = await page.$$eval('.result-row__error', (n) => n.map((e) => e.textContent));
    check('EDGE: a 2x2 image processes without error', failed.length === 0, failed[0]);
    check('edge: no console errors', errors.length === 0, errors[0]);
    await page.close();
  },
};

/* ════════════════════════════════ RUN ═══════════════════════════════════ */

console.log(`Starting preview server on ${BASE} …\n`);
await startServer();
const browser = await chromium.launch();

try {
  const context = await browser.newContext({ acceptDownloads: true });
  const only = process.argv.slice(2);
  const names = only.length ? only.filter((n) => scenarios[n]) : Object.keys(scenarios);

  for (const name of names) {
    console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}`);
    try {
      await scenarios[name](context);
    } catch (error) {
      check(`${name}: scenario threw`, false, String(error).split('\n')[0]);
    }
  }
} finally {
  await browser.close();
  await astro(['preview', 'stop']);
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${'═'.repeat(64)}\n${results.length - failed.length}/${results.length} output checks passed` +
    (failed.length ? `, ${failed.length} FAILED` : ''),
);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exit(failed.length ? 1 : 0);
