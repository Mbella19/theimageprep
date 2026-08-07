import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import Dropzone from './shared/Dropzone';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { Slider, SelectField, ControlGrid } from './shared/Controls';
import { getImagePool } from '../lib/workerPool';
import { PRESETS, VERIFIED_ON, presetsByPlatform, type SizePreset } from '../data/presets';
import { formatBytes } from '../lib/targetSize';
import { downloadBytes, stemOf, safeZipPath } from '../lib/files';
import { createZip } from '../lib/zip';
import type { FitMode } from '../lib/imageTypes';

interface Output {
  preset: SizePreset;
  bytes: Uint8Array;
  url: string;
  overBudget: boolean;
}

const DEFAULT_SELECTED = PRESETS.filter((p) => p.popular).map((p) => p.id);

/**
 * The niche centrepiece: one image in, every platform size out.
 *
 * The sizes come from src/data/presets.ts, which carries the date they were
 * last checked. That date is displayed rather than hidden — platform specs
 * drift, and a visibly stale number is more useful than one silently pretending
 * to be current.
 */
export default function SocialSizes() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);
  const [fit, setFit] = useState<FitMode>('fill');
  const [quality, setQuality] = useState(85);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urls = useRef(new Set<string>());
  useEffect(
    () => () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    },
    [],
  );

  const addFiles = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setError(null);
    try {
      const bmp = await createImageBitmap(next, { imageOrientation: 'from-image' });
      setFile(next);
      setBitmap((prev) => {
        prev?.close();
        return bmp;
      });
    } catch {
      setError('That image could not be opened. HEIC files need converting to JPG first.');
    }
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const runRef = useRef(0);
  useEffect(() => {
    if (!file || !bitmap || selected.length === 0) {
      setOutputs([]);
      return;
    }
    const run = ++runRef.current;

    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const pool = getImagePool();
        const chosen = PRESETS.filter((p) => selected.includes(p.id));

        const results = await Promise.all(
          chosen.map(async (preset) => {
            const format = preset.format ?? 'jpeg';
            const result = await pool.run(
              { kind: 'encoded', bytes: await file.arrayBuffer(), mime: file.type },
              [
                {
                  type: 'resize',
                  width: preset.width,
                  height: preset.height,
                  fit,
                  background: { r: 255, g: 255, b: 255, a: 255 },
                },
              ],
              {
                format,
                quality,
                // Honour a published upload ceiling by searching for a quality
                // that fits under it, rather than handing over a rejected file.
                targetBytes: preset.maxBytes,
                minQuality: 50,
                optimiseLevel: 2,
              },
            );
            const bytes = new Uint8Array(result.bytes!);
            const url = URL.createObjectURL(
              new Blob([bytes as unknown as BlobPart], { type: `image/${format}` }),
            );
            urls.current.add(url);
            return {
              preset,
              bytes,
              url,
              overBudget: Boolean(preset.maxBytes && bytes.length > preset.maxBytes),
            };
          }),
        );

        if (run !== runRef.current) return;
        setOutputs(results);
      } catch (e) {
        if (run !== runRef.current) return;
        setError(e instanceof Error ? e.message : 'The images could not be generated.');
      } finally {
        if (run === runRef.current) setBusy(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [file, bitmap, selected, fit, quality]);

  const downloadAll = async () => {
    if (outputs.length === 0 || !file) return;
    const stem = stemOf(file.name);
    if (outputs.length === 1) {
      const o = outputs[0];
      downloadBytes(
        o.bytes,
        `${stem}-${o.preset.id}-${o.preset.width}x${o.preset.height}.${o.preset.format ?? 'jpeg'}`,
        `image/${o.preset.format ?? 'jpeg'}`,
      );
      return;
    }
    const zipBlob = await createZip(
      outputs.map((o) => ({
        // safeZipPath, not safeFileName — the latter would turn the platform
        // folder separator into a hyphen and flatten the archive.
        name: safeZipPath(
          `${o.preset.platform.toLowerCase()}/${stem}-${o.preset.placement
            .toLowerCase()
            .replace(/\s+/g, '-')}-${o.preset.width}x${o.preset.height}.${
            o.preset.format === 'png' ? 'png' : 'jpg'
          }`,
        ),
        data: o.bytes,
      })),
    );
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${stem}-social-sizes.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const groups = presetsByPlatform();
  const upscaleWarnings = bitmap
    ? PRESETS.filter(
        (p) => selected.includes(p.id) && (p.width > bitmap.width || p.height > bitmap.height),
      )
    : [];

  return (
    <ToolFrame busy={busy} progress={1} busyLabel="Generating sizes…">
      <Dropzone
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onFiles={addFiles}
        label={file ? 'Choose a different image' : 'Drop your source image here'}
        hint="The bigger the original, the better every output will be"
        compact={Boolean(file)}
      />

      {error && <ToolNotice variant="warn">{error}</ToolNotice>}

      {bitmap && (
        <p class="text-sm text-muted" style="margin-top: var(--space-3)">
          Source: <span class="mono">{bitmap.width} x {bitmap.height}</span>
        </p>
      )}

      <ToolControls title={`Sizes — ${selected.length} selected`}>
        <div class="preset-groups">
          {Array.from(groups.entries()).map(([platform, presets]) => (
            <div key={platform} class="preset-group">
              <h3 class="preset-group__title">{platform}</h3>
              <ul class="preset-list">
                {presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      class="preset-chip"
                      data-selected={selected.includes(preset.id)}
                      aria-pressed={selected.includes(preset.id)}
                      onClick={() => toggle(preset.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(preset.id)}
                        tabIndex={-1}
                        readOnly
                        style="pointer-events:none;margin-top:2px"
                      />
                      <span>
                        <span class="preset-chip__name">{preset.placement}</span>
                        <span class="preset-chip__dims">
                          {preset.width} x {preset.height}
                          {preset.maxBytes && ` · max ${formatBytes(preset.maxBytes)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <ControlGrid>
          <SelectField
            label="Framing"
            value={fit}
            onChange={(value) => setFit(value as FitMode)}
            options={[
              { value: 'fill', label: 'Fill and crop the overflow' },
              { value: 'fit', label: 'Fit inside, pad with white' },
              { value: 'stretch', label: 'Stretch to fit' },
            ]}
            hint="Fill is right for almost everything. Automatic cropping centres the frame — check the previews."
          />
          <Slider label="Quality" value={quality} min={50} max={100} onChange={setQuality} />
        </ControlGrid>

        <ToolNotice>
          Sizes last checked on <strong>{VERIFIED_ON}</strong>. Platforms change these without
          announcement, so confirm anything critical against the platform's own documentation.
        </ToolNotice>

        {upscaleWarnings.length > 0 && (
          <ToolNotice variant="warn">
            {upscaleWarnings.length} selected size
            {upscaleWarnings.length === 1 ? ' is' : 's are'} larger than your source image, so
            {upscaleWarnings.length === 1 ? ' it' : ' they'} will be enlarged and look soft:{' '}
            {upscaleWarnings.map((p) => `${p.platform} ${p.placement}`).join(', ')}.
          </ToolNotice>
        )}
      </ToolControls>

      {outputs.length > 0 && (
        <>
          <ul class="result-list" style="margin-top: var(--space-5)">
            {outputs.map((o) => (
              <li key={o.preset.id} class="result-row">
                <div class="result-row__thumb">
                  <img src={o.url} alt="" loading="lazy" />
                </div>
                <div class="result-row__body">
                  <p class="result-row__name">
                    {o.preset.platform} — {o.preset.placement}
                  </p>
                  <p class="result-row__meta">
                    <span class="mono">
                      {o.preset.width} x {o.preset.height}
                    </span>{' '}
                    · <span class="mono">{formatBytes(o.bytes.length)}</span>
                  </p>
                  {o.overBudget && (
                    <p class="result-row__warn">
                      Still above this platform's {formatBytes(o.preset.maxBytes!)} limit even at
                      the lowest usable quality.
                    </p>
                  )}
                </div>
                <div class="result-row__actions">
                  <button
                    type="button"
                    class="btn btn--secondary btn--sm"
                    onClick={() =>
                      downloadBytes(
                        o.bytes,
                        `${stemOf(file!.name)}-${o.preset.width}x${o.preset.height}.${
                          o.preset.format === 'png' ? 'png' : 'jpg'
                        }`,
                        `image/${o.preset.format ?? 'jpeg'}`,
                      )
                    }
                  >
                    Download
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div class="results__footer">
            <div class="results__summary">
              <p>
                {outputs.length} image{outputs.length === 1 ? '' : 's'} ·{' '}
                <span class="mono">
                  {formatBytes(outputs.reduce((sum, o) => sum + o.bytes.length, 0))}
                </span>{' '}
                total
              </p>
            </div>
            <div class="results__actions">
              <button type="button" class="btn btn--primary" onClick={() => void downloadAll()}>
                {outputs.length > 1 ? 'Download all as ZIP' : 'Download'}
              </button>
            </div>
          </div>
        </>
      )}
    </ToolFrame>
  );
}
