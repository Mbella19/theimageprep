import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getImagePool } from '../../lib/workerPool';
import type { JobSource, Operation, OutputSpec, ImageFormat } from '../../lib/imageTypes';
import { MIME_BY_FORMAT } from '../../lib/imageTypes';
import { createZip } from '../../lib/zip';
import { downloadBlob, isProbablyImage, safeFileName } from '../../lib/files';

export type FileStatus = 'pending' | 'working' | 'done' | 'error';

export interface ToolFileResult {
  blob: Blob;
  bytes: Uint8Array;
  width: number;
  height: number;
  quality?: number;
  reachedTarget?: boolean;
  paletteSize?: number;
  originalColors?: number;
  /** False when colour reduction was discarded because lossless was smaller. */
  usedQuantization?: boolean;
  outputName: string;
  previewUrl: string;
}

export interface ToolFile {
  id: string;
  file: File;
  originalSize: number;
  status: FileStatus;
  error?: string;
  result?: ToolFileResult;
  /** Object URL for the ORIGINAL, used by before/after comparisons. */
  sourcePreviewUrl?: string;
  /** Filled in asynchronously once the image has been measured. */
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface JobPlan {
  ops: Operation[];
  output: OutputSpec;
  /** Output file name. */
  name: string;
  /** Overrides the default encoded-file source, e.g. for canvas composites. */
  source?: JobSource;
}

export interface UseImageToolOptions<S> {
  /** Turns a file plus the current settings into a worker job. */
  plan: (file: File, settings: S) => JobPlan | Promise<JobPlan>;
  /** Accept more than one file at a time. */
  multiple?: boolean;
  /** Re-run automatically when settings change and files are already loaded. */
  autoReprocess?: boolean;
  /** Keep an object URL for the original file, for before/after sliders. */
  keepSourcePreview?: boolean;
}

export interface ImageTool<S> {
  files: ToolFile[];
  settings: S;
  setSettings: (updater: S | ((prev: S) => S)) => void;
  addFiles: (incoming: FileList | File[]) => void;
  removeFile: (id: string) => void;
  reset: () => void;
  process: () => void;
  downloadOne: (id: string) => void;
  downloadAll: () => Promise<void>;
  isWorking: boolean;
  /** 0-1 across the whole batch. */
  progress: number;
  doneCount: number;
  totalOriginalBytes: number;
  totalOutputBytes: number;
  zipping: boolean;
}

let idCounter = 0;
const nextId = () => `f${++idCounter}`;

/**
 * Reads an image's dimensions without a full decode in the worker.
 *
 * `imageOrientation: 'from-image'` again: a portrait phone photo is stored
 * landscape with a rotation tag, so without this the tool would offer to resize
 * a 4032x3024 image that the user sees as 3024x4032. Returns null for formats
 * the main thread cannot read, such as HEIC.
 */
async function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export function useImageTool<S extends object>(
  initialSettings: S,
  options: UseImageToolOptions<S>,
): ImageTool<S> {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [settings, setSettingsState] = useState<S>(initialSettings);
  const [isWorking, setIsWorking] = useState(false);
  const [zipping, setZipping] = useState(false);

  // Object URLs must be revoked by hand or the browser holds every processed
  // image in memory for the life of the tab.
  const objectUrls = useRef(new Set<string>());
  // A generation counter so results from a superseded run are discarded rather
  // than overwriting newer ones when settings change mid-flight.
  const runId = useRef(0);
  const filesRef = useRef<ToolFile[]>([]);
  const settingsRef = useRef<S>(initialSettings);

  filesRef.current = files;
  settingsRef.current = settings;

  const trackUrl = useCallback((url: string) => {
    objectUrls.current.add(url);
    return url;
  }, []);

  const releaseUrls = useCallback(() => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  }, []);

  useEffect(() => releaseUrls, [releaseUrls]);

  const runBatch = useCallback(async () => {
    const generation = ++runId.current;
    const targets = filesRef.current;
    if (targets.length === 0) return;

    setIsWorking(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'working' as FileStatus, error: undefined })));

    const pool = getImagePool();

    await Promise.all(
      targets.map(async (entry) => {
        try {
          const jobPlan = await options.plan(entry.file, settingsRef.current);
          // Re-read the file each time: transferring a buffer to a worker
          // neuters it, so a cached copy would be unusable on the second run.
          const source: JobSource =
            jobPlan.source ?? {
              kind: 'encoded',
              bytes: await entry.file.arrayBuffer(),
              mime: entry.file.type,
            };

          const result = await pool.run(source, jobPlan.ops, jobPlan.output);
          if (generation !== runId.current) return; // superseded

          if (!result.bytes) throw new Error('The worker returned no image data.');

          const bytes = new Uint8Array(result.bytes);
          const mime =
            jobPlan.output.format === 'raw'
              ? 'application/octet-stream'
              : MIME_BY_FORMAT[jobPlan.output.format as ImageFormat];
          const blob = new Blob([bytes as unknown as BlobPart], { type: mime });

          const toolResult: ToolFileResult = {
            blob,
            bytes,
            width: result.width,
            height: result.height,
            quality: result.quality,
            reachedTarget: result.reachedTarget,
            paletteSize: result.paletteSize,
            originalColors: result.originalColors,
            usedQuantization: result.usedQuantization,
            outputName: safeFileName(jobPlan.name),
            previewUrl: trackUrl(URL.createObjectURL(blob)),
          };

          setFiles((prev) =>
            prev.map((f) => (f.id === entry.id ? { ...f, status: 'done', result: toolResult } : f)),
          );
        } catch (error) {
          if (generation !== runId.current) return;
          const message =
            error instanceof Error ? error.message : 'This file could not be processed.';
          setFiles((prev) =>
            prev.map((f) => (f.id === entry.id ? { ...f, status: 'error', error: message } : f)),
          );
        }
      }),
    );

    if (generation === runId.current) setIsWorking(false);
  }, [options, trackUrl]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming).filter(isProbablyImage);
      if (list.length === 0) return;

      const limited = options.multiple ? list : list.slice(0, 1);
      const entries: ToolFile[] = limited.map((file) => ({
        id: nextId(),
        file,
        originalSize: file.size,
        status: 'pending',
        sourcePreviewUrl: options.keepSourcePreview
          ? trackUrl(URL.createObjectURL(file))
          : undefined,
      }));

      setFiles((prev) => (options.multiple ? [...prev, ...entries] : entries));

      // Measure in the background. Tools that offer aspect-ratio locking or
      // percentage scaling need the source size before the user touches
      // anything, and it is far cheaper than a full decode in the worker.
      for (const entry of entries) {
        void measureImage(entry.file).then((size) => {
          if (!size) return;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id
                ? { ...f, sourceWidth: size.width, sourceHeight: size.height }
                : f,
            ),
          );
        });
      }
    },
    [options.multiple, options.keepSourcePreview, trackUrl],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    releaseUrls();
    setFiles([]);
    setIsWorking(false);
  }, [releaseUrls]);

  const setSettings = useCallback((updater: S | ((prev: S) => S)) => {
    setSettingsState((prev) =>
      typeof updater === 'function' ? (updater as (p: S) => S)(prev) : updater,
    );
  }, []);

  // ── Trigger 1: new files arrive ──────────────────────────────────────────
  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const runBatchRef = useRef(runBatch);
  runBatchRef.current = runBatch;

  useEffect(() => {
    if (pendingCount > 0) void runBatchRef.current();
  }, [pendingCount]);

  // ── Trigger 2: settings change, for tools with live preview ──────────────
  //
  // Kept separate from trigger 1 on purpose. Combining them would re-fire the
  // moment a run finished — completing a batch changes the pending count, which
  // would immediately schedule another batch, and so on.
  //
  // Serialising settings gives a stable dependency without callers having to
  // memoise the object they pass in.
  const settingsKey = JSON.stringify(settings);
  const isFirstSettings = useRef(true);

  useEffect(() => {
    if (isFirstSettings.current) {
      isFirstSettings.current = false;
      return;
    }
    if (!options.autoReprocess) return;
    if (filesRef.current.length === 0) return;

    // Dragging a quality slider fires a change per pixel of travel. Without a
    // debounce that is dozens of MozJPEG encodes for one gesture.
    const timer = setTimeout(() => void runBatchRef.current(), 250);
    return () => clearTimeout(timer);
  }, [settingsKey, options.autoReprocess]);

  const downloadOne = useCallback(
    (id: string) => {
      const entry = filesRef.current.find((f) => f.id === id);
      if (entry?.result) downloadBlob(entry.result.blob, entry.result.outputName);
    },
    [],
  );

  const downloadAll = useCallback(async () => {
    const done = filesRef.current.filter((f) => f.result);
    if (done.length === 0) return;

    if (done.length === 1) {
      downloadBlob(done[0].result!.blob, done[0].result!.outputName);
      return;
    }

    setZipping(true);
    try {
      const zipBlob = await createZip(
        done.map((f) => ({ name: f.result!.outputName, data: f.result!.bytes })),
      );
      downloadBlob(zipBlob, 'images.zip');
    } finally {
      setZipping(false);
    }
  }, []);

  const doneCount = files.filter((f) => f.status === 'done').length;
  const settledCount = files.filter((f) => f.status === 'done' || f.status === 'error').length;

  return {
    files,
    settings,
    setSettings,
    addFiles,
    removeFile,
    reset,
    process: () => void runBatch(),
    downloadOne,
    downloadAll,
    isWorking,
    progress: files.length ? settledCount / files.length : 0,
    doneCount,
    totalOriginalBytes: files.reduce((sum, f) => sum + f.originalSize, 0),
    totalOutputBytes: files.reduce((sum, f) => sum + (f.result?.bytes.length ?? 0), 0),
    zipping,
  };
}
