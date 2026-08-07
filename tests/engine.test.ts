import { describe, it, expect } from 'vitest';
import {
  encodeToTargetSize,
  parseSizeInput,
  formatBytes,
  savingsPercent,
} from '../src/lib/targetSize';
import { buildIco, parseIcoHeader } from '../src/lib/ico';
import { quantize, countDistinctColors } from '../src/lib/quantize';

/* ═══════════════════════════ TARGET SIZE SEARCH ═════════════════════════ */

describe('encodeToTargetSize', () => {
  /** Stand-in encoder: output size falls as quality falls, like a real one. */
  const fakeEncoder = (calls: number[]) => async (quality: number) => {
    calls.push(quality);
    return new Uint8Array(quality * 1000);
  };

  it('returns immediately at max quality when it already fits', async () => {
    const calls: number[] = [];
    const result = await encodeToTargetSize(fakeEncoder(calls), { targetBytes: 500_000 });

    expect(result.reachedTarget).toBe(true);
    expect(result.quality).toBe(95);
    expect(result.iterations).toBe(1);
    expect(calls).toEqual([95]);
  });

  it('finds the HIGHEST quality that fits, not merely one that fits', async () => {
    const calls: number[] = [];
    // Budget of 50,000 bytes → quality 50 is the largest that fits.
    const result = await encodeToTargetSize(fakeEncoder(calls), { targetBytes: 50_000 });

    expect(result.reachedTarget).toBe(true);
    expect(result.quality).toBe(50);
    expect(result.bytes.length).toBeLessThanOrEqual(50_000);
  });

  it('converges within the iteration budget', async () => {
    for (const target of [21_000, 33_000, 47_000, 68_000, 88_000]) {
      const calls: number[] = [];
      const result = await encodeToTargetSize(fakeEncoder(calls), { targetBytes: target });
      expect(result.iterations).toBeLessThanOrEqual(8);
      expect(result.bytes.length).toBeLessThanOrEqual(target);
      expect(result.reachedTarget).toBe(true);
    }
  });

  it('reports failure honestly when the target is unreachable', async () => {
    const calls: number[] = [];
    // Even quality 20 yields 20,000 bytes, so 5,000 is impossible.
    const result = await encodeToTargetSize(fakeEncoder(calls), { targetBytes: 5_000 });

    expect(result.reachedTarget).toBe(false);
    // It should still hand back the smallest thing it managed to produce.
    expect(result.bytes.length).toBeGreaterThan(0);
    expect(result.quality).toBe(20);
  });

  it('respects a custom quality floor', async () => {
    const calls: number[] = [];
    await encodeToTargetSize(fakeEncoder(calls), {
      targetBytes: 10_000,
      minQuality: 40,
    });
    expect(Math.min(...calls)).toBeGreaterThanOrEqual(40);
  });

  it('rejects a nonsensical budget', async () => {
    await expect(
      encodeToTargetSize(async () => new Uint8Array(10), { targetBytes: 0 }),
    ).rejects.toThrow();
  });
});

describe('parseSizeInput', () => {
  it('parses the ways people actually type a size', () => {
    expect(parseSizeInput('500')).toBe(500 * 1024); // bare number defaults to KB
    expect(parseSizeInput('500kb')).toBe(500 * 1024);
    expect(parseSizeInput('500 KB')).toBe(500 * 1024);
    expect(parseSizeInput('2mb')).toBe(2 * 1024 * 1024);
    expect(parseSizeInput('2 MB')).toBe(2 * 1024 * 1024);
    expect(parseSizeInput('1.5mb')).toBe(Math.round(1.5 * 1024 * 1024));
    expect(parseSizeInput('1,500 kb')).toBe(1500 * 1024);
    expect(parseSizeInput('900b')).toBe(900);
  });

  it('rejects nonsense instead of guessing', () => {
    expect(parseSizeInput('')).toBeNull();
    expect(parseSizeInput('abc')).toBeNull();
    expect(parseSizeInput('-5mb')).toBeNull();
    expect(parseSizeInput('0')).toBeNull();
    expect(parseSizeInput('5 gigabytes')).toBeNull();
  });
});

describe('formatting helpers', () => {
  it('formats bytes readably', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(150 * 1024)).toBe('150 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('computes savings, including when a file grows', () => {
    expect(savingsPercent(1000, 400)).toBe(60);
    expect(savingsPercent(1000, 1000)).toBe(0);
    expect(savingsPercent(1000, 1200)).toBe(-20);
  });
});

/* ═══════════════════════════════ ICO ════════════════════════════════════ */

describe('buildIco', () => {
  const fakePng = (n: number) => new Uint8Array(n).fill(0xab);

  it('writes a valid multi-resolution header', () => {
    const ico = buildIco([
      { size: 32, png: fakePng(200) },
      { size: 16, png: fakePng(100) },
      { size: 48, png: fakePng(300) },
    ]);

    const parsed = parseIcoHeader(ico);
    expect(parsed).not.toBeNull();
    expect(parsed!.count).toBe(3);
    // Entries are ordered smallest first.
    expect(parsed!.entries.map((e) => e.width)).toEqual([16, 32, 48]);
  });

  it('points each entry at the right bytes', () => {
    const a = fakePng(100);
    const b = fakePng(200);
    const ico = buildIco([
      { size: 16, png: a },
      { size: 32, png: b },
    ]);

    const { entries } = parseIcoHeader(ico)!;
    // Header is 6 + 2*16 = 38 bytes, so the first payload starts there.
    expect(entries[0].offset).toBe(38);
    expect(entries[0].length).toBe(100);
    expect(entries[1].offset).toBe(138);
    expect(entries[1].length).toBe(200);
    expect(ico.length).toBe(38 + 300);
  });

  it('encodes 256 as the zero escape', () => {
    const ico = buildIco([{ size: 256, png: fakePng(50) }]);
    expect(ico[6]).toBe(0); // width byte
    expect(ico[7]).toBe(0); // height byte
    expect(parseIcoHeader(ico)!.entries[0].width).toBe(256);
  });

  it('rejects impossible inputs', () => {
    expect(() => buildIco([])).toThrow();
    expect(() => buildIco([{ size: 0, png: fakePng(10) }])).toThrow();
    expect(() => buildIco([{ size: 512, png: fakePng(10) }])).toThrow();
  });

  it('rejects data that is not an ICO', () => {
    expect(parseIcoHeader(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(parseIcoHeader(new Uint8Array(20))).toBeNull(); // type field is 0
  });
});

/* ════════════════════════════ QUANTISATION ══════════════════════════════ */

describe('quantize', () => {
  /** A smooth gradient: the hard case, since every pixel differs slightly. */
  function gradient(width: number, height: number): Uint8ClampedArray {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = Math.round((x / width) * 255);
        data[i + 1] = Math.round((y / height) * 255);
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    return data;
  }

  it('reduces a gradient to at most the requested palette size', () => {
    const data = gradient(64, 64);
    expect(countDistinctColors(data)).toBeGreaterThan(256);

    const result = quantize(data, 64, 64, { maxColors: 32, dither: false });

    expect(result.palette.length).toBeLessThanOrEqual(32);
    expect(countDistinctColors(result.data)).toBeLessThanOrEqual(32);
    expect(result.originalColors).toBeGreaterThan(256);
  });

  it('keeps fully transparent pixels fully transparent', () => {
    const width = 32;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      const transparent = i % 3 === 0;
      data[o] = 200; data[o + 1] = 60; data[o + 2] = 90;
      data[o + 3] = transparent ? 0 : 255;
    }

    const result = quantize(data, width, height, { maxColors: 16, dither: false });

    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      if (i % 3 === 0) {
        expect(result.data[o + 3], `pixel ${i} should stay transparent`).toBe(0);
      } else {
        expect(result.data[o + 3], `pixel ${i} should stay opaque`).toBeGreaterThan(0);
      }
    }
  });

  it('passes an already-simple image through untouched', () => {
    const width = 16;
    const height = 16;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      const flat = i % 2 === 0 ? 255 : 0;
      data[o] = flat; data[o + 1] = flat; data[o + 2] = flat; data[o + 3] = 255;
    }

    const result = quantize(data, width, height, { maxColors: 256, dither: false });
    expect(Array.from(result.data)).toEqual(Array.from(data));
  });

  it('stays within the palette when dithering', () => {
    const data = gradient(48, 48);
    const result = quantize(data, 48, 48, { maxColors: 16, dither: true });

    // Dithering must only ever pick existing palette entries; it may not
    // invent intermediate colours.
    expect(countDistinctColors(result.data)).toBeLessThanOrEqual(16);
  });

  it('keeps error bounded — the result must still resemble the input', () => {
    const width = 48;
    const height = 48;
    const data = gradient(width, height);
    const result = quantize(data, width, height, { maxColors: 64, dither: false });

    let totalError = 0;
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      totalError +=
        Math.abs(data[o] - result.data[o]) +
        Math.abs(data[o + 1] - result.data[o + 1]) +
        Math.abs(data[o + 2] - result.data[o + 2]);
    }
    const meanError = totalError / (width * height * 3);

    // With 64 colours on a two-axis gradient, mean per-channel error should be
    // small. A regression that broke the cut would blow straight through this.
    expect(meanError).toBeLessThan(12);
  });

  it('honours the palette floor of 2 colours', () => {
    const data = gradient(32, 32);
    const result = quantize(data, 32, 32, { maxColors: 1, dither: false });
    expect(result.palette.length).toBeGreaterThanOrEqual(1);
    expect(result.palette.length).toBeLessThanOrEqual(2);
  });
});
