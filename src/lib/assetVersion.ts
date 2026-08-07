import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Cache-busting version for the generated brand assets.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Favicons, touch icons and Open Graph cards live at fixed paths — /favicon.ico
 *  has to be at /favicon.ico, and the manifest references icons by name. They
 *  therefore carry no content hash, so a CDN or a browser holding an old copy
 *  has no way to know a new one exists.
 *
 *  This bit us for real: after the rebrand the new favicon deployed correctly
 *  and Cloudflare kept serving the old teal mark for the rest of the day,
 *  because a 24-hour cache is exactly what it had been told to do. The bytes on
 *  disk were right and the site still showed the wrong logo, which is a
 *  genuinely confusing thing to debug.
 *
 *  Appending `?v=<hash>` makes a changed asset a different URL, so every cache
 *  in the chain treats it as new. The hash comes from the favicon's own bytes,
 *  which means regenerating the assets changes the version automatically — no
 *  constant for someone to forget to bump.
 *
 *  Build-time only. This module reads from disk and must never be imported into
 *  anything that ships to the browser.
 */

/*
  Anchored on cwd rather than import.meta.url. Astro bundles SSR modules into a
  temporary directory at build time, so walking up from this file's own URL
  lands somewhere unrelated and the read fails — which silently degrades to the
  "0" fallback and busts nothing. `astro build` always runs from the project
  root.
*/
const publicDir = join(process.cwd(), 'public');

function computeVersion(): string {
  try {
    // The SVG favicon is the canonical source of the mark — every other icon is
    // rendered from the same geometry, so hashing this one covers the set.
    const bytes = readFileSync(join(publicDir, 'favicon.svg'));
    return createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  } catch {
    // Assets not generated yet (a fresh clone before `npm run assets`).
    // Returning a constant is correct here: there is nothing to bust.
    return '0';
  }
}

/** Computed once per build, not once per page. */
export const ASSET_VERSION = computeVersion();

/** Append the version to a site-relative asset path. */
export function versioned(path: string): string {
  return `${path}?v=${ASSET_VERSION}`;
}
