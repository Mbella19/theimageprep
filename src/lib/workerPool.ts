/**
 * A small pool of image workers.
 *
 * Batch jobs — forty holiday photos dropped onto the HEIC converter — fan out
 * across several cores instead of crawling through one at a time. Workers are
 * created lazily, so a visitor who processes a single file never pays to spin
 * up four of them.
 *
 * Capped at four regardless of core count: each worker holds its own copy of
 * the decoded image plus its own WASM instance, and memory, not CPU, is what
 * actually kills a browser tab on large batches.
 */
import type { JobRequest, JobResult, JobResultOk, OutputSpec, Operation } from './imageTypes';

const MAX_WORKERS = 4;

interface PendingJob {
  request: JobRequest;
  resolve: (result: JobResultOk) => void;
  reject: (error: Error) => void;
}

export class ImagePool {
  private readonly size: number;
  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly queue: PendingJob[] = [];
  private readonly inFlight = new Map<number, PendingJob>();
  private nextId = 1;
  private destroyed = false;

  constructor(size?: number) {
    const cores =
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 2;
    this.size = Math.max(1, Math.min(size ?? cores, MAX_WORKERS));
  }

  private spawn(): Worker {
    const worker = new Worker(new URL('./worker/imageWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<JobResult>) => {
      const result = event.data;
      const pending = this.inFlight.get(result.id);
      this.inFlight.delete(result.id);

      if (pending) {
        if (result.ok) pending.resolve(result);
        else pending.reject(new Error(result.error));
      }

      this.idle.push(worker);
      this.drain();
    };

    worker.onerror = (event) => {
      // A worker-level failure kills whatever it was running. Fail that job
      // rather than leaving the caller waiting forever on a promise.
      for (const [id, pending] of this.inFlight) {
        pending.reject(new Error(event.message || 'The image worker stopped unexpectedly.'));
        this.inFlight.delete(id);
      }
      this.idle.push(worker);
      this.drain();
    };

    this.workers.push(worker);
    return worker;
  }

  private drain(): void {
    while (this.queue.length > 0) {
      let worker = this.idle.pop();
      if (!worker) {
        if (this.workers.length >= this.size) return; // all busy; wait
        worker = this.spawn();
      }

      const job = this.queue.shift();
      if (!job) {
        this.idle.push(worker);
        return;
      }

      this.inFlight.set(job.request.id, job);

      // Transferring moves the buffer instead of copying it, which matters a
      // lot when the buffer is a 40 megapixel image.
      const transfers: Transferable[] =
        job.request.source.kind === 'encoded'
          ? [job.request.source.bytes]
          : [job.request.source.data];

      worker.postMessage(job.request, transfers);
    }
  }

  run(source: JobRequest['source'], ops: Operation[], output: OutputSpec): Promise<JobResultOk> {
    if (this.destroyed) return Promise.reject(new Error('This image pool has been destroyed.'));

    const request: JobRequest = { id: this.nextId++, source, ops, output };

    return new Promise<JobResultOk>((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.drain();
    });
  }

  destroy(): void {
    this.destroyed = true;
    for (const worker of this.workers) worker.terminate();
    this.workers.length = 0;
    this.idle.length = 0;
    for (const pending of this.inFlight.values()) {
      pending.reject(new Error('Cancelled.'));
    }
    this.inFlight.clear();
    this.queue.length = 0;
  }
}

/**
 * Shared pool for the page. Tools use this rather than each creating their own,
 * so switching between controls does not respawn workers and re-download WASM.
 */
let sharedPool: ImagePool | null = null;

export function getImagePool(): ImagePool {
  if (!sharedPool) sharedPool = new ImagePool();
  return sharedPool;
}
