import type { DetectedFormat } from './sniff';

/**
 * Which tool does someone want when they drop a file on the homepage?
 *
 * Pure, so it can be tested without a browser. The mapping is a judgement
 * about intent, not a technical constraint — every tool accepts every format.
 * It is chosen from what the format itself implies about the problem:
 *
 *   HEIC   Nobody drops a HEIC because it is too big. They drop it because
 *          nothing outside an Apple device will open it. Convert, don't
 *          compress.
 *   JPEG   Already a compressed photo. The reason it is in front of you is
 *          almost always that something rejected it for size.
 *   PNG    Same, but PNG needs its own compressor: it is usually a screenshot
 *          or a graphic, where JPEG's ringing around text is very visible.
 *   WebP   Already an optimised web format, so the remaining reason to open
 *          one is to squeeze it further.
 *   Other  GIF, BMP, TIFF and AVIF have no dedicated page. Resize accepts any
 *          input and re-encodes to a normal format, which is the most useful
 *          landing spot rather than a dead end.
 */
export function pickToolForFormat(format: DetectedFormat): string {
  switch (format) {
    case 'heic':
      return 'heic-to-jpg';
    case 'jpeg':
      return 'compress-jpg';
    case 'png':
      return 'compress-png';
    case 'webp':
      return 'compress-webp';
    default:
      return 'resize-image';
  }
}

/** Short line explaining the choice, shown while the handoff happens. */
export function reasonForFormat(format: DetectedFormat): string {
  switch (format) {
    case 'heic':
      return 'iPhone photo — converting to JPG';
    case 'jpeg':
      return 'JPEG — opening the compressor';
    case 'png':
      return 'PNG — opening the PNG compressor';
    case 'webp':
      return 'WebP — opening the WebP compressor';
    default:
      return 'Opening the resizer';
  }
}
