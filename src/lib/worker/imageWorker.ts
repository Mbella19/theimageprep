/// <reference lib="webworker" />
/**
 * The image worker.
 *
 * All decoding, transforming and encoding happens here rather than on the main
 * thread. MozJPEG encoding in particular is heavy enough to freeze a tab
 * completely, which would make every slider on the site feel broken.
 *
 * Codecs are imported dynamically so a page only downloads the WebAssembly it
 * actually needs: opening the PNG compressor never fetches the JPEG encoder,
 * and the ~2MB HEIC decoder is fetched only when someone drops a HEIC file.
 */
import type {
  JobRequest,
  JobResult,
  JobResultOk,
  Operation,
  OutputSpec,
  Rgba,
  JobSource,
} from '../imageTypes';
import { detectFormat } from '../sniff';
import { readJpegOrientation } from '../metadata/jpeg';
import { applyOrientation } from '../orientation';
import { quantize } from '../quantize';
import { encodeToTargetSize } from '../targetSize';

/* ═══════════════════════════════ DECODE ═════════════════════════════════ */

function bitmapToImageData(bitmap: ImageBitmap): ImageData {
  //
  // Capture the dimensions BEFORE closing. `ImageBitmap.close()` sets width and
  // height to 0 per spec, so reading `bitmap.width` afterwards yields 0 and
  // getImageData throws — which silently pushed every single image onto the
  // WASM fallback decoder below, and that decoder does not apply EXIF
  // orientation. Portrait phone photos came out sideways as a result.
  //
  const { width, height } = bitmap;
  if (width === 0 || height === 0) {
    throw new Error('Image decoded to zero dimensions.');
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create a drawing context');

  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, width, height);
  bitmap.close();
  return data;
}

async function decodeEncoded(bytes: ArrayBuffer, mime: string): Promise<ImageData> {
  const u8 = new Uint8Array(bytes);
  const format = detectFormat(u8);

  // ── HEIC: no browser decodes this natively outside Apple platforms ───────
  if (format === 'heic') {
    const { heicTo } = await import('heic-to');
    const bitmap = await heicTo({
      blob: new Blob([u8], { type: 'image/heic' }),
      type: 'bitmap',
      options: { imageOrientation: 'from-image' },
    });
    return bitmapToImageData(bitmap);
  }

  // ── Everything else: the browser's own decoder is fastest ────────────────
  try {
    const blob = new Blob([u8], { type: mime || 'application/octet-stream' });
    //
    // `imageOrientation: 'from-image'` is the single most important option on
    // this site. Phone cameras do not rotate the pixels they store; they record
    // an EXIF orientation tag and leave the image on its side. Without this
    // flag the browser hands back the raw, sideways pixels — which is exactly
    // why so many online image tools return rotated photos.
    //
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return bitmapToImageData(bitmap);
  } catch (error) {
    // Never swallow this silently. A bug in the fast path used to land here
    // unnoticed and quietly degrade every decode on the site.
    console.warn('[imageWorker] browser decode failed, using WASM fallback:', error);
  }

  // ── Fallbacks for formats or edge cases the browser refused ──────────────
  switch (format) {
    case 'jpeg': {
      const decode = (await import('@jsquash/jpeg/decode')).default;
      const decoded = await decode(bytes);
      // MozJPEG hands back the stored pixels. Apply the EXIF rotation ourselves
      // rather than trusting a flag, so this path matches the fast path exactly.
      return orientImageData(decoded, readJpegOrientation(u8));
    }
    case 'png': {
      const decode = (await import('@jsquash/png/decode')).default;
      return decode(bytes);
    }
    case 'webp': {
      const decode = (await import('@jsquash/webp/decode')).default;
      return decode(bytes);
    }
    default:
      throw new Error(
        'This file could not be read as an image. It may be corrupt, or in a format this browser does not support.',
      );
  }
}

/** Wraps the pure transform in `../orientation` back into an ImageData. */
function orientImageData(image: ImageData, orientation: number): ImageData {
  if (orientation <= 1) return image;
  const result = applyOrientation(
    { data: image.data, width: image.width, height: image.height },
    orientation,
  );
  return new ImageData(result.data, result.width, result.height);
}

async function decodeSource(source: JobSource): Promise<ImageData> {
  if (source.kind === 'raw') {
    return new ImageData(
      new Uint8ClampedArray(source.data),
      source.width,
      source.height,
    );
  }
  return decodeEncoded(source.bytes, source.mime);
}

/* ══════════════════════════════ OPERATIONS ══════════════════════════════ */

function cropImageData(img: ImageData, x: number, y: number, w: number, h: number): ImageData {
  const sx = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const sw = Math.max(1, Math.min(img.width - sx, Math.round(w)));
  const sh = Math.max(1, Math.min(img.height - sy, Math.round(h)));

  const out = new Uint8ClampedArray(sw * sh * 4);
  for (let row = 0; row < sh; row++) {
    const from = ((sy + row) * img.width + sx) * 4;
    out.set(img.data.subarray(from, from + sw * 4), row * sw * 4);
  }
  return new ImageData(out, sw, sh);
}

/** Centres `img` on a `w` x `h` canvas filled with `background`. */
function padImageData(img: ImageData, w: number, h: number, background: Rgba): ImageData {
  const out = new Uint8ClampedArray(w * h * 4);

  if (background.a > 0) {
    for (let i = 0; i < out.length; i += 4) {
      out[i] = background.r;
      out[i + 1] = background.g;
      out[i + 2] = background.b;
      out[i + 3] = background.a;
    }
  }

  const offsetX = Math.floor((w - img.width) / 2);
  const offsetY = Math.floor((h - img.height) / 2);

  for (let row = 0; row < img.height; row++) {
    const destY = offsetY + row;
    if (destY < 0 || destY >= h) continue;
    const from = row * img.width * 4;
    const copyWidth = Math.min(img.width, w - Math.max(0, offsetX));
    if (copyWidth <= 0) continue;
    out.set(
      img.data.subarray(from, from + copyWidth * 4),
      (destY * w + Math.max(0, offsetX)) * 4,
    );
  }

  return new ImageData(out, w, h);
}

async function scaleTo(
  img: ImageData,
  width: number,
  height: number,
  method: string,
): Promise<ImageData> {
  if (img.width === width && img.height === height) return img;
  const resize = (await import('@jsquash/resize')).default;
  return resize(img, {
    width,
    height,
    method: method as 'lanczos3',
    fitMethod: 'stretch',
    premultiply: true,
    linearRGB: true,
  });
}

async function applyResize(
  img: ImageData,
  op: Extract<Operation, { type: 'resize' }>,
): Promise<ImageData> {
  const targetW = Math.max(1, Math.round(op.width));
  const targetH = Math.max(1, Math.round(op.height));
  const method = op.method ?? 'lanczos3';

  if (op.fit === 'stretch') {
    return scaleTo(img, targetW, targetH, method);
  }

  const scale =
    op.fit === 'fill'
      ? Math.max(targetW / img.width, targetH / img.height)
      : Math.min(targetW / img.width, targetH / img.height);

  const scaledW = Math.max(1, Math.round(img.width * scale));
  const scaledH = Math.max(1, Math.round(img.height * scale));
  const scaled = await scaleTo(img, scaledW, scaledH, method);

  if (op.fit === 'fill') {
    // Cover the box, then trim the overflow from the centre.
    return cropImageData(
      scaled,
      (scaledW - targetW) / 2,
      (scaledH - targetH) / 2,
      targetW,
      targetH,
    );
  }

  // 'fit': the whole image is inside the box; pad out to the exact size.
  return padImageData(scaled, targetW, targetH, op.background ?? { r: 255, g: 255, b: 255, a: 0 });
}

/** Composites over a solid colour, which is how transparency becomes JPEG-safe. */
function flatten(img: ImageData, background: Rgba): ImageData {
  const out = new Uint8ClampedArray(img.data.length);
  const { r: br, g: bg, b: bb } = background;

  for (let i = 0; i < img.data.length; i += 4) {
    const alpha = img.data[i + 3] / 255;
    const inv = 1 - alpha;
    out[i] = img.data[i] * alpha + br * inv;
    out[i + 1] = img.data[i + 1] * alpha + bg * inv;
    out[i + 2] = img.data[i + 2] * alpha + bb * inv;
    out[i + 3] = 255;
  }
  return new ImageData(out, img.width, img.height);
}

/** Masks to a centred circle with a smooth edge, for avatars. */
function circleMask(
  img: ImageData,
  borderWidth = 0,
  borderColor: Rgba = { r: 255, g: 255, b: 255, a: 255 },
): ImageData {
  const { width, height } = img;
  const out = new Uint8ClampedArray(img.data);
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = Math.max(0, outerRadius - borderWidth);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Sample from the pixel centre so the edge lands where the eye expects.
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > outerRadius) {
        out[i + 3] = 0;
        continue;
      }

      // One-pixel feather at the rim, otherwise the circle looks jagged.
      const edge = outerRadius - dist;
      const alpha = edge >= 1 ? 1 : Math.max(0, edge);

      if (borderWidth > 0 && dist > innerRadius) {
        out[i] = borderColor.r;
        out[i + 1] = borderColor.g;
        out[i + 2] = borderColor.b;
        out[i + 3] = Math.round(borderColor.a * alpha);
      } else {
        out[i + 3] = Math.round(out[i + 3] * alpha);
      }
    }
  }

  return new ImageData(out, width, height);
}

async function applyOps(
  img: ImageData,
  ops: Operation[],
): Promise<{
  image: ImageData;
  /** The image as it was immediately before a quantize op, if one ran. */
  beforeQuantize?: ImageData;
  paletteSize?: number;
  originalColors?: number;
}> {
  let current = img;
  let beforeQuantize: ImageData | undefined;
  let paletteSize: number | undefined;
  let originalColors: number | undefined;

  for (const op of ops) {
    switch (op.type) {
      case 'resize':
        current = await applyResize(current, op);
        break;
      case 'crop':
        current = cropImageData(current, op.x, op.y, op.width, op.height);
        break;
      case 'flatten':
        current = flatten(current, op.background);
        break;
      case 'circle':
        current = circleMask(current, op.borderWidth, op.borderColor);
        break;
      case 'quantize': {
        // Keep the pre-quantised pixels so the encoder can check whether
        // colour reduction actually helped — on smooth gradients, dither noise
        // can make the file substantially LARGER than lossless.
        beforeQuantize = current;
        const result = quantize(current.data, current.width, current.height, {
          maxColors: op.maxColors,
          dither: op.dither,
        });
        current = new ImageData(result.data, current.width, current.height);
        paletteSize = result.palette.length;
        originalColors = result.originalColors;
        break;
      }
    }
  }

  return { image: current, beforeQuantize, paletteSize, originalColors };
}

/* ═══════════════════════════════ ENCODE ═════════════════════════════════ */

async function encodeJpeg(img: ImageData, quality: number): Promise<Uint8Array> {
  const encode = (await import('@jsquash/jpeg/encode')).default;
  return new Uint8Array(await encode(img, { quality }));
}

async function encodeWebp(
  img: ImageData,
  quality: number,
  lossless: boolean,
): Promise<Uint8Array> {
  const encode = (await import('@jsquash/webp/encode')).default;
  return new Uint8Array(
    await encode(img, { quality, lossless: lossless ? 1 : 0 }),
  );
}

async function encodePng(img: ImageData, level: number): Promise<Uint8Array> {
  const optimise = (await import('@jsquash/oxipng/optimise')).default;
  // oxipng can encode straight from raw pixels, skipping a separate PNG encode.
  return new Uint8Array(await optimise(img, { level, optimiseAlpha: true }));
}

async function optimiseExistingPng(bytes: ArrayBuffer, level: number): Promise<Uint8Array> {
  const optimise = (await import('@jsquash/oxipng/optimise')).default;
  return new Uint8Array(await optimise(bytes, { level, optimiseAlpha: true }));
}

/* ════════════════════════════════ JOBS ══════════════════════════════════ */

async function runJob(job: JobRequest): Promise<JobResultOk> {
  const { source, ops, output } = job;

  //
  // FAST PATH: losslessly optimising a PNG that needs no transformation.
  // Decoding to RGBA and re-encoding would throw away an existing indexed
  // palette and could make the file LARGER. Handing the original bytes to
  // oxipng keeps the image bit-for-bit identical and usually smaller.
  //
  if (
    ops.length === 0 &&
    output.format === 'png' &&
    source.kind === 'encoded' &&
    detectFormat(new Uint8Array(source.bytes)) === 'png'
  ) {
    const optimised = await optimiseExistingPng(source.bytes, output.optimiseLevel ?? 3);
    // A pathological image can come back larger; never hand back the worse one.
    const best =
      optimised.length < source.bytes.byteLength
        ? optimised
        : new Uint8Array(source.bytes);

    const decoded = await decodeEncoded(source.bytes, 'image/png');
    return {
      id: job.id,
      ok: true,
      bytes: toTransferable(best),
      width: decoded.width,
      height: decoded.height,
    };
  }

  const decoded = await decodeSource(source);
  const { image, beforeQuantize, paletteSize, originalColors } = await applyOps(decoded, ops);

  if (output.format === 'raw') {
    return {
      id: job.id,
      ok: true,
      raw: {
        data: image.data.buffer as ArrayBuffer,
        width: image.width,
        height: image.height,
      },
      width: image.width,
      height: image.height,
      paletteSize,
      originalColors,
    };
  }

  if (output.format === 'png') {
    const level = output.optimiseLevel ?? 3;
    let bytes = await encodePng(image, level);
    let usedQuantization = beforeQuantize !== undefined;

    //
    // Colour reduction is not always a win. Dithering converts smooth gradients
    // into fine noise, and noise is what DEFLATE compresses worst — on a
    // gradient the quantised file can come out MANY times larger than plain
    // lossless optimisation of the same image.
    //
    // So when quantisation ran, encode the un-quantised pixels too and keep
    // whichever is genuinely smaller. Handing back a worse file because the
    // user picked the wrong mode is exactly the behaviour this site exists to
    // avoid.
    //
    if (beforeQuantize) {
      const candidates: Uint8Array[] = [await encodePng(beforeQuantize, level)];

      // When quantisation was the ONLY change requested and the source is
      // already a PNG, the original bytes are also a valid candidate — and
      // usually the best one, because oxipng can rework the existing filters
      // and bit depth rather than starting again from flat RGBA.
      const onlyQuantized = ops.length === 1 && ops[0].type === 'quantize';
      if (
        onlyQuantized &&
        source.kind === 'encoded' &&
        detectFormat(new Uint8Array(source.bytes)) === 'png'
      ) {
        candidates.push(await optimiseExistingPng(source.bytes, level));
      }

      for (const candidate of candidates) {
        if (candidate.length < bytes.length) {
          bytes = candidate;
          usedQuantization = false;
        }
      }
    }

    return {
      id: job.id,
      ok: true,
      bytes: toTransferable(bytes),
      width: image.width,
      height: image.height,
      paletteSize: usedQuantization ? paletteSize : undefined,
      originalColors,
      usedQuantization,
    };
  }

  const encodeAt = (quality: number): Promise<Uint8Array> =>
    output.format === 'jpeg'
      ? encodeJpeg(image, quality)
      : encodeWebp(image, quality, output.lossless ?? false);

  // Target-size mode: search for the best quality that fits the budget.
  if (output.targetBytes && output.targetBytes > 0 && !output.lossless) {
    const result = await encodeToTargetSize(encodeAt, {
      targetBytes: output.targetBytes,
      minQuality: output.minQuality ?? 20,
    });
    return {
      id: job.id,
      ok: true,
      bytes: toTransferable(result.bytes),
      width: image.width,
      height: image.height,
      quality: result.quality,
      iterations: result.iterations,
      reachedTarget: result.reachedTarget,
      paletteSize,
      originalColors,
    };
  }

  const quality = output.quality ?? 80;
  const bytes = await encodeAt(quality);
  return {
    id: job.id,
    ok: true,
    bytes: toTransferable(bytes),
    width: image.width,
    height: image.height,
    quality,
    paletteSize,
    originalColors,
  };
}

/** Produces a standalone ArrayBuffer safe to transfer to the main thread. */
function toTransferable(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.slice().buffer;
}

self.onmessage = async (event: MessageEvent<JobRequest>) => {
  const job = event.data;
  try {
    const result = await runJob(job);

    const transfers: Transferable[] = [];
    if (result.bytes) transfers.push(result.bytes);
    if (result.raw) transfers.push(result.raw.data);

    (self as unknown as Worker).postMessage(result, transfers);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Something went wrong processing this image.';
    const failure: JobResult = { id: job.id, ok: false, error: message };
    (self as unknown as Worker).postMessage(failure);
  }
};
