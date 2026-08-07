/**
 * Binary search for the highest encoder quality that still fits inside a byte
 * budget.
 *
 * ─── WHY THIS MATTERS ────────────────────────────────────────────────────────
 * Real requirements are stated in megabytes: YouTube caps mobile thumbnails at
 * 2 MB, upload forms cap at 5 MB, an email attachment limit is 25 MB. Almost
 * every free compressor exposes only a quality slider, leaving the user to
 * guess-and-check by hand. Searching for them is a small amount of code and the
 * single most useful thing these compressors do.
 *
 * Search space is quality 1-100 so a plain binary search converges in at most
 * seven encodes, and usually fewer because the first probe at maximum quality
 * frequently already fits.
 */

export interface TargetSizeOptions {
  /** Hard ceiling in bytes. */
  targetBytes: number;
  /** Lowest quality to consider. Below ~20 output is rarely usable. */
  minQuality?: number;
  /** Highest quality to consider. */
  maxQuality?: number;
  /** Safety valve on encoder calls. */
  maxIterations?: number;
}

export interface TargetSizeResult {
  bytes: Uint8Array;
  quality: number;
  /** Number of encoder invocations actually performed. */
  iterations: number;
  /** False when even `minQuality` could not fit the budget. */
  reachedTarget: boolean;
}

export async function encodeToTargetSize(
  encode: (quality: number) => Promise<Uint8Array>,
  options: TargetSizeOptions,
): Promise<TargetSizeResult> {
  const { targetBytes } = options;
  const minQuality = options.minQuality ?? 20;
  const maxQuality = options.maxQuality ?? 95;
  const maxIterations = options.maxIterations ?? 8;

  if (targetBytes <= 0) throw new Error('targetBytes must be positive');
  if (minQuality > maxQuality) throw new Error('minQuality cannot exceed maxQuality');

  let iterations = 0;

  // Probe the top of the range first. Large targets are common — "under 5 MB"
  // on an already-modest photo — and this returns immediately with the best
  // possible quality instead of walking down through needless encodes.
  const best = await encode(maxQuality);
  iterations++;
  if (best.length <= targetBytes) {
    return { bytes: best, quality: maxQuality, iterations, reachedTarget: true };
  }

  let lo = minQuality;
  let hi = maxQuality - 1;
  let bestFit: { bytes: Uint8Array; quality: number } | null = null;
  /** Smallest output seen, used when nothing fits so we still return our best effort. */
  let smallest: { bytes: Uint8Array; quality: number } = { bytes: best, quality: maxQuality };

  while (lo <= hi && iterations < maxIterations) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = await encode(mid);
    iterations++;

    if (candidate.length < smallest.bytes.length) {
      smallest = { bytes: candidate, quality: mid };
    }

    if (candidate.length <= targetBytes) {
      // Fits — keep it, then look for something better above it.
      bestFit = { bytes: candidate, quality: mid };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (bestFit) {
    return {
      bytes: bestFit.bytes,
      quality: bestFit.quality,
      iterations,
      reachedTarget: true,
    };
  }

  // Nothing fit. Return the smallest we managed and say so plainly, so the UI
  // can suggest resizing — which reduces size far faster than quality does.
  return {
    bytes: smallest.bytes,
    quality: smallest.quality,
    iterations,
    reachedTarget: false,
  };
}

/** Parses "500", "500kb", "2 MB", "1.5mb" into bytes. Returns null if unusable. */
export function parseSizeInput(input: string, defaultUnit: 'kb' | 'mb' = 'kb'): number | null {
  const trimmed = input.trim().toLowerCase().replace(/,/g, '');
  if (!trimmed) return null;

  const match = trimmed.match(/^([\d.]+)\s*(b|kb|k|mb|m|kib|mib)?$/);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2] ?? defaultUnit;
  switch (unit) {
    case 'b':
      return Math.round(value);
    case 'k':
    case 'kb':
    case 'kib':
      return Math.round(value * 1024);
    case 'm':
    case 'mb':
    case 'mib':
      return Math.round(value * 1024 * 1024);
    default:
      return null;
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(decimals) : Math.round(kb)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
}

/** "62% smaller" style summary. Negative means the output grew. */
export function savingsPercent(originalBytes: number, newBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.round(((originalBytes - newBytes) / originalBytes) * 100);
}
