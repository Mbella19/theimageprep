/** File naming, reading and download helpers shared by every tool. */

import { EXTENSION_BY_FORMAT, type ImageFormat } from './imageTypes';

export function readFileAsArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/** "holiday.HEIC" + jpeg -> "holiday.jpg" */
export function withExtension(name: string, format: ImageFormat): string {
  return `${stemOf(name)}.${EXTENSION_BY_FORMAT[format]}`;
}

/** "photo.jpg" + "-compressed" -> "photo-compressed.jpg" */
export function withSuffix(name: string, suffix: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return name + suffix;
  return name.slice(0, dot) + suffix + name.slice(dot);
}

export function stemOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Strips characters that break downloads or ZIP entries on some systems. */
export function safeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Sanitises a ZIP entry path while KEEPING its folder separators.
 *
 * `safeFileName` replaces `/` with `-`, which is correct for a download
 * filename and wrong for an archive path — it silently flattens
 * `instagram/photo.jpg` into `instagram-photo.jpg`. Each segment is cleaned
 * individually here instead.
 */
export function safeZipPath(path: string): string {
  return path
    .split('/')
    .map((segment) => safeFileName(segment))
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before revoking the URL;
  // revoking immediately cancels it in some versions of Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  downloadBlob(new Blob([bytes as unknown as BlobPart], { type: mime }), filename);
}

/**
 * Pulls image files out of a drag-and-drop or paste event.
 * Accepts anything that looks like an image, plus HEIC, which many systems
 * report with an empty or generic MIME type.
 */
export function isProbablyImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = extensionOf(file.name);
  return ['heic', 'heif', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'tif', 'tiff'].includes(ext);
}

export function formatDimensions(width: number, height: number): string {
  return `${width.toLocaleString()} x ${height.toLocaleString()}`;
}

/** Greatest common divisor, used to display an aspect ratio as 16:9 not 1.777. */
export function aspectRatioLabel(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;
  // Ratios like 1273:717 tell nobody anything; fall back to a decimal.
  if (w > 40 || h > 40) return `${(width / height).toFixed(2)}:1`;
  return `${w}:${h}`;
}
