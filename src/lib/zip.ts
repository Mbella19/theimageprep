import { zip, type Zippable } from 'fflate';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Bundles processed files into a ZIP, in the browser.
 *
 * Compression level 0 (store) is deliberate. Every file we put in here is
 * already a compressed image; running DEFLATE over JPEG or WebP data saves
 * roughly nothing and costs seconds of frozen UI on a large batch.
 */
export function createZip(entries: ZipEntry[]): Promise<Blob> {
  const payload: Zippable = {};
  const used = new Set<string>();

  for (const entry of entries) {
    payload[uniqueName(entry.name, used)] = [entry.data, { level: 0 }];
  }

  return new Promise((resolve, reject) => {
    zip(payload, { level: 0 }, (error, data) => {
      if (error) {
        reject(new Error(`Could not build the ZIP file: ${error.message}`));
        return;
      }
      resolve(new Blob([data as BlobPart], { type: 'application/zip' }));
    });
  });
}

/**
 * Two files called IMG_0042.jpg would silently overwrite each other inside the
 * archive, so later duplicates get a numeric suffix.
 */
function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';

  let counter = 2;
  let candidate = `${stem} (${counter})${ext}`;
  while (used.has(candidate)) {
    counter++;
    candidate = `${stem} (${counter})${ext}`;
  }
  used.add(candidate);
  return candidate;
}
