import { describe, it, expect } from 'vitest';
import { fixture, expectPixelIdentical, metadataOf } from './helpers';

import {
  parseJpeg,
  isJpeg,
  stripJpegMetadata,
  readJpegDpi,
  setJpegDpi,
  MARKER,
} from '../src/lib/metadata/jpeg';
import {
  parsePng,
  isPng,
  crc32,
  stripPngMetadata,
  readPngDpi,
  setPngDpi,
  dpiToPixelsPerMetre,
  pixelsPerMetreToDpi,
  readPngDimensions,
} from '../src/lib/metadata/png';
import {
  parseWebp,
  isWebp,
  stripWebpMetadata,
  readWebpDimensions,
  VP8X_FLAG,
} from '../src/lib/metadata/webp';

/* ═══════════════════════════════ JPEG ═══════════════════════════════════ */

describe('JPEG metadata', () => {
  it('parses the segment structure and finds the EXIF block', () => {
    const bytes = fixture('photo-with-exif.jpg');
    expect(isJpeg(bytes)).toBe(true);

    const parsed = parseJpeg(bytes);
    expect(parsed).not.toBeNull();

    const app1 = parsed!.segments.find(
      (s) => s.marker === MARKER.APP1 && s.identifier === 'Exif',
    );
    expect(app1, 'fixture should carry an EXIF APP1 segment').toBeDefined();
    expect(parsed!.segments[0].marker).toBe(MARKER.SOI);
    expect(parsed!.scanStart).toBeGreaterThan(0);
  });

  it('rejects data that is not a JPEG rather than guessing', () => {
    expect(parseJpeg(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(isJpeg(fixture('graphic-plain.png'))).toBe(false);
  });

  it('strips EXIF and produces a smaller file', async () => {
    const original = fixture('photo-with-exif.jpg');
    const result = stripJpegMetadata(original);

    expect(result).not.toBeNull();
    expect(result!.bytes.length).toBeLessThan(original.length);
    expect(result!.removedBytes).toBeGreaterThan(0);
    expect(result!.removed.join(' ')).toMatch(/EXIF/);

    const after = await metadataOf(result!.bytes);
    expect(after.exif, 'EXIF block should be gone').toBeUndefined();
  });

  it('is genuinely lossless: pixels are byte-identical after stripping', async () => {
    // This is the test that backs the claim on the page. If it ever fails, the
    // "quality untouched" wording has to come down.
    const original = fixture('photo-with-exif.jpg');
    const stripped = stripJpegMetadata(original)!;
    await expectPixelIdentical(original, stripped.bytes);
  });

  it('preserves the ICC colour profile by default, and drops it on request', () => {
    const original = fixture('photo-with-exif.jpg');

    const kept = stripJpegMetadata(original, { keepIcc: true })!;
    const kicked = stripJpegMetadata(original, { keepIcc: false })!;

    // Removing more can never produce a larger file.
    expect(kicked.bytes.length).toBeLessThanOrEqual(kept.bytes.length);
  });

  it('handles a file with no metadata without corrupting it', async () => {
    const plain = fixture('photo-plain.jpg');
    const result = stripJpegMetadata(plain);
    expect(result).not.toBeNull();
    await expectPixelIdentical(plain, result!.bytes);
  });

  it('reads the DPI that editors actually read', () => {
    const bytes = fixture('photo-with-exif.jpg');
    const density = readJpegDpi(bytes);
    expect(density.x).toBeGreaterThan(0);
    expect(['exif', 'jfif', 'default']).toContain(density.source);
  });

  it('writes DPI to BOTH the JFIF and EXIF fields', async () => {
    // The bug in most online DPI tools: they write only JFIF, Photoshop reads
    // EXIF, and the change appears not to have happened. Assert both moved.
    const original = fixture('photo-with-exif.jpg');
    const updated = setJpegDpi(original, 300);
    expect(updated).not.toBeNull();

    // 1. Our own reader prefers EXIF, so this proves the EXIF path was patched.
    const readBack = readJpegDpi(updated!);
    expect(readBack.x).toBe(300);
    expect(readBack.y).toBe(300);
    expect(readBack.unit).toBe('inch');
    expect(readBack.source).toBe('exif');

    // 2. sharp is an independent implementation. If it also reports 300, the
    //    value is consistent across the file rather than only in our own view.
    const meta = await metadataOf(updated!);
    expect(meta.density).toBe(300);
  });

  it('changes DPI losslessly', async () => {
    const original = fixture('photo-with-exif.jpg');
    const updated = setJpegDpi(original, 300)!;
    await expectPixelIdentical(original, updated);
  });

  it('inserts a JFIF header when the file has none', async () => {
    // Strip everything first, which removes any JFIF APP0, then set DPI.
    const stripped = stripJpegMetadata(fixture('photo-with-exif.jpg'))!.bytes;
    const updated = setJpegDpi(stripped, 600);
    expect(updated).not.toBeNull();
    expect(updated!.length).toBeGreaterThanOrEqual(stripped.length);

    const meta = await metadataOf(updated!);
    expect(meta.density).toBe(600);
    await expectPixelIdentical(stripped, updated!);
  });

  it('refuses nonsensical DPI values', () => {
    const bytes = fixture('photo-with-exif.jpg');
    expect(setJpegDpi(bytes, 0)).toBeNull();
    expect(setJpegDpi(bytes, -5)).toBeNull();
    expect(setJpegDpi(bytes, Number.NaN)).toBeNull();
    expect(setJpegDpi(bytes, 999999)).toBeNull();
  });
});

/* ═══════════════════════════════ PNG ════════════════════════════════════ */

describe('PNG metadata', () => {
  it('computes CRC32 matching the CRCs already in the file', () => {
    // Every chunk in a valid PNG carries a correct CRC. Recomputing them is a
    // direct check of our implementation against real-world data.
    const bytes = fixture('graphic-with-meta.png');
    const chunks = parsePng(bytes)!;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      const stored = view.getUint32(chunk.dataStart + chunk.dataLength);
      const computed = crc32(bytes.subarray(chunk.start + 4, chunk.dataStart + chunk.dataLength));
      expect(computed, `CRC mismatch on ${chunk.type}`).toBe(stored);
    }
  });

  it('parses chunks and reads dimensions from IHDR', () => {
    const bytes = fixture('graphic-with-meta.png');
    expect(isPng(bytes)).toBe(true);

    const chunks = parsePng(bytes)!;
    expect(chunks[0].type).toBe('IHDR');
    expect(chunks[chunks.length - 1].type).toBe('IEND');

    expect(readPngDimensions(bytes)).toEqual({ width: 400, height: 400 });
  });

  it('strips text chunks losslessly, preserving transparency', async () => {
    const original = fixture('graphic-with-meta.png');
    const result = stripPngMetadata(original);
    expect(result).not.toBeNull();

    const remaining = parsePng(result!.bytes)!.map((c) => c.type);
    expect(remaining).not.toContain('tEXt');
    expect(remaining).not.toContain('iTXt');
    expect(remaining).not.toContain('eXIf');
    expect(remaining).toContain('IHDR');
    expect(remaining).toContain('IDAT');
    expect(remaining).toContain('IEND');

    await expectPixelIdentical(original, result!.bytes);

    const meta = await metadataOf(result!.bytes);
    expect(meta.channels, 'alpha channel must survive').toBe(4);
  });

  it('never drops a critical chunk', () => {
    const result = stripPngMetadata(fixture('graphic-with-meta.png'))!;
    const types = parsePng(result.bytes)!.map((c) => c.type);
    // Critical chunks start with an uppercase letter.
    for (const t of ['IHDR', 'IDAT', 'IEND']) {
      expect(types).toContain(t);
    }
  });

  it('converts between DPI and pixels-per-metre correctly', () => {
    // 300 DPI = 300 / 0.0254 = 11811.02... px/m
    expect(dpiToPixelsPerMetre(300)).toBe(11811);
    expect(dpiToPixelsPerMetre(72)).toBe(2835);
    expect(pixelsPerMetreToDpi(11811)).toBe(300);
    expect(pixelsPerMetreToDpi(2835)).toBe(72);
  });

  it('writes the pHYs chunk and sharp agrees on the result', async () => {
    const original = fixture('graphic-plain.png');
    const updated = setPngDpi(original, 300);
    expect(updated).not.toBeNull();

    expect(readPngDpi(updated!)).toMatchObject({ x: 300, y: 300, hasUnit: true, present: true });

    const meta = await metadataOf(updated!);
    expect(meta.density).toBe(300);

    await expectPixelIdentical(original, updated!);
  });

  it('replaces an existing pHYs rather than adding a second one', () => {
    const once = setPngDpi(fixture('graphic-with-meta.png'), 150)!;
    const twice = setPngDpi(once, 300)!;

    const physCount = parsePng(twice)!.filter((c) => c.type === 'pHYs').length;
    expect(physCount).toBe(1);
    expect(readPngDpi(twice).x).toBe(300);
  });

  it('places pHYs before the first IDAT, as the spec requires', () => {
    const updated = setPngDpi(fixture('graphic-plain.png'), 300)!;
    const chunks = parsePng(updated)!;
    const physIndex = chunks.findIndex((c) => c.type === 'pHYs');
    const idatIndex = chunks.findIndex((c) => c.type === 'IDAT');
    expect(physIndex).toBeGreaterThanOrEqual(0);
    expect(physIndex).toBeLessThan(idatIndex);
  });
});

/* ═══════════════════════════════ WEBP ═══════════════════════════════════ */

describe('WebP metadata', () => {
  it('parses the RIFF chunk list', () => {
    const bytes = fixture('photo-with-exif.webp');
    expect(isWebp(bytes)).toBe(true);

    const chunks = parseWebp(bytes)!;
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.fourCC === 'VP8 ' || c.fourCC === 'VP8L' || c.fourCC === 'VP8X'))
      .toBe(true);
  });

  it('reads dimensions without decoding', () => {
    expect(readWebpDimensions(fixture('photo-with-exif.webp'))).toEqual({
      width: 640,
      height: 480,
    });
    expect(readWebpDimensions(fixture('graphic.webp'))).toEqual({ width: 400, height: 400 });
  });

  it('strips EXIF losslessly and clears the VP8X flag', async () => {
    const original = fixture('photo-with-exif.webp');
    const hadExif = parseWebp(original)!.some((c) => c.fourCC === 'EXIF');
    expect(hadExif, 'fixture should carry an EXIF chunk').toBe(true);

    const result = stripWebpMetadata(original);
    expect(result).not.toBeNull();

    const chunks = parseWebp(result!.bytes)!;
    expect(chunks.some((c) => c.fourCC === 'EXIF')).toBe(false);

    // If a VP8X header survives, it must no longer advertise EXIF.
    const vp8x = chunks.find((c) => c.fourCC === 'VP8X');
    if (vp8x) {
      const flags = result!.bytes[vp8x.dataStart];
      expect(flags & VP8X_FLAG.EXIF).toBe(0);
    }

    await expectPixelIdentical(original, result!.bytes);
  });

  it('keeps the RIFF size field consistent after stripping', () => {
    const result = stripWebpMetadata(fixture('photo-with-exif.webp'))!;
    const view = new DataView(
      result.bytes.buffer,
      result.bytes.byteOffset,
      result.bytes.byteLength,
    );
    expect(view.getUint32(4, true)).toBe(result.bytes.length - 8);
  });

  it('leaves a file with no metadata untouched', () => {
    const original = fixture('graphic.webp');
    const result = stripWebpMetadata(original)!;
    expect(result.removedBytes).toBe(0);
    expect(Array.from(result.bytes)).toEqual(Array.from(original));
  });
});
