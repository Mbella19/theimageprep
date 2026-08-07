/**
 * EXIF orientation transforms.
 *
 * Phone cameras do not rotate the pixels they capture. They store the frame as
 * the sensor saw it and record an orientation tag saying which way up it should
 * be displayed. Anything that decodes without honouring that tag produces
 * sideways photos — the single most common bug in online image tools.
 *
 * The browser's own decoder handles this via `imageOrientation: 'from-image'`.
 * This module exists for the WASM fallback path, which returns raw stored
 * pixels, and it is kept free of DOM types so it can be unit tested.
 *
 *   1 normal      2 flip horizontal   3 rotate 180     4 flip vertical
 *   5 transpose   6 rotate 90 CW      7 transverse     8 rotate 270 CW
 */

export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** True for orientations that swap the width and height. */
export function orientationSwapsAxes(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

export function applyOrientation(image: PixelBuffer, orientation: number): PixelBuffer {
  if (orientation <= 1 || orientation > 8) return image;

  const { width: w, height: h, data } = image;
  const swap = orientationSwapsAxes(orientation);
  const outW = swap ? h : w;
  const outH = swap ? w : h;
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx: number;
      let ny: number;

      switch (orientation) {
        case 2: nx = w - 1 - x; ny = y; break;
        case 3: nx = w - 1 - x; ny = h - 1 - y; break;
        case 4: nx = x; ny = h - 1 - y; break;
        case 5: nx = y; ny = x; break;
        case 6: nx = h - 1 - y; ny = x; break;
        case 7: nx = h - 1 - y; ny = w - 1 - x; break;
        case 8: nx = y; ny = w - 1 - x; break;
        default: nx = x; ny = y;
      }

      const from = (y * w + x) * 4;
      const to = (ny * outW + nx) * 4;
      out[to] = data[from];
      out[to + 1] = data[from + 1];
      out[to + 2] = data[from + 2];
      out[to + 3] = data[from + 3];
    }
  }

  return { data: out, width: outW, height: outH };
}
