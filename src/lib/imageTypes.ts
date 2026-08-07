/**
 * Types shared between the main thread and the image worker.
 *
 * Kept free of any DOM or worker-only references so both sides can import it.
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type OutputFormat = ImageFormat | 'raw';

export type FitMode = 'fit' | 'fill' | 'stretch';

export type ResizeMethod =
  | 'lanczos3'
  | 'mitchell'
  | 'catrom'
  | 'triangle'
  | 'magicKernelSharp2021';

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface RawImage {
  /** RGBA bytes */
  data: ArrayBuffer;
  width: number;
  height: number;
}

export type JobSource =
  | { kind: 'encoded'; bytes: ArrayBuffer; mime: string }
  /** Already-decoded pixels, e.g. composited on a canvas by the main thread. */
  | { kind: 'raw'; data: ArrayBuffer; width: number; height: number };

export type Operation =
  | {
      type: 'resize';
      width: number;
      height: number;
      fit: FitMode;
      method?: ResizeMethod;
      /** Fill colour for the letterboxed area in 'fit' mode. */
      background?: Rgba;
    }
  | { type: 'crop'; x: number; y: number; width: number; height: number }
  /** Composites onto a solid colour, removing the alpha channel. */
  | { type: 'flatten'; background: Rgba }
  | { type: 'quantize'; maxColors: number; dither: boolean }
  /** Masks to a centred circle, leaving the corners transparent. */
  | { type: 'circle'; borderWidth?: number; borderColor?: Rgba };

export interface OutputSpec {
  format: OutputFormat;
  /** 1-100. Ignored when targetBytes is set, or for png/raw. */
  quality?: number;
  /** Search for the best quality that fits under this many bytes. */
  targetBytes?: number;
  /** Floor for the target-size search. */
  minQuality?: number;
  /** WebP only. */
  lossless?: boolean;
  /** PNG only. oxipng level 1-6; above 4 gives little for a lot of time. */
  optimiseLevel?: number;
}

export interface JobRequest {
  id: number;
  source: JobSource;
  ops: Operation[];
  output: OutputSpec;
}

export interface JobResultOk {
  id: number;
  ok: true;
  /** Present unless output.format === 'raw'. */
  bytes?: ArrayBuffer;
  /** Present when output.format === 'raw'. */
  raw?: RawImage;
  width: number;
  height: number;
  /** Quality actually used, after any target-size search. */
  quality?: number;
  /** Encoder invocations used by the target-size search. */
  iterations?: number;
  /** False when even the minimum quality could not meet targetBytes. */
  reachedTarget?: boolean;
  /** Palette size after a quantize op. Absent when quantisation was discarded. */
  paletteSize?: number;
  /** Distinct colours before quantisation. */
  originalColors?: number;
  /**
   * False when colour reduction was requested but the lossless encoding came
   * out smaller, so the lossless result was kept instead.
   */
  usedQuantization?: boolean;
}

export interface JobResultError {
  id: number;
  ok: false;
  error: string;
}

export type JobResult = JobResultOk | JobResultError;

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const EXTENSION_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};
