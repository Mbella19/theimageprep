import { describe, it, expect } from 'vitest';
import { pickToolForFormat, reasonForFormat } from '../src/lib/pickTool';
import { TOOLS } from '../src/data/tools';
import type { DetectedFormat } from '../src/lib/sniff';

const ALL: DetectedFormat[] = [
  'jpeg',
  'png',
  'webp',
  'heic',
  'gif',
  'bmp',
  'avif',
  'tiff',
  'unknown',
];

describe('pickToolForFormat', () => {
  it('sends a HEIC to the converter, not a compressor', () => {
    // Nobody opens a HEIC because it is too big — they open it because
    // nothing outside an Apple device will display it.
    expect(pickToolForFormat('heic')).toBe('heic-to-jpg');
  });

  it('routes each compressible format to its own compressor', () => {
    expect(pickToolForFormat('jpeg')).toBe('compress-jpg');
    expect(pickToolForFormat('png')).toBe('compress-png');
    expect(pickToolForFormat('webp')).toBe('compress-webp');
  });

  it('falls back to resize for formats with no dedicated page', () => {
    for (const format of ['gif', 'bmp', 'avif', 'tiff', 'unknown'] as DetectedFormat[]) {
      expect(pickToolForFormat(format)).toBe('resize-image');
    }
  });

  /**
   * The whole point of the homepage dropzone is that it always lands you
   * somewhere real. A slug that does not exist would 404 a visitor who has
   * just handed over a file, which is the worst possible moment to fail.
   */
  it('only ever returns a slug that exists in the registry', () => {
    const slugs = new Set(TOOLS.map((t) => t.slug));
    for (const format of ALL) {
      expect(slugs.has(pickToolForFormat(format))).toBe(true);
    }
  });

  it('is total — every format produces a destination and an explanation', () => {
    for (const format of ALL) {
      expect(pickToolForFormat(format)).toBeTruthy();
      expect(reasonForFormat(format).length).toBeGreaterThan(0);
    }
  });
});
