/**
 * Format detection from magic bytes.
 *
 * File extensions and browser-reported MIME types both lie routinely — a .jpg
 * that is really a PNG, a HEIC reported as application/octet-stream because the
 * OS did not recognise it. The bytes do not lie.
 */

export type DetectedFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'gif' | 'bmp' | 'avif' | 'tiff' | 'unknown';

/** HEIF-family brands that hold a still image we can decode. */
const HEIC_BRANDS = new Set([
  'heic', 'heix', 'heim', 'heis',
  'hevc', 'hevx', 'hevm', 'hevs',
  'mif1', 'msf1',
]);

function boxBrand(bytes: Uint8Array): string | null {
  // ISO base media file format: [size:4]['ftyp'][major_brand:4]
  if (bytes.length < 12) return null;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
    return null; // not 'ftyp'
  }
  return String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
}

export function detectFormat(bytes: Uint8Array): DetectedFormat {
  if (bytes.length < 12) return 'unknown';

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';

  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }

  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }

  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';

  // TIFF: 'II' + 42, or 'MM' + 42
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return 'tiff';
  }

  const brand = boxBrand(bytes);
  if (brand) {
    if (HEIC_BRANDS.has(brand)) return 'heic';
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }

  return 'unknown';
}

export function isHeic(bytes: Uint8Array): boolean {
  return detectFormat(bytes) === 'heic';
}

const MIME_BY_DETECTED: Record<DetectedFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
  tiff: 'image/tiff',
  unknown: 'application/octet-stream',
};

export function mimeForBytes(bytes: Uint8Array): string {
  return MIME_BY_DETECTED[detectFormat(bytes)];
}

/** Human-facing label, e.g. for "This is a PNG, not a JPG" messages. */
export function formatLabel(format: DetectedFormat): string {
  switch (format) {
    case 'jpeg': return 'JPEG';
    case 'png': return 'PNG';
    case 'webp': return 'WebP';
    case 'heic': return 'HEIC';
    case 'gif': return 'GIF';
    case 'bmp': return 'BMP';
    case 'avif': return 'AVIF';
    case 'tiff': return 'TIFF';
    default: return 'unrecognised';
  }
}
