/**
 * Generates the test fixtures used by the metadata tests.
 *
 * Run with: npm run fixtures
 *
 * These are real encoded files carrying real EXIF, text chunks and density
 * fields, because the whole point of the metadata tests is to prove we can
 * operate on genuine container structures without disturbing the pixels.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'tests', 'fixtures');

/** A photographic-ish image: gradients plus noise, so compression is non-trivial. */
function makePhotoBuffer(width, height) {
  const data = Buffer.alloc(width * height * 3);
  let seed = 12345;
  const rand = () => {
    // Deterministic LCG — fixtures must be byte-stable across runs.
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const noise = rand() * 30 - 15;
      data[i] = Math.max(0, Math.min(255, (x / width) * 200 + 30 + noise));
      data[i + 1] = Math.max(0, Math.min(255, (y / height) * 180 + 40 + noise));
      data[i + 2] = Math.max(
        0,
        Math.min(255, 140 + Math.sin((x / width) * Math.PI * 3) * 60 + noise),
      );
    }
  }
  return { data, info: { width, height, channels: 3 } };
}

/** A flat graphic with hard edges and an alpha channel — the PNG use case. */
function makeGraphicBuffer(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inCircle = (x - width / 2) ** 2 + (y - height / 2) ** 2 < (width / 3) ** 2;
      const inBar = y > height * 0.7 && y < height * 0.85;
      if (inCircle) {
        data[i] = 15; data[i + 1] = 110; data[i + 2] = 96; data[i + 3] = 255;
      } else if (inBar) {
        data[i] = 240; data[i + 1] = 240; data[i + 2] = 240; data[i + 3] = 255;
      } else {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 0; // transparent
      }
    }
  }
  return { data, info: { width, height, channels: 4 } };
}

await mkdir(outDir, { recursive: true });

const photo = makePhotoBuffer(640, 480);
const graphic = makeGraphicBuffer(400, 400);

const photoInput = () =>
  sharp(photo.data, { raw: { width: 640, height: 480, channels: 3 } });
const graphicInput = () =>
  sharp(graphic.data, { raw: { width: 400, height: 400, channels: 4 } });

/* ── JPEG carrying EXIF, including GPS coordinates ─────────────────────────── */
await writeFile(
  join(outDir, 'photo-with-exif.jpg'),
  await photoInput()
    .jpeg({ quality: 88 })
    .withMetadata({ density: 72 })
    .withExif({
      IFD0: {
        Make: 'FixtureCam',
        Model: 'FX-1',
        Software: 'make-fixtures.mjs',
        XResolution: '72/1',
        YResolution: '72/1',
        ResolutionUnit: '2',
      },
      IFD2: {
        DateTimeOriginal: '2024:03:15 14:22:31',
        LensModel: 'FX 24-70mm f/2.8',
      },
      IFD3: {
        // 51.5074 N, 0.1278 W — central London, to prove GPS survives encoding
        GPSLatitude: '51/1 30/1 2664/100',
        GPSLatitudeRef: 'N',
        GPSLongitude: '0/1 7/1 4008/100',
        GPSLongitudeRef: 'W',
      },
    })
    .toBuffer(),
);

/* ── JPEG with no metadata at all, for the "nothing to remove" path ───────── */
await writeFile(
  join(outDir, 'photo-plain.jpg'),
  await photoInput().jpeg({ quality: 88 }).toBuffer(),
);

/* ── PNG carrying text chunks and a physical density ──────────────────────── */
await writeFile(
  join(outDir, 'graphic-with-meta.png'),
  await graphicInput()
    .png({ compressionLevel: 6 })
    .withMetadata({ density: 72 })
    .toBuffer(),
);

/* ── PNG with transparency, no metadata ──────────────────────────────────── */
await writeFile(
  join(outDir, 'graphic-plain.png'),
  await graphicInput().png({ compressionLevel: 6 }).toBuffer(),
);

/* ── WebP carrying EXIF ──────────────────────────────────────────────────── */
await writeFile(
  join(outDir, 'photo-with-exif.webp'),
  await photoInput()
    .webp({ quality: 82 })
    .withExif({ IFD0: { Make: 'FixtureCam', Model: 'FX-1' } })
    .toBuffer(),
);

/* ── Lossless WebP with alpha ────────────────────────────────────────────── */
await writeFile(
  join(outDir, 'graphic.webp'),
  await graphicInput().webp({ lossless: true }).toBuffer(),
);

/* ── JPEG tagged with EXIF Orientation 6 ─────────────────────────────────────
 * Stored 640x480 LANDSCAPE with a tag saying "rotate 90° clockwise to display".
 * A correct decoder returns 480x640 PORTRAIT. This is exactly how phone cameras
 * store portrait photos, and mishandling it is the single most common bug in
 * online image tools — so it gets a fixture of its own.
 */
await writeFile(
  join(outDir, 'photo-rotated.jpg'),
  await photoInput().jpeg({ quality: 88 }).withMetadata({ orientation: 6 }).toBuffer(),
);

/* ── Smooth gradient: the hard case for colour quantisation ──────────────── */
{
  const w = 300;
  const h = 300;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = Math.round((x / w) * 255);
      data[i + 1] = Math.round((y / h) * 255);
      data[i + 2] = 180;
      // Soft alpha ramp down the right edge, to prove partial transparency
      // survives quantisation rather than snapping to on/off.
      data[i + 3] = x > w * 0.75 ? Math.round(255 * (1 - (x - w * 0.75) / (w * 0.25))) : 255;
    }
  }
  await writeFile(
    join(outDir, 'gradient-alpha.png'),
    await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(),
  );
}

/* ── A PHOTOGRAPH stored as PNG ──────────────────────────────────────────────
 * The case where colour reduction genuinely wins by a wide margin, and the
 * counterpart to gradient-alpha.png where it loses to lossless.
 */
const photoPng = await photoInput().png({ compressionLevel: 6 }).toBuffer();
await writeFile(join(outDir, 'photo.png'), photoPng);

/* ── PNG bytes wearing a .jpg extension ──────────────────────────────────────
 * The homepage dropzone routes on magic bytes, never on the filename or the
 * MIME type the OS reports — both lie constantly. This fixture is the one that
 * can tell the difference: if routing ever regresses to trusting the
 * extension, this file lands on the JPEG compressor instead of the PNG one.
 */
await writeFile(join(outDir, 'mislabelled.jpg'), photoPng);

/* ── Tiny image, for boundary behaviour ──────────────────────────────────── */
await writeFile(
  join(outDir, 'tiny.png'),
  await sharp({
    create: { width: 2, height: 2, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer(),
);

/* ── Real HEIC, via the macOS encoder ────────────────────────────────────────
 * sharp cannot write HEIC (libheif here has no HEVC encoder, which is a patent
 * issue rather than a build one), but macOS ships one. Without this the HEIC
 * converter is the only tool with no automated coverage.
 */
try {
  const { execFileSync } = await import('node:child_process');
  const source = join(outDir, 'photo-with-exif.jpg');
  const target = join(outDir, 'photo.heic');
  execFileSync('sips', ['-s', 'format', 'heic', source, '--out', target], {
    stdio: 'ignore',
  });
  console.log('HEIC fixture created with sips');
} catch {
  console.warn(
    'Could not create the HEIC fixture (sips is macOS-only). ' +
      'HEIC checks will be skipped — test that tool by hand.',
  );
}

console.log(`Fixtures written to ${outDir}`);
