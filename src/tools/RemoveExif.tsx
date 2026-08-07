import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import Dropzone from './shared/Dropzone';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { Checkbox } from './shared/Controls';
import { readExif, type ExifSummary } from '../lib/exifRead';
import { detectFormat, formatLabel } from '../lib/sniff';
import { stripJpegMetadata } from '../lib/metadata/jpeg';
import { stripPngMetadata } from '../lib/metadata/png';
import { stripWebpMetadata } from '../lib/metadata/webp';
import { formatBytes } from '../lib/targetSize';
import { downloadBytes, withSuffix, safeFileName } from '../lib/files';
import { createZip } from '../lib/zip';

interface Entry {
  id: string;
  file: File;
  format: string;
  exif: ExifSummary | null;
  cleaned: Uint8Array | null;
  removed: string[];
  removedBytes: number;
  error?: string;
}

let counter = 0;

/**
 * The EXIF viewer and remover.
 *
 * Deliberately does NOT use the image worker. Stripping metadata is a
 * container-level edit — copy the compressed image data across untouched and
 * omit the metadata blocks — so there is nothing to decode and no reason to
 * spend a generation of JPEG quality on it. It is also instant, because no
 * pixels are processed at all.
 */
export default function RemoveExif() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [keepIcc, setKeepIcc] = useState(true);
  const [busy, setBusy] = useState(false);
  const keepIccRef = useRef(keepIcc);
  keepIccRef.current = keepIcc;

  const processFiles = useCallback(async (files: File[], keepIccValue: boolean) => {
    setBusy(true);
    const next: Entry[] = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const format = detectFormat(bytes);

      let exif: ExifSummary | null = null;
      try {
        exif = await readExif(buffer);
      } catch {
        exif = null;
      }

      let cleaned: Uint8Array | null = null;
      let removed: string[] = [];
      let removedBytes = 0;
      let error: string | undefined;

      const options = { keepIcc: keepIccValue };
      const result =
        format === 'jpeg'
          ? stripJpegMetadata(bytes, options)
          : format === 'png'
            ? stripPngMetadata(bytes, options)
            : format === 'webp'
              ? stripWebpMetadata(bytes, options)
              : null;

      if (result) {
        cleaned = result.bytes;
        removed = result.removed;
        removedBytes = result.removedBytes;
      } else if (format === 'heic') {
        error =
          'HEIC files cannot be cleaned in place. Convert to JPG first — the converter leaves all metadata behind automatically.';
      } else {
        error = `${formatLabel(format as never)} files are not supported here. Use JPG, PNG or WebP.`;
      }

      next.push({
        id: `e${++counter}`,
        file,
        format: formatLabel(format as never),
        exif,
        cleaned,
        removed,
        removedBytes,
        error,
      });
    }

    setEntries(next);
    setBusy(false);
  }, []);

  const addFiles = useCallback(
    (files: File[]) => void processFiles(files, keepIccRef.current),
    [processFiles],
  );

  // Toggling the colour-profile switch changes the output, so redo the strip.
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (entries.length === 0) return;
    void processFiles(entries.map((e) => e.file), keepIcc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepIcc]);

  const downloadOne = (entry: Entry) => {
    if (!entry.cleaned) return;
    const mime =
      entry.format === 'PNG' ? 'image/png' : entry.format === 'WebP' ? 'image/webp' : 'image/jpeg';
    downloadBytes(entry.cleaned, withSuffix(entry.file.name, '-clean'), mime);
  };

  const downloadAll = async () => {
    const ready = entries.filter((e) => e.cleaned);
    if (ready.length === 0) return;
    if (ready.length === 1) return downloadOne(ready[0]);

    const zipBlob = await createZip(
      ready.map((e) => ({
        name: safeFileName(withSuffix(e.file.name, '-clean')),
        data: e.cleaned!,
      })),
    );
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cleaned-images.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const anyGps = entries.some((e) => e.exif?.gps);
  const anyReady = entries.some((e) => e.cleaned);

  return (
    <ToolFrame busy={busy} progress={1} busyLabel="Reading metadata…">
      <Dropzone
        multiple
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onFiles={addFiles}
        label={entries.length ? 'Check another image' : 'Drop a photo here'}
        hint="Nothing is uploaded — the metadata is read on your device"
        compact={entries.length > 0}
      />

      {anyGps && (
        <div class="gps-alert">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
            style="flex-shrink:0;color:var(--danger)"
          >
            <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" stroke-linejoin="round" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <div>
            <strong>This photo records where it was taken.</strong> The coordinates below are
            typically accurate to within a few metres. Anyone who receives the file can read them,
            and many places you might post it will not strip them for you.
          </div>
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id} style="margin-top: var(--space-6)">
          <h3 style="font-size: var(--step-1)">{entry.file.name}</h3>
          <p class="text-sm text-muted">
            {entry.format} · <span class="mono">{formatBytes(entry.file.size)}</span>
          </p>

          {entry.error && <ToolNotice variant="warn">{entry.error}</ToolNotice>}

          {entry.exif && entry.exif.fields.length > 0 ? (
            <table class="meta-table">
              <caption class="visually-hidden">Metadata found in {entry.file.name}</caption>
              <tbody>
                {entry.exif.fields.map((field) => (
                  <tr key={field.label} data-sensitive={field.sensitive ? 'true' : 'false'}>
                    <th scope="row">{field.label}</th>
                    <td>
                      {field.label === 'GPS coordinates' && entry.exif?.gps ? (
                        <a href={entry.exif.gps.mapUrl} target="_blank" rel="noopener nofollow">
                          {field.value}
                        </a>
                      ) : (
                        field.value
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !entry.error && (
              <ToolNotice>
                No camera, location or editing metadata found in this file. It may already have
                been stripped, or it may have been created by software that does not add any.
              </ToolNotice>
            )
          )}

          {entry.cleaned && (
            <div class="results__footer" style="margin-top: var(--space-4)">
              <div class="results__summary">
                {entry.removedBytes > 0 ? (
                  <p>
                    Removed <strong>{entry.removed.length}</strong> metadata block
                    {entry.removed.length === 1 ? '' : 's'} ·{' '}
                    <span class="mono">{formatBytes(entry.removedBytes)}</span> smaller · pixels
                    unchanged
                  </p>
                ) : (
                  <p>Nothing to remove — the file is already clean.</p>
                )}
              </div>
              <div class="results__actions">
                <button type="button" class="btn btn--primary" onClick={() => downloadOne(entry)}>
                  Download cleaned image
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {entries.length > 0 && (
        <ToolControls title="Options">
          <Checkbox
            label="Keep the colour profile"
            checked={keepIcc}
            onChange={setKeepIcc}
            hint="The ICC profile tells displays how to interpret the colours. Removing it saves a few kilobytes but can make images look washed out or oversaturated on wide-gamut screens. Keep it unless you know your image is plain sRGB."
          />

          <ToolNotice>
            <strong>This does not re-compress your image.</strong> The compressed picture data is
            copied across byte for byte and only the metadata blocks are left out, so the image
            that comes out is mathematically identical to the one that went in. Most tools decode
            and re-save, quietly costing you quality to delete a few kilobytes of text.
          </ToolNotice>

          {entries.length > 1 && anyReady && (
            <div class="results__actions" style="margin-top: var(--space-4)">
              <button type="button" class="btn btn--primary" onClick={() => void downloadAll()}>
                Download all as ZIP
              </button>
            </div>
          )}
        </ToolControls>
      )}
    </ToolFrame>
  );
}
