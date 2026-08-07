/**
 * WebP container surgery — LOSSLESS.
 *
 * WebP is a RIFF container. The compressed image lives in VP8 / VP8L / ALPH
 * chunks which we copy untouched; EXIF and XMP are separate chunks that can be
 * removed cleanly.
 *
 * ─── STRUCTURE ────────────────────────────────────────────────────────────────
 *   "RIFF" | fileSize(4 LE) | "WEBP"
 *   [ fourCC(4) | size(4 LE) | data(size) | pad to even ] ...
 *
 * ─── THE VP8X TRAP ────────────────────────────────────────────────────────────
 * An extended WebP begins with a VP8X chunk whose first byte is a bitfield
 * declaring which optional chunks are present. Removing the EXIF chunk without
 * clearing its flag leaves the file claiming metadata that is not there, which
 * some decoders reject. Both are handled below.
 */

export interface RiffChunk {
  fourCC: string;
  /** Offset of the fourCC */
  start: number;
  /** Offset one past the data, including any pad byte */
  end: number;
  dataStart: number;
  dataLength: number;
}

/** VP8X feature flags, as bits of the first byte of the VP8X payload. */
export const VP8X_FLAG = {
  ICC: 0x20,
  ALPHA: 0x10,
  EXIF: 0x08,
  XMP: 0x04,
  ANIMATION: 0x02,
} as const;

export function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  return (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  );
}

export function parseWebp(bytes: Uint8Array): RiffChunk[] | null {
  if (!isWebp(bytes)) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: RiffChunk[] = [];
  let pos = 12;

  while (pos + 8 <= bytes.length) {
    let fourCC = '';
    for (let i = 0; i < 4; i++) fourCC += String.fromCharCode(bytes[pos + i]);

    const size = view.getUint32(pos + 4, true);
    const dataStart = pos + 8;
    // RIFF chunks are padded to an even length.
    const padded = size + (size % 2);
    const end = dataStart + padded;
    if (end > bytes.length) break; // truncated — keep what we parsed

    chunks.push({ fourCC, start: pos, end, dataStart, dataLength: size });
    pos = end;
  }

  return chunks.length ? chunks : null;
}

const METADATA_CHUNKS = new Set(['EXIF', 'XMP ']);

export interface WebpStripResult {
  bytes: Uint8Array;
  removedBytes: number;
  removed: string[];
}

export function stripWebpMetadata(
  bytes: Uint8Array,
  options: { keepIcc?: boolean } = {},
): WebpStripResult | null {
  const keepIcc = options.keepIcc ?? true;
  const chunks = parseWebp(bytes);
  if (!chunks) return null;

  const kept: RiffChunk[] = [];
  const removed: string[] = [];
  let clearFlags = 0;

  for (const chunk of chunks) {
    const isIcc = chunk.fourCC === 'ICCP';
    if (METADATA_CHUNKS.has(chunk.fourCC) || (isIcc && !keepIcc)) {
      removed.push(`${chunk.fourCC.trim()} (${chunk.dataLength} bytes)`);
      if (chunk.fourCC === 'EXIF') clearFlags |= VP8X_FLAG.EXIF;
      if (chunk.fourCC === 'XMP ') clearFlags |= VP8X_FLAG.XMP;
      if (isIcc) clearFlags |= VP8X_FLAG.ICC;
      continue;
    }
    kept.push(chunk);
  }

  if (!removed.length) {
    return { bytes: new Uint8Array(bytes), removedBytes: 0, removed: [] };
  }

  const payloadSize = kept.reduce((sum, c) => sum + (c.end - c.start), 0);
  const out = new Uint8Array(12 + payloadSize);
  out.set(bytes.subarray(0, 12), 0);

  let offset = 12;
  for (const chunk of kept) {
    out.set(bytes.subarray(chunk.start, chunk.end), offset);
    // Clear the flags for chunks we removed, so the header stops advertising them.
    if (chunk.fourCC === 'VP8X' && chunk.dataLength >= 1) {
      const flagOffset = offset + 8;
      out[flagOffset] = out[flagOffset] & ~clearFlags;
    }
    offset += chunk.end - chunk.start;
  }

  // RIFF size counts everything after the first 8 bytes.
  new DataView(out.buffer).setUint32(4, out.length - 8, true);

  return { bytes: out, removedBytes: bytes.length - out.length, removed };
}

/**
 * WebP has no field for physical resolution — the format simply does not carry
 * DPI. Exposed as a function so the DPI tool can explain this rather than
 * silently doing nothing, which is what several online tools do.
 */
export function webpSupportsDpi(): false {
  return false;
}

/** Reads dimensions from the VP8X, VP8L or VP8 header without decoding. */
export function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const chunks = parseWebp(bytes);
  if (!chunks) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const vp8x = chunks.find((c) => c.fourCC === 'VP8X');
  if (vp8x && vp8x.dataLength >= 10) {
    // Canvas size is stored minus one, as two 24-bit little-endian values.
    const d = vp8x.dataStart;
    const width = 1 + (bytes[d + 4] | (bytes[d + 5] << 8) | (bytes[d + 6] << 16));
    const height = 1 + (bytes[d + 7] | (bytes[d + 8] << 8) | (bytes[d + 9] << 16));
    return { width, height };
  }

  const vp8l = chunks.find((c) => c.fourCC === 'VP8L');
  if (vp8l && vp8l.dataLength >= 5) {
    // 14 bits width-1, then 14 bits height-1, after the 0x2f signature byte.
    const bits = view.getUint32(vp8l.dataStart + 1, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  const vp8 = chunks.find((c) => c.fourCC === 'VP8 ');
  if (vp8 && vp8.dataLength >= 10) {
    const d = vp8.dataStart;
    return {
      width: view.getUint16(d + 6, true) & 0x3fff,
      height: view.getUint16(d + 8, true) & 0x3fff,
    };
  }

  return null;
}
