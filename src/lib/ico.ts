/**
 * ICO writer.
 *
 * Browsers still request /favicon.ico from the site root regardless of what the
 * HTML declares, and a single .ico can hold several resolutions — which is
 * exactly what it is for. Since Windows Vista, ICO entries may contain PNG data
 * directly rather than the old BMP-with-AND-mask format, so each entry here is
 * simply a complete PNG.
 *
 * ─── LAYOUT ──────────────────────────────────────────────────────────────────
 *   ICONDIR       reserved(2)=0 | type(2)=1 | count(2)
 *   ICONDIRENTRY  width(1) | height(1) | colours(1) | reserved(1) |
 *                 planes(2) | bitCount(2) | bytesInRes(4) | imageOffset(4)
 *   ...           image payloads, in entry order
 *
 * A width or height byte of 0 means 256 — the field is one byte, so 256 does
 * not fit and zero is the agreed escape.
 */

export interface IcoImage {
  /** Square edge length in pixels, 1-256 */
  size: number;
  /** Complete PNG file for this size */
  png: Uint8Array;
}

const ICONDIR_SIZE = 6;
const ICONDIRENTRY_SIZE = 16;

export function buildIco(images: IcoImage[]): Uint8Array {
  if (!images.length) throw new Error('buildIco requires at least one image');
  for (const img of images) {
    if (img.size < 1 || img.size > 256) {
      throw new Error(`ICO entry size must be 1-256, got ${img.size}`);
    }
  }

  // Smallest first, which is the conventional ordering and what some older
  // Windows shells expect when picking an entry.
  const sorted = [...images].sort((a, b) => a.size - b.size);

  const headerSize = ICONDIR_SIZE + ICONDIRENTRY_SIZE * sorted.length;
  const totalSize = sorted.reduce((sum, img) => sum + img.png.length, headerSize);

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type 1 = icon (2 would be cursor)
  view.setUint16(4, sorted.length, true);

  let dataOffset = headerSize;

  sorted.forEach((img, i) => {
    const entry = ICONDIR_SIZE + i * ICONDIRENTRY_SIZE;

    out[entry] = img.size === 256 ? 0 : img.size; // width
    out[entry + 1] = img.size === 256 ? 0 : img.size; // height
    out[entry + 2] = 0; // colour palette count, 0 = not paletted
    out[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // colour planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, img.png.length, true);
    view.setUint32(entry + 12, dataOffset, true);

    out.set(img.png, dataOffset);
    dataOffset += img.png.length;
  });

  return out;
}

/** Minimal validity check used by the tests and as a guard before download. */
export function parseIcoHeader(bytes: Uint8Array): {
  count: number;
  entries: { width: number; height: number; length: number; offset: number }[];
} | null {
  if (bytes.length < ICONDIR_SIZE) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint16(0, true) !== 0) return null;
  if (view.getUint16(2, true) !== 1) return null;

  const count = view.getUint16(4, true);
  if (count === 0 || bytes.length < ICONDIR_SIZE + count * ICONDIRENTRY_SIZE) return null;

  const entries = [];
  for (let i = 0; i < count; i++) {
    const e = ICONDIR_SIZE + i * ICONDIRENTRY_SIZE;
    entries.push({
      width: bytes[e] === 0 ? 256 : bytes[e],
      height: bytes[e + 1] === 0 ? 256 : bytes[e + 1],
      length: view.getUint32(e + 8, true),
      offset: view.getUint32(e + 12, true),
    });
  }

  return { count, entries };
}
