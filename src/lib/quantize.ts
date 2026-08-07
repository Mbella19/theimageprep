/**
 * Colour quantisation — median cut with optional Floyd-Steinberg dithering.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Lossless PNG optimisation (oxipng) saves 10-30%. Tools that advertise 70%
 * savings on PNG are doing colour reduction and calling it compression. To be
 * competitive on "compress PNG" we need real colour reduction, and there is no
 * maintained WebAssembly build of libimagequant on npm — @jsquash ships no
 * imagequant package. So it is implemented here.
 *
 * The output is still an RGBA image. The size win arrives in two stages: fewer
 * distinct colours makes DEFLATE dramatically more effective, and oxipng then
 * detects that the image has <= 256 colours and rewrites it as a true indexed
 * palette PNG.
 *
 * ─── ALPHA ───────────────────────────────────────────────────────────────────
 * Alpha participates as a fourth dimension in the cut, so soft shadows and
 * anti-aliased edges survive. Fully transparent pixels are pinned to a single
 * palette entry, because their RGB values are invisible and letting them fight
 * for palette slots wastes them.
 */

export interface QuantizeOptions {
  /** Palette size, 2-256. */
  maxColors: number;
  /** Floyd-Steinberg error diffusion. Costs a little size, hides banding. */
  dither: boolean;
  /** 0-1. Scales the diffused error; lower means less dither noise. */
  ditherAmount?: number;
}

export interface QuantizeResult {
  data: Uint8ClampedArray;
  /** Palette entries as [r, g, b, a] */
  palette: number[][];
  /** Distinct colours in the source, before reduction */
  originalColors: number;
}

/** Bits kept per channel when building the histogram. 5 bits = 32 levels. */
const HIST_BITS = 5;
const HIST_SHIFT = 8 - HIST_BITS;

function histKey(r: number, g: number, b: number, a: number): number {
  return (
    ((r >> HIST_SHIFT) << (HIST_BITS * 3)) |
    ((g >> HIST_SHIFT) << (HIST_BITS * 2)) |
    ((b >> HIST_SHIFT) << HIST_BITS) |
    (a >> HIST_SHIFT)
  );
}

interface ColorBox {
  /** Indices into the unique-colour arrays */
  indices: number[];
  rMin: number; rMax: number;
  gMin: number; gMax: number;
  bMin: number; bMax: number;
  aMin: number; aMax: number;
  count: number;
}

export function quantize(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  options: QuantizeOptions,
): QuantizeResult {
  const maxColors = Math.max(2, Math.min(256, Math.round(options.maxColors)));
  const pixelCount = width * height;

  // ── 1. Histogram of reduced colours ────────────────────────────────────────
  // A Map rather than a dense 2^20 array: real images use a small fraction of
  // the space, and the sparse structure keeps memory proportional to content.
  const bucketIndex = new Map<number, number>();
  const rSum: number[] = [];
  const gSum: number[] = [];
  const bSum: number[] = [];
  const aSum: number[] = [];
  const counts: number[] = [];

  let hasFullyTransparent = false;

  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const a = source[o + 3];
    if (a === 0) {
      hasFullyTransparent = true;
      continue; // handled by a dedicated palette entry
    }
    const r = source[o];
    const g = source[o + 1];
    const b = source[o + 2];
    const key = histKey(r, g, b, a);

    let idx = bucketIndex.get(key);
    if (idx === undefined) {
      idx = counts.length;
      bucketIndex.set(key, idx);
      rSum.push(0); gSum.push(0); bSum.push(0); aSum.push(0); counts.push(0);
    }
    rSum[idx] += r; gSum[idx] += g; bSum[idx] += b; aSum[idx] += a;
    counts[idx]++;
  }

  const uniqueCount = counts.length;
  const reservedForTransparent = hasFullyTransparent ? 1 : 0;
  const targetColors = Math.max(1, maxColors - reservedForTransparent);

  // Average colour of each histogram bucket, used as the point being cut.
  const rAvg = new Float64Array(uniqueCount);
  const gAvg = new Float64Array(uniqueCount);
  const bAvg = new Float64Array(uniqueCount);
  const aAvg = new Float64Array(uniqueCount);
  for (let i = 0; i < uniqueCount; i++) {
    rAvg[i] = rSum[i] / counts[i];
    gAvg[i] = gSum[i] / counts[i];
    bAvg[i] = bSum[i] / counts[i];
    aAvg[i] = aSum[i] / counts[i];
  }

  // Already simple enough — reducing further would only lose quality.
  if (uniqueCount <= targetColors) {
    return {
      data: new Uint8ClampedArray(source),
      palette: buildPaletteFromBuckets(
        Array.from({ length: uniqueCount }, (_, i) => i),
        rAvg, gAvg, bAvg, aAvg, counts, hasFullyTransparent,
      ),
      originalColors: uniqueCount + reservedForTransparent,
    };
  }

  // ── 2. Median cut ──────────────────────────────────────────────────────────
  const boxes: ColorBox[] = [
    makeBox(Array.from({ length: uniqueCount }, (_, i) => i), rAvg, gAvg, bAvg, aAvg, counts),
  ];

  while (boxes.length < targetColors) {
    // Split the box with the largest population-weighted extent. Weighting by
    // pixel count means a large flat area gets more palette detail than a few
    // stray pixels in an unusual colour.
    let bestIndex = -1;
    let bestScore = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.indices.length < 2) continue;
      const score = longestAxisLength(box) * Math.log2(box.count + 1);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) break; // nothing left worth splitting

    const box = boxes[bestIndex];
    const axis = longestAxis(box);
    const values = axis === 0 ? rAvg : axis === 1 ? gAvg : axis === 2 ? bAvg : aAvg;

    // Sort by the chosen axis, then cut at the weighted median so both halves
    // hold a similar number of PIXELS rather than a similar number of colours.
    box.indices.sort((x, y) => values[x] - values[y]);
    const half = box.count / 2;
    let running = 0;
    let cut = 0;
    for (let i = 0; i < box.indices.length - 1; i++) {
      running += counts[box.indices[i]];
      if (running >= half) {
        cut = i + 1;
        break;
      }
    }
    if (cut === 0) cut = Math.max(1, Math.floor(box.indices.length / 2));

    const left = box.indices.slice(0, cut);
    const right = box.indices.slice(cut);
    if (!left.length || !right.length) break;

    boxes.splice(
      bestIndex,
      1,
      makeBox(left, rAvg, gAvg, bAvg, aAvg, counts),
      makeBox(right, rAvg, gAvg, bAvg, aAvg, counts),
    );
  }

  // ── 3. Palette ─────────────────────────────────────────────────────────────
  const palette: number[][] = [];
  if (hasFullyTransparent) palette.push([0, 0, 0, 0]);

  for (const box of boxes) {
    let r = 0, g = 0, b = 0, a = 0, total = 0;
    for (const idx of box.indices) {
      const w = counts[idx];
      r += rAvg[idx] * w; g += gAvg[idx] * w; b += bAvg[idx] * w; a += aAvg[idx] * w;
      total += w;
    }
    palette.push([
      Math.round(r / total),
      Math.round(g / total),
      Math.round(b / total),
      Math.round(a / total),
    ]);
  }

  // ── 4. Remap ───────────────────────────────────────────────────────────────
  const out = new Uint8ClampedArray(source.length);
  const nearestCache = new Map<number, number>();
  const transparentEntry = hasFullyTransparent ? 0 : -1;

  const findNearest = (r: number, g: number, b: number, a: number): number => {
    const key = histKey(r, g, b, a);
    const cached = nearestCache.get(key);
    if (cached !== undefined) return cached;

    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; i++) {
      if (i === transparentEntry) continue;
      const p = palette[i];
      // Alpha is weighted heavily: swapping an opaque pixel for a transparent
      // one is far more visible than a small hue shift.
      const dr = r - p[0], dg = g - p[1], db = b - p[2], da = (a - p[3]) * 3;
      const dist = dr * dr + dg * dg + db * db + da * da;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    nearestCache.set(key, best);
    return best;
  };

  if (!options.dither) {
    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      if (source[o + 3] === 0 && transparentEntry >= 0) {
        out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0;
        continue;
      }
      const p = palette[findNearest(source[o], source[o + 1], source[o + 2], source[o + 3])];
      out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = p[3];
    }
  } else {
    ditherFloydSteinberg(
      source, out, width, height, palette, findNearest,
      transparentEntry, options.ditherAmount ?? 1,
    );
  }

  return { data: out, palette, originalColors: uniqueCount + reservedForTransparent };
}

/**
 * Floyd-Steinberg error diffusion.
 *
 * Distributes each pixel's quantisation error to its not-yet-processed
 * neighbours in the classic 7/16, 3/16, 5/16, 1/16 pattern, which converts
 * visible colour banding into fine noise the eye reads as a smooth gradient.
 * Errors are carried in a float buffer so they accumulate without clipping.
 */
function ditherFloydSteinberg(
  source: Uint8ClampedArray,
  out: Uint8ClampedArray,
  width: number,
  height: number,
  palette: number[][],
  findNearest: (r: number, g: number, b: number, a: number) => number,
  transparentEntry: number,
  amount: number,
): void {
  // Only two rows of error need to be live at a time.
  const rowLength = width * 3;
  let curr = new Float32Array(rowLength);
  let next = new Float32Array(rowLength);

  for (let y = 0; y < height; y++) {
    next.fill(0);

    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const e = x * 3;

      if (source[o + 3] === 0 && transparentEntry >= 0) {
        out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0;
        continue;
      }

      const r = clamp255(source[o] + curr[e]);
      const g = clamp255(source[o + 1] + curr[e + 1]);
      const b = clamp255(source[o + 2] + curr[e + 2]);
      const a = source[o + 3];

      const p = palette[findNearest(r, g, b, a)];
      out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = p[3];

      const er = (r - p[0]) * amount;
      const eg = (g - p[1]) * amount;
      const eb = (b - p[2]) * amount;

      if (x + 1 < width) {
        curr[e + 3] += er * (7 / 16);
        curr[e + 4] += eg * (7 / 16);
        curr[e + 5] += eb * (7 / 16);
      }
      if (y + 1 < height) {
        if (x > 0) {
          next[e - 3] += er * (3 / 16);
          next[e - 2] += eg * (3 / 16);
          next[e - 1] += eb * (3 / 16);
        }
        next[e] += er * (5 / 16);
        next[e + 1] += eg * (5 / 16);
        next[e + 2] += eb * (5 / 16);
        if (x + 1 < width) {
          next[e + 3] += er * (1 / 16);
          next[e + 4] += eg * (1 / 16);
          next[e + 5] += eb * (1 / 16);
        }
      }
    }

    const swap = curr;
    curr = next;
    next = swap;
  }
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function makeBox(
  indices: number[],
  rAvg: Float64Array, gAvg: Float64Array, bAvg: Float64Array, aAvg: Float64Array,
  counts: number[],
): ColorBox {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0;
  let bMin = 255, bMax = 0, aMin = 255, aMax = 0, count = 0;

  for (const i of indices) {
    if (rAvg[i] < rMin) rMin = rAvg[i];
    if (rAvg[i] > rMax) rMax = rAvg[i];
    if (gAvg[i] < gMin) gMin = gAvg[i];
    if (gAvg[i] > gMax) gMax = gAvg[i];
    if (bAvg[i] < bMin) bMin = bAvg[i];
    if (bAvg[i] > bMax) bMax = bAvg[i];
    if (aAvg[i] < aMin) aMin = aAvg[i];
    if (aAvg[i] > aMax) aMax = aAvg[i];
    count += counts[i];
  }

  return { indices, rMin, rMax, gMin, gMax, bMin, bMax, aMin, aMax, count };
}

/** 0 = red, 1 = green, 2 = blue, 3 = alpha */
function longestAxis(box: ColorBox): number {
  const dr = box.rMax - box.rMin;
  const dg = box.gMax - box.gMin;
  const db = box.bMax - box.bMin;
  // Green is weighted up and blue down, approximating human luminance
  // sensitivity, so the palette spends its entries where the eye looks.
  const scored = [dr * 1.0, dg * 1.2, db * 0.8, (box.aMax - box.aMin) * 1.5];
  let best = 0;
  for (let i = 1; i < 4; i++) if (scored[i] > scored[best]) best = i;
  return best;
}

function longestAxisLength(box: ColorBox): number {
  return Math.max(
    box.rMax - box.rMin,
    box.gMax - box.gMin,
    box.bMax - box.bMin,
    box.aMax - box.aMin,
  );
}

function buildPaletteFromBuckets(
  indices: number[],
  rAvg: Float64Array, gAvg: Float64Array, bAvg: Float64Array, aAvg: Float64Array,
  _counts: number[],
  hasTransparent: boolean,
): number[][] {
  const palette: number[][] = hasTransparent ? [[0, 0, 0, 0]] : [];
  for (const i of indices) {
    palette.push([
      Math.round(rAvg[i]), Math.round(gAvg[i]), Math.round(bAvg[i]), Math.round(aAvg[i]),
    ]);
  }
  return palette;
}

/** Counts distinct RGBA values. Used to report the compression result honestly. */
export function countDistinctColors(data: Uint8ClampedArray, limit = 1 << 20): number {
  const seen = new Set<number>();
  for (let i = 0; i < data.length; i += 4) {
    seen.add((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]);
    if (seen.size > limit) return seen.size;
  }
  return seen.size;
}
