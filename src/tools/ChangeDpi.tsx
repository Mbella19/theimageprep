import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import Dropzone from './shared/Dropzone';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { Segmented, NumberField, SelectField, ControlGrid } from './shared/Controls';
import { detectFormat, formatLabel } from '../lib/sniff';
import { readJpegDpi, setJpegDpi } from '../lib/metadata/jpeg';
import { readPngDpi, setPngDpi, readPngDimensions } from '../lib/metadata/png';
import { readWebpDimensions } from '../lib/metadata/webp';
import { DPI_PRESETS } from '../data/presets';
import { formatBytes } from '../lib/targetSize';
import { downloadBytes, withSuffix } from '../lib/files';
import { getImagePool } from '../lib/workerPool';

type Mode = 'metadata' | 'resample';

interface Loaded {
  file: File;
  bytes: Uint8Array;
  format: 'jpeg' | 'png' | 'webp' | 'other';
  width: number;
  height: number;
  currentDpi: number;
  supported: boolean;
}

function printSize(pixels: number, dpi: number) {
  const inches = pixels / dpi;
  return { inches, cm: inches * 2.54 };
}

/**
 * The DPI tool.
 *
 * ─── THE BUG THIS FIXES ──────────────────────────────────────────────────────
 * A JPEG records its resolution in TWO places: the JFIF APP0 density fields and
 * the EXIF XResolution/YResolution tags. Nearly every online DPI tool writes
 * only JFIF. Photoshop, Word and InDesign read EXIF, find the old value still
 * sitting there, and display it — so the change looks like it silently failed.
 * See src/lib/metadata/jpeg.ts, which writes both.
 */
export default function ChangeDpi() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [dpi, setDpi] = useState(300);
  const [mode, setMode] = useState<Mode>('metadata');
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setOutput(null);

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detected = detectFormat(bytes);

    let width = 0;
    let height = 0;
    let currentDpi = 72;
    let format: Loaded['format'] = 'other';

    if (detected === 'jpeg') {
      format = 'jpeg';
      const density = readJpegDpi(bytes);
      currentDpi = density.unit === 'cm' ? Math.round(density.x * 2.54) : density.x;
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    } else if (detected === 'png') {
      format = 'png';
      const density = readPngDpi(bytes);
      currentDpi = density.hasUnit ? density.x : 72;
      const dims = readPngDimensions(bytes);
      width = dims?.width ?? 0;
      height = dims?.height ?? 0;
    } else if (detected === 'webp') {
      format = 'webp';
      const dims = readWebpDimensions(bytes);
      width = dims?.width ?? 0;
      height = dims?.height ?? 0;
    }

    setLoaded({
      file,
      bytes,
      format,
      width,
      height,
      currentDpi,
      supported: format === 'jpeg' || format === 'png',
    });
  }, []);

  // Recompute the output whenever the inputs change.
  const runRef = useRef(0);
  useEffect(() => {
    if (!loaded || !loaded.supported) return;
    const run = ++runRef.current;

    const compute = async () => {
      setBusy(true);
      setError(null);
      try {
        let source = loaded.bytes;

        if (mode === 'resample') {
          // Keep the PHYSICAL size the same by changing the pixel count to
          // match the new density.
          const scale = dpi / (loaded.currentDpi || 72);
          const targetW = Math.max(1, Math.round(loaded.width * scale));
          const targetH = Math.max(1, Math.round(loaded.height * scale));

          const result = await getImagePool().run(
            { kind: 'encoded', bytes: loaded.bytes.slice().buffer, mime: loaded.file.type },
            [{ type: 'resize', width: targetW, height: targetH, fit: 'stretch' }],
            { format: loaded.format === 'png' ? 'png' : 'jpeg', quality: 92, optimiseLevel: 2 },
          );
          source = new Uint8Array(result.bytes!);
        }

        const written =
          loaded.format === 'jpeg' ? setJpegDpi(source, dpi) : setPngDpi(source, dpi);

        if (run !== runRef.current) return;
        if (!written) {
          setError('The DPI could not be written to this file. It may be malformed.');
          setOutput(null);
        } else {
          setOutput(written);
        }
      } catch (e) {
        if (run !== runRef.current) return;
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        if (run === runRef.current) setBusy(false);
      }
    };

    void compute();
  }, [loaded, dpi, mode]);

  const displayWidth =
    loaded && mode === 'resample'
      ? Math.round(loaded.width * (dpi / (loaded.currentDpi || 72)))
      : (loaded?.width ?? 0);
  const displayHeight =
    loaded && mode === 'resample'
      ? Math.round(loaded.height * (dpi / (loaded.currentDpi || 72)))
      : (loaded?.height ?? 0);

  const printW = printSize(displayWidth, dpi);
  const printH = printSize(displayHeight, dpi);

  return (
    <ToolFrame busy={busy} progress={1} busyLabel="Writing…">
      <Dropzone
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onFiles={addFiles}
        label={loaded ? 'Choose a different image' : 'Drop an image here'}
        hint="JPG and PNG. WebP has no field for DPI."
        compact={Boolean(loaded)}
      />

      {loaded && !loaded.supported && (
        <ToolNotice variant="warn">
          <strong>{formatLabel(detectFormat(loaded.bytes))} files cannot store a DPI value.</strong>{' '}
          The format simply has no field for it — tools that appear to set one are not doing
          anything. Convert to <a href="/png-to-jpg/">JPG</a> or PNG first if you need a print
          resolution.
        </ToolNotice>
      )}

      {loaded && loaded.supported && (
        <>
          <ToolControls title="Resolution">
            <ControlGrid>
              <SelectField
                label="DPI"
                value={String(dpi)}
                onChange={(value) => setDpi(Number(value))}
                options={[
                  ...DPI_PRESETS.map((p) => ({ value: String(p.value), label: p.label })),
                  { value: 'custom', label: 'Custom…' },
                ].filter((o) => o.value !== 'custom')}
              />
              <NumberField
                label="Or type a value"
                value={dpi}
                min={1}
                max={65535}
                suffix="DPI"
                onChange={setDpi}
              />
              <Segmented<Mode>
                label="What should change?"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'metadata', label: 'Label only' },
                  { value: 'resample', label: 'Resample' },
                ]}
              />
            </ControlGrid>

            <ToolNotice>
              {mode === 'metadata' ? (
                <>
                  <strong>Label only.</strong> Every pixel stays exactly as it is and the file
                  simply records a different print resolution, which changes how large it prints.
                  This is what a printer asking for "300 DPI" almost always means.
                </>
              ) : (
                <>
                  <strong>Resample.</strong> Pixels are added or removed so the image prints at
                  the same physical size at the new resolution. This re-encodes the image and
                  cannot invent detail when scaling up.
                </>
              )}
            </ToolNotice>
          </ToolControls>

          <div class="results__footer" data-testid="dpi-result">
            <div class="results__summary">
              <p>
                <strong>
                  {displayWidth} x {displayHeight} px
                </strong>{' '}
                at {dpi} DPI prints at{' '}
                <strong>
                  {printW.inches.toFixed(2)} x {printH.inches.toFixed(2)} inches
                </strong>{' '}
                ({printW.cm.toFixed(1)} x {printH.cm.toFixed(1)} cm)
              </p>
              <p class="text-sm" style="margin-top: var(--space-1)">
                Was {loaded.currentDpi} DPI ·{' '}
                {output ? formatBytes(output.length) : formatBytes(loaded.file.size)}
                {mode === 'metadata' && ' · pixels unchanged'}
              </p>
            </div>
            <div class="results__actions">
              <button
                type="button"
                class="btn btn--primary"
                disabled={!output}
                onClick={() =>
                  output &&
                  downloadBytes(
                    output,
                    withSuffix(loaded.file.name, `-${dpi}dpi`),
                    loaded.format === 'png' ? 'image/png' : 'image/jpeg',
                  )
                }
              >
                Download
              </button>
            </div>
          </div>

          {error && <ToolNotice variant="warn">{error}</ToolNotice>}

          {loaded.format === 'jpeg' && mode === 'metadata' && (
            <ToolNotice>
              Both the JFIF density fields and the EXIF resolution tags are updated. Writing only
              one of them is why DPI changes made with other tools so often appear to do nothing
              when the file is opened in Photoshop or Word.
            </ToolNotice>
          )}
        </>
      )}
    </ToolFrame>
  );
}
