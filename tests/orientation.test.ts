import { describe, it, expect } from 'vitest';
import { applyOrientation, orientationSwapsAxes } from '../src/lib/orientation';
import { readJpegOrientation } from '../src/lib/metadata/jpeg';
import { fixture } from './helpers';

/**
 * These lock down the site's most visible claim: phone photos do not come out
 * sideways. A regression here is exactly the bug that shipped once already —
 * silently, because the broken path fell back to a decoder that ignores the
 * orientation tag.
 */

/** 3x2 grid where every pixel encodes its own coordinates, so any transform is checkable. */
function grid(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = x * 10;
      data[i + 1] = y * 10;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const at = (img: { data: Uint8ClampedArray; width: number }, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1]];
};

describe('EXIF orientation transforms', () => {
  it('knows which orientations swap the axes', () => {
    for (const o of [1, 2, 3, 4]) expect(orientationSwapsAxes(o)).toBe(false);
    for (const o of [5, 6, 7, 8]) expect(orientationSwapsAxes(o)).toBe(true);
  });

  it('leaves orientation 1 untouched', () => {
    const source = grid(3, 2);
    const result = applyOrientation(source, 1);
    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
    expect(Array.from(result.data)).toEqual(Array.from(source.data));
  });

  it('swaps width and height for orientations 5-8', () => {
    for (const o of [5, 6, 7, 8]) {
      const result = applyOrientation(grid(4, 2), o);
      expect(result.width, `orientation ${o}`).toBe(2);
      expect(result.height, `orientation ${o}`).toBe(4);
    }
  });

  it('keeps dimensions for orientations 2-4', () => {
    for (const o of [2, 3, 4]) {
      const result = applyOrientation(grid(4, 2), o);
      expect(result.width, `orientation ${o}`).toBe(4);
      expect(result.height, `orientation ${o}`).toBe(2);
    }
  });

  it('rotates 90 degrees clockwise for orientation 6', () => {
    // Source 3x2. Under a 90° CW rotation the top-left pixel moves to the
    // top-right, and the source's bottom-left becomes the new top-left.
    const source = grid(3, 2);
    const result = applyOrientation(source, 6);

    expect([result.width, result.height]).toEqual([2, 3]);
    // source (0,0) → dest (h-1-0, 0) = (1, 0)
    expect(at(result, 1, 0)).toEqual(at(source, 0, 0));
    // source (0,1) → dest (h-1-1, 0) = (0, 0)
    expect(at(result, 0, 0)).toEqual(at(source, 0, 1));
    // source (2,0) → dest (1, 2)
    expect(at(result, 1, 2)).toEqual(at(source, 2, 0));
  });

  it('rotates 270 degrees clockwise for orientation 8', () => {
    const source = grid(3, 2);
    const result = applyOrientation(source, 8);
    expect([result.width, result.height]).toEqual([2, 3]);
    // source (0,0) → dest (0, w-1-0) = (0, 2)
    expect(at(result, 0, 2)).toEqual(at(source, 0, 0));
  });

  it('flips horizontally for orientation 2', () => {
    const source = grid(3, 2);
    const result = applyOrientation(source, 2);
    expect(at(result, 2, 0)).toEqual(at(source, 0, 0));
    expect(at(result, 0, 0)).toEqual(at(source, 2, 0));
  });

  it('rotates 180 for orientation 3', () => {
    const source = grid(3, 2);
    const result = applyOrientation(source, 3);
    expect(at(result, 2, 1)).toEqual(at(source, 0, 0));
    expect(at(result, 0, 0)).toEqual(at(source, 2, 1));
  });

  it('is reversible: 6 then 8 returns the original', () => {
    const source = grid(4, 3);
    const there = applyOrientation(source, 6);
    const back = applyOrientation(there, 8);
    expect([back.width, back.height]).toEqual([4, 3]);
    expect(Array.from(back.data)).toEqual(Array.from(source.data));
  });

  it('ignores out-of-range values rather than corrupting the image', () => {
    for (const o of [0, -1, 9, 99, Number.NaN]) {
      const result = applyOrientation(grid(3, 2), o);
      expect(result.width).toBe(3);
      expect(result.height).toBe(2);
    }
  });
});

describe('readJpegOrientation', () => {
  it('reads the tag from a rotated fixture', () => {
    expect(readJpegOrientation(fixture('photo-rotated.jpg'))).toBe(6);
  });

  it('returns 1 when there is no orientation tag', () => {
    expect(readJpegOrientation(fixture('photo-plain.jpg'))).toBe(1);
  });

  it('returns 1 for a file that is not a JPEG', () => {
    expect(readJpegOrientation(fixture('graphic-plain.png'))).toBe(1);
    expect(readJpegOrientation(new Uint8Array([1, 2, 3]))).toBe(1);
  });
});
