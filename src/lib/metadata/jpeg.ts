/**
 * JPEG container surgery — LOSSLESS.
 *
 * Nothing here decodes an image. We walk the marker segments, copy the ones we
 * want byte-for-byte, and drop the ones we do not. The entropy-coded scan data
 * (the actual compressed picture) is copied verbatim, so the pixels that come
 * out are mathematically identical to the pixels that went in.
 *
 * That is the whole point: every other free "remove EXIF" tool decodes and
 * re-encodes, quietly costing you a generation of JPEG quality to delete a few
 * kilobytes of text.
 *
 * ─── STRUCTURE ────────────────────────────────────────────────────────────────
 *   FFD8                      SOI
 *   FFxx LLLL <payload>       marker segments, LLLL includes its own 2 bytes
 *   FFDA LLLL <header>        SOS — entropy-coded scan data follows immediately
 *   ...scan bytes...          copied verbatim, never parsed
 *   FFD9                      EOI
 */

export const MARKER = {
  SOI: 0xd8,
  EOI: 0xd9,
  SOS: 0xda,
  APP0: 0xe0, // JFIF — holds the density/DPI fields
  APP1: 0xe1, // Exif or XMP
  APP2: 0xe2, // ICC_PROFILE or MPF
  APP13: 0xed, // Photoshop IRB / IPTC
  COM: 0xfe, // free-text comment
} as const;

export interface JpegSegment {
  /** Second byte of the marker, e.g. 0xe1 for APP1 */
  marker: number;
  /** Offset of the leading 0xFF */
  start: number;
  /** Offset one past the last byte of this segment */
  end: number;
  /** Offset of the first payload byte, or -1 for standalone markers */
  dataStart: number;
  dataEnd: number;
  /** Null-terminated ASCII identifier for APPn segments, e.g. "Exif", "JFIF" */
  identifier: string | null;
}

export interface JpegStructure {
  segments: JpegSegment[];
  /** Offset where entropy-coded scan data begins (i.e. just after the SOS header) */
  scanStart: number;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function readIdentifier(bytes: Uint8Array, from: number, to: number): string | null {
  let out = '';
  for (let i = from; i < to && i < from + 32; i++) {
    const b = bytes[i];
    if (b === 0) return out;
    if (b < 0x20 || b > 0x7e) return out.length ? out : null;
    out += String.fromCharCode(b);
  }
  return out.length ? out : null;
}

/**
 * Walks the marker segments up to and including SOS. Returns null if the file
 * is not a parseable JPEG, in which case callers must not claim losslessness.
 */
export function parseJpeg(bytes: Uint8Array): JpegStructure | null {
  if (!isJpeg(bytes)) return null;

  const segments: JpegSegment[] = [];
  let pos = 0;

  // SOI
  segments.push({ marker: MARKER.SOI, start: 0, end: 2, dataStart: -1, dataEnd: -1, identifier: null });
  pos = 2;

  while (pos < bytes.length - 1) {
    if (bytes[pos] !== 0xff) return null; // desynchronised — refuse rather than guess

    // Fill bytes: a marker may be padded with any number of 0xFF.
    let markerPos = pos;
    while (markerPos < bytes.length - 1 && bytes[markerPos + 1] === 0xff) markerPos++;
    const marker = bytes[markerPos + 1];

    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({
        marker,
        start: markerPos,
        end: markerPos + 2,
        dataStart: -1,
        dataEnd: -1,
        identifier: null,
      });
      pos = markerPos + 2;
      continue;
    }

    if (marker === MARKER.EOI) {
      segments.push({
        marker,
        start: markerPos,
        end: markerPos + 2,
        dataStart: -1,
        dataEnd: -1,
        identifier: null,
      });
      return { segments, scanStart: markerPos + 2 };
    }

    if (markerPos + 4 > bytes.length) return null;
    const length = (bytes[markerPos + 2] << 8) | bytes[markerPos + 3];
    if (length < 2) return null;

    const dataStart = markerPos + 4;
    const dataEnd = markerPos + 2 + length;
    if (dataEnd > bytes.length) return null;

    segments.push({
      marker,
      start: markerPos,
      end: dataEnd,
      dataStart,
      dataEnd,
      identifier: marker >= 0xe0 && marker <= 0xef ? readIdentifier(bytes, dataStart, dataEnd) : null,
    });

    // Everything after the SOS header is entropy-coded data. We never parse it.
    if (marker === MARKER.SOS) {
      return { segments, scanStart: dataEnd };
    }

    pos = dataEnd;
  }

  return null;
}

/** True for segments that hold metadata rather than image or decoding data. */
function isMetadataSegment(seg: JpegSegment, keepIcc: boolean): boolean {
  switch (seg.marker) {
    case MARKER.APP1: // Exif and XMP both live here
    case MARKER.APP13: // Photoshop IRB / IPTC
    case MARKER.COM:
      return true;
    case MARKER.APP2:
      // ICC_PROFILE describes colour and is kept by default — dropping it
      // visibly shifts colours on wide-gamut displays.
      if (seg.identifier === 'ICC_PROFILE') return !keepIcc;
      return true; // MPF and friends are metadata
    default:
      // APP3..APP12, APP14..APP15 are vendor metadata blocks.
      if (seg.marker >= 0xe3 && seg.marker <= 0xef) return true;
      return false;
  }
}

export interface StripResult {
  bytes: Uint8Array;
  removedBytes: number;
  removed: string[];
}

export interface StripOptions {
  /** Keep the embedded ICC colour profile. Default true. */
  keepIcc?: boolean;
}

/**
 * Removes metadata segments without touching a single pixel.
 * Returns null when the file cannot be parsed safely.
 */
export function stripJpegMetadata(
  bytes: Uint8Array,
  options: StripOptions = {},
): StripResult | null {
  const keepIcc = options.keepIcc ?? true;
  const parsed = parseJpeg(bytes);
  if (!parsed) return null;

  const keptRanges: [number, number][] = [];
  const removed: string[] = [];

  for (const seg of parsed.segments) {
    if (seg.marker === MARKER.EOI) continue; // part of the verbatim tail
    if (isMetadataSegment(seg, keepIcc)) {
      removed.push(describeSegment(seg));
      continue;
    }
    keptRanges.push([seg.start, seg.end]);
  }

  // The scan data and everything after it is copied exactly as-is.
  keptRanges.push([parsed.scanStart, bytes.length]);

  const total = keptRanges.reduce((sum, [a, b]) => sum + (b - a), 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const [a, b] of keptRanges) {
    out.set(bytes.subarray(a, b), offset);
    offset += b - a;
  }

  return { bytes: out, removedBytes: bytes.length - out.length, removed };
}

function describeSegment(seg: JpegSegment): string {
  const size = seg.dataEnd > 0 ? seg.dataEnd - seg.dataStart : 0;
  if (seg.marker === MARKER.APP1) {
    if (seg.identifier === 'Exif') return `EXIF (${size} bytes)`;
    if (seg.identifier?.includes('ns.adobe.com/xap')) return `XMP (${size} bytes)`;
    return `APP1 (${size} bytes)`;
  }
  if (seg.marker === MARKER.APP13) return `Photoshop/IPTC (${size} bytes)`;
  if (seg.marker === MARKER.COM) return `Comment (${size} bytes)`;
  if (seg.marker === MARKER.APP2) return `${seg.identifier ?? 'APP2'} (${size} bytes)`;
  return `APP${seg.marker - 0xe0} (${size} bytes)`;
}

/* ═══════════════════════════════ DPI ═══════════════════════════════════════ */

export interface JpegDensity {
  x: number;
  y: number;
  /** 'inch' | 'cm' | 'none' — 'none' means the values are an aspect ratio only */
  unit: 'inch' | 'cm' | 'none';
  source: 'jfif' | 'exif' | 'default';
}

const EXIF_TAG = {
  ORIENTATION: 0x0112,
  X_RESOLUTION: 0x011a,
  Y_RESOLUTION: 0x011b,
  RESOLUTION_UNIT: 0x0128,
} as const;

/**
 * Reads the EXIF orientation tag (1-8), or 1 when absent.
 *
 * Phone cameras do not rotate the pixels they store; they record the sensor
 * orientation here and expect the viewer to apply it. Anything that decodes
 * without honouring this produces sideways photos.
 *
 *   1 normal          2 flip horizontal   3 rotate 180      4 flip vertical
 *   5 transpose       6 rotate 90 CW      7 transverse      8 rotate 270 CW
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  const parsed = parseJpeg(bytes);
  if (!parsed) return 1;

  const app1 = parsed.segments.find((s) => s.marker === MARKER.APP1 && s.identifier === 'Exif');
  if (!app1) return 1;

  const tiffStart = app1.dataStart + 6; // skip "Exif\0\0"
  if (tiffStart + 8 > app1.dataEnd) return 1;

  const b0 = bytes[tiffStart];
  const b1 = bytes[tiffStart + 1];
  let little: boolean;
  if (b0 === 0x49 && b1 === 0x49) little = true;
  else if (b0 === 0x4d && b1 === 0x4d) little = false;
  else return 1;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return 1;

  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  if (ifd0 + 2 > app1.dataEnd) return 1;

  const count = view.getUint16(ifd0, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > app1.dataEnd) break;
    if (view.getUint16(entry, little) === EXIF_TAG.ORIENTATION) {
      const value = view.getUint16(entry + 8, little); // SHORT, stored inline
      return value >= 1 && value <= 8 ? value : 1;
    }
  }

  return 1;
}

/** Reads the effective DPI, preferring EXIF because that is what editors read. */
export function readJpegDpi(bytes: Uint8Array): JpegDensity {
  const parsed = parseJpeg(bytes);
  if (!parsed) return { x: 72, y: 72, unit: 'none', source: 'default' };

  // EXIF first: Photoshop, Word and most editors prefer it over JFIF.
  const app1 = parsed.segments.find((s) => s.marker === MARKER.APP1 && s.identifier === 'Exif');
  if (app1) {
    const exif = readExifResolution(bytes, app1);
    if (exif) return exif;
  }

  const app0 = parsed.segments.find((s) => s.marker === MARKER.APP0 && s.identifier === 'JFIF');
  if (app0) {
    const p = app0.dataStart + 5; // skip "JFIF\0"
    const units = bytes[p + 2];
    const x = (bytes[p + 3] << 8) | bytes[p + 4];
    const y = (bytes[p + 5] << 8) | bytes[p + 6];
    if (x > 0 && y > 0) {
      return {
        x,
        y,
        unit: units === 1 ? 'inch' : units === 2 ? 'cm' : 'none',
        source: 'jfif',
      };
    }
  }

  return { x: 72, y: 72, unit: 'none', source: 'default' };
}

function readExifResolution(bytes: Uint8Array, app1: JpegSegment): JpegDensity | null {
  const tiffStart = app1.dataStart + 6; // skip "Exif\0\0"
  if (tiffStart + 8 > app1.dataEnd) return null;

  const b0 = bytes[tiffStart];
  const b1 = bytes[tiffStart + 1];
  let little: boolean;
  if (b0 === 0x49 && b1 === 0x49) little = true;
  else if (b0 === 0x4d && b1 === 0x4d) little = false;
  else return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return null;

  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  if (ifd0 + 2 > app1.dataEnd) return null;

  const count = view.getUint16(ifd0, little);
  let x: number | null = null;
  let y: number | null = null;
  let unit = 2; // default: inches

  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > app1.dataEnd) break;
    const tag = view.getUint16(entry, little);

    if (tag === EXIF_TAG.RESOLUTION_UNIT) {
      unit = view.getUint16(entry + 8, little);
    } else if (tag === EXIF_TAG.X_RESOLUTION || tag === EXIF_TAG.Y_RESOLUTION) {
      // RATIONAL: 8 bytes, so the entry holds an offset rather than the value.
      const valueOffset = tiffStart + view.getUint32(entry + 8, little);
      if (valueOffset + 8 > app1.dataEnd) continue;
      const num = view.getUint32(valueOffset, little);
      const den = view.getUint32(valueOffset + 4, little);
      if (den === 0) continue;
      const value = num / den;
      if (tag === EXIF_TAG.X_RESOLUTION) x = value;
      else y = value;
    }
  }

  if (x === null && y === null) return null;
  return {
    x: Math.round(x ?? y ?? 72),
    y: Math.round(y ?? x ?? 72),
    unit: unit === 3 ? 'cm' : 'inch',
    source: 'exif',
  };
}

/**
 * Sets the DPI, LOSSLESSLY.
 *
 * ─── WHY THIS IS THE ONE THAT WORKS ──────────────────────────────────────────
 * A JPEG can record resolution in two independent places: the JFIF APP0 density
 * fields, and the EXIF XResolution/YResolution tags. Nearly every online DPI
 * tool writes only the JFIF fields. Photoshop, Word and InDesign read the EXIF
 * values, find the OLD number still sitting there, and display it — so the
 * change appears to have done nothing at all.
 *
 * This writes both. EXIF tags are patched in place (a RATIONAL is 8 bytes at a
 * fixed offset, so the value can be overwritten without moving anything), and
 * ResolutionUnit is forced to inches so the number is not reinterpreted as
 * dots-per-centimetre. A JFIF APP0 segment is inserted if the file lacks one.
 */
export function setJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array | null {
  if (!Number.isFinite(dpi) || dpi <= 0 || dpi > 65535) return null;
  const parsed = parseJpeg(bytes);
  if (!parsed) return null;

  const density = Math.round(dpi);
  const out = new Uint8Array(bytes); // work on a copy; patch EXIF in place
  const view = new DataView(out.buffer);

  // ── 1. Patch every EXIF APP1 block in place ──────────────────────────────
  for (const seg of parsed.segments) {
    if (seg.marker !== MARKER.APP1 || seg.identifier !== 'Exif') continue;
    patchExifResolution(out, view, seg, density);
  }

  // ── 2. Rewrite or insert the JFIF APP0 density fields ────────────────────
  const app0 = parsed.segments.find((s) => s.marker === MARKER.APP0 && s.identifier === 'JFIF');

  if (app0 && app0.dataEnd - app0.dataStart >= 12) {
    const p = app0.dataStart + 5; // after "JFIF\0"
    out[p + 2] = 1; // units = dots per inch
    out[p + 3] = (density >> 8) & 0xff;
    out[p + 4] = density & 0xff;
    out[p + 5] = (density >> 8) & 0xff;
    out[p + 6] = density & 0xff;
    return out;
  }

  // No usable JFIF header — build one and splice it in directly after SOI.
  const jfif = new Uint8Array([
    0xff, MARKER.APP0,
    0x00, 0x10, // length = 16
    0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x02, // version 1.02
    0x01, // units = inches
    (density >> 8) & 0xff, density & 0xff, // Xdensity
    (density >> 8) & 0xff, density & 0xff, // Ydensity
    0x00, 0x00, // no embedded thumbnail
  ]);

  const result = new Uint8Array(out.length + jfif.length);
  result.set(out.subarray(0, 2), 0); // SOI
  result.set(jfif, 2);
  result.set(out.subarray(2), 2 + jfif.length);
  return result;
}

/**
 * Overwrites XResolution / YResolution / ResolutionUnit inside an EXIF block.
 *
 * Only patches tags that already exist. Inserting a new IFD entry would shift
 * every subsequent offset in the TIFF structure and risk corrupting the block —
 * and it is unnecessary, because a reader that finds no EXIF resolution falls
 * back to the JFIF value we are also writing.
 */
function patchExifResolution(
  out: Uint8Array,
  view: DataView,
  app1: JpegSegment,
  dpi: number,
): void {
  const tiffStart = app1.dataStart + 6;
  if (tiffStart + 8 > app1.dataEnd) return;

  const b0 = out[tiffStart];
  const b1 = out[tiffStart + 1];
  let little: boolean;
  if (b0 === 0x49 && b1 === 0x49) little = true;
  else if (b0 === 0x4d && b1 === 0x4d) little = false;
  else return;

  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return;
  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  if (ifd0 + 2 > app1.dataEnd) return;

  const count = view.getUint16(ifd0, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > app1.dataEnd) break;
    const tag = view.getUint16(entry, little);

    if (tag === EXIF_TAG.RESOLUTION_UNIT) {
      // SHORT fits in the 4-byte value field, stored at its start.
      view.setUint16(entry + 8, 2, little); // 2 = inches
    } else if (tag === EXIF_TAG.X_RESOLUTION || tag === EXIF_TAG.Y_RESOLUTION) {
      const valueOffset = tiffStart + view.getUint32(entry + 8, little);
      if (valueOffset + 8 > app1.dataEnd) continue;
      view.setUint32(valueOffset, dpi, little); // numerator
      view.setUint32(valueOffset + 4, 1, little); // denominator
    }
  }
}
