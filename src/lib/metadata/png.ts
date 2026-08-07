/**
 * PNG container surgery — LOSSLESS.
 *
 * A PNG is a signature followed by a flat list of length-prefixed chunks. The
 * compressed pixel data lives in IDAT chunks, which we copy byte-for-byte. We
 * only ever add, remove or rewrite the small ancillary chunks around them.
 *
 * ─── STRUCTURE ────────────────────────────────────────────────────────────────
 *   89 50 4E 47 0D 0A 1A 0A     signature
 *   [ length(4 BE) | type(4 ascii) | data(length) | crc(4 BE) ] ...
 *
 * Chunk type casing is meaningful: an uppercase first letter marks the chunk
 * critical (a decoder must understand it), lowercase marks it ancillary.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngChunk {
  type: string;
  /** Offset of the 4-byte length field */
  start: number;
  /** Offset one past the CRC */
  end: number;
  dataStart: number;
  dataLength: number;
}

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/* ───────────────────────────────── CRC32 ─────────────────────────────────── */

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

/** PNG's CRC-32, computed over the chunk type followed by the chunk data. */
export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/* ─────────────────────────────── PARSING ─────────────────────────────────── */

export function parsePng(bytes: Uint8Array): PngChunk[] | null {
  if (!isPng(bytes)) return null;

  const chunks: PngChunk[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;

  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos);
    const dataStart = pos + 8;
    const end = dataStart + length + 4;
    if (end > bytes.length) return null; // truncated

    let type = '';
    for (let i = 0; i < 4; i++) type += String.fromCharCode(bytes[pos + 4 + i]);

    chunks.push({ type, start: pos, end, dataStart, dataLength: length });
    if (type === 'IEND') return chunks;
    pos = end;
  }

  return chunks.length ? chunks : null;
}

/** Assembles a complete chunk (length + type + data + CRC) ready to splice in. */
export function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);

  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);

  // The CRC covers the type field and the data, but not the length.
  const crc = crc32(out.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc);
  return out;
}

/* ───────────────────────────── STRIP METADATA ────────────────────────────── */

/** Text and timestamp chunks — the ones that carry information about you. */
const METADATA_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

/** Chunks that affect how the image is displayed. Removing these changes it. */
const RENDERING_CHUNKS = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', // critical
  'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'hIST',
  'pHYs', // physical dimensions — the DPI tool's business, not the EXIF remover's
  'acTL', 'fcTL', 'fdAT', // APNG animation frames
]);

export interface PngStripResult {
  bytes: Uint8Array;
  removedBytes: number;
  removed: string[];
}

export function stripPngMetadata(
  bytes: Uint8Array,
  options: { keepIcc?: boolean } = {},
): PngStripResult | null {
  const keepIcc = options.keepIcc ?? true;
  const chunks = parsePng(bytes);
  if (!chunks) return null;

  const kept: PngChunk[] = [];
  const removed: string[] = [];

  for (const chunk of chunks) {
    const isIcc = chunk.type === 'iCCP';
    const drop =
      METADATA_CHUNKS.has(chunk.type) ||
      (isIcc && !keepIcc) ||
      // Unknown ancillary chunks (lowercase first letter) are metadata by
      // definition. Unknown CRITICAL chunks are always kept — dropping one
      // would make the file undecodable.
      (!RENDERING_CHUNKS.has(chunk.type) && chunk.type[0] === chunk.type[0].toLowerCase());

    if (drop) {
      removed.push(`${chunk.type} (${chunk.dataLength} bytes)`);
    } else {
      kept.push(chunk);
    }
  }

  const total = 8 + kept.reduce((sum, c) => sum + (c.end - c.start), 0);
  const out = new Uint8Array(total);
  out.set(bytes.subarray(0, 8), 0);
  let offset = 8;
  for (const chunk of kept) {
    out.set(bytes.subarray(chunk.start, chunk.end), offset);
    offset += chunk.end - chunk.start;
  }

  return { bytes: out, removedBytes: bytes.length - out.length, removed };
}

/* ───────────────────────────────── DPI ───────────────────────────────────── */

/** PNG stores pixels per METRE, so DPI has to be converted both ways. */
const METRES_PER_INCH = 0.0254;

export function dpiToPixelsPerMetre(dpi: number): number {
  return Math.round(dpi / METRES_PER_INCH);
}

export function pixelsPerMetreToDpi(ppm: number): number {
  return Math.round(ppm * METRES_PER_INCH);
}

export interface PngDensity {
  x: number;
  y: number;
  /** False when the pHYs chunk records an aspect ratio with no real-world unit */
  hasUnit: boolean;
  present: boolean;
}

export function readPngDpi(bytes: Uint8Array): PngDensity {
  const chunks = parsePng(bytes);
  const fallback: PngDensity = { x: 72, y: 72, hasUnit: false, present: false };
  if (!chunks) return fallback;

  const phys = chunks.find((c) => c.type === 'pHYs');
  if (!phys || phys.dataLength < 9) return fallback;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ppuX = view.getUint32(phys.dataStart);
  const ppuY = view.getUint32(phys.dataStart + 4);
  const unit = bytes[phys.dataStart + 8];

  if (unit !== 1) {
    // unit 0 means "unknown" — the numbers are a pixel aspect ratio only.
    return { x: ppuX, y: ppuY, hasUnit: false, present: true };
  }

  return {
    x: pixelsPerMetreToDpi(ppuX),
    y: pixelsPerMetreToDpi(ppuY),
    hasUnit: true,
    present: true,
  };
}

/**
 * Writes the pHYs chunk, LOSSLESSLY. Replaces an existing one, or inserts a new
 * one immediately before the first IDAT (the spec requires pHYs to precede the
 * image data).
 */
export function setPngDpi(bytes: Uint8Array, dpi: number): Uint8Array | null {
  if (!Number.isFinite(dpi) || dpi <= 0) return null;
  const chunks = parsePng(bytes);
  if (!chunks) return null;

  const ppm = dpiToPixelsPerMetre(dpi);
  const data = new Uint8Array(9);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, ppm);
  dv.setUint32(4, ppm);
  data[8] = 1; // unit = metre
  const physChunk = buildChunk('pHYs', data);

  const pieces: Uint8Array[] = [bytes.subarray(0, 8)];
  let inserted = false;

  for (const chunk of chunks) {
    if (chunk.type === 'pHYs') {
      // Replace in place, preserving chunk ordering.
      pieces.push(physChunk);
      inserted = true;
      continue;
    }
    if (!inserted && chunk.type === 'IDAT') {
      pieces.push(physChunk);
      inserted = true;
    }
    pieces.push(bytes.subarray(chunk.start, chunk.end));
  }

  if (!inserted) return null; // no IDAT: not a real image

  const total = pieces.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const piece of pieces) {
    out.set(piece, offset);
    offset += piece.length;
  }
  return out;
}

/** Reads width and height from IHDR without decoding the image. */
export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const chunks = parsePng(bytes);
  const ihdr = chunks?.find((c) => c.type === 'IHDR');
  if (!ihdr || ihdr.dataLength < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(ihdr.dataStart),
    height: view.getUint32(ihdr.dataStart + 4),
  };
}
