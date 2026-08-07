/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Cross-page file handoff.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  The homepage has one dropzone for everything: you drop a file, it works out
 *  which tool you need, and sends you there with the file already loaded. That
 *  means carrying a `File` across a page navigation.
 *
 *  IndexedDB, not sessionStorage. sessionStorage only stores strings, so a 4 MB
 *  photo would have to be base64-encoded — roughly 5.5 MB of string, slow to
 *  produce and close to the storage quota. IndexedDB structured-clones a `File`
 *  natively: no copy, no encoding, no size ceiling worth worrying about.
 *
 *  Nothing here leaves the device. IndexedDB is same-origin browser storage,
 *  which is the same privacy position as the rest of the site — but unlike an
 *  in-memory value it *persists*, so the read is destructive and time-limited
 *  (see TTL below). A tool must never silently open a file you dropped an hour
 *  ago on a different page.
 */

const DB_NAME = 'imageprep-handoff';
const STORE = 'pending';
const KEY = 'file';

/**
 * A handoff is only valid for the moment between clicking and the next page
 * painting — normally well under a second. Sixty seconds is generous enough to
 * survive a slow connection and short enough that a forgotten file can never
 * reappear in a later session.
 */
const TTL_MS = 60_000;

interface StashRecord {
  file: File;
  at: number;
}

/** Feature-detect rather than assume. Private-mode Firefox used to throw. */
function hasIdb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIdb()) return Promise.resolve(null);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    // A failure here is not worth surfacing: the caller falls back to sending
    // the visitor to the tool page with an empty dropzone, which still works.
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/** Store a file for the next page to pick up. Resolves false if unavailable. */
export async function stashFile(file: File): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const record: StashRecord = { file, at: Date.now() };
      tx.objectStore(STORE).put(record, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

/**
 * Retrieve and immediately delete the pending file.
 *
 * Destructive by design. If the read left the record in place, opening a
 * second tool in a new tab would silently re-consume a file the visitor
 * already dealt with, which looks like a bug and feels like a privacy leak.
 */
export async function takeFile(): Promise<File | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const get = store.get(KEY);

      get.onsuccess = () => {
        const record = get.result as StashRecord | undefined;
        store.delete(KEY);

        if (!record || !record.file) {
          resolve(null);
          return;
        }
        // Expired handoffs are dropped rather than opened.
        if (Date.now() - record.at > TTL_MS) {
          resolve(null);
          return;
        }
        resolve(record.file);
      };

      get.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/**
 * Marker on the destination URL. Without it every tool page would have to hit
 * IndexedDB on load just to discover there is nothing waiting — a pointless
 * async round trip on the 99% of visits that arrive from search.
 */
export const HANDOFF_PARAM = 'from';
export const HANDOFF_VALUE = 'drop';

export function handoffUrl(slug: string): string {
  return `/${slug}/?${HANDOFF_PARAM}=${HANDOFF_VALUE}`;
}

/** True when the current URL claims a file is waiting. Safe during SSR. */
export function hasPendingHandoff(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(HANDOFF_PARAM) === HANDOFF_VALUE;
}
