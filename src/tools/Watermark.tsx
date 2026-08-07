import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import Dropzone from './shared/Dropzone';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import {
  Segmented,
  Slider,
  TextField,
  ColorField,
  Checkbox,
  ControlGrid,
  SelectField,
} from './shared/Controls';
import { getImagePool } from '../lib/workerPool';
import { formatBytes } from '../lib/targetSize';
import { downloadBytes, withSuffix, safeFileName, isProbablyImage } from '../lib/files';
import { createZip } from '../lib/zip';
import type { ImageFormat } from '../lib/imageTypes';

type Kind = 'text' | 'logo';
type Position =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

const POSITIONS: Position[] = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

interface Settings {
  kind: Kind;
  text: string;
  color: string;
  opacity: number;
  /** Font size as a percentage of the image's smaller side. */
  scale: number;
  rotation: number;
  position: Position;
  margin: number;
  tile: boolean;
  shadow: boolean;
}

interface Item {
  id: string;
  file: File;
  output?: Uint8Array;
  outputName: string;
  previewUrl?: string;
  error?: string;
}

let counter = 0;

/**
 * Watermarking.
 *
 * Compositing happens on a canvas on the main thread — text layout, rotation
 * and tiling are things the 2D context already does well, and there is no
 * OffscreenCanvas text metrics story worth reinventing. Only the final encode
 * goes to the worker, which is where the expensive part actually is.
 */
export default function Watermark() {
  const [items, setItems] = useState<Item[]>([]);
  const [logo, setLogo] = useState<ImageBitmap | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    kind: 'text',
    text: 'Your name',
    color: '#ffffff',
    opacity: 40,
    scale: 6,
    rotation: 0,
    position: 'bottom-right',
    margin: 4,
    tile: false,
    shadow: true,
  });

  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const logoRef = useRef(logo);
  logoRef.current = logo;
  const urls = useRef(new Set<string>());

  useEffect(
    () => () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    },
    [],
  );

  const addFiles = useCallback((files: File[]) => {
    const next = files.filter(isProbablyImage).map((file) => ({
      id: `w${++counter}`,
      file,
      outputName: withSuffix(file.name, '-watermarked'),
    }));
    setItems((prev) => [...prev, ...next]);
  }, []);

  const addLogo = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      setLogo((prev) => {
        prev?.close();
        return bmp;
      });
      setLogoName(file.name);
      setSettings((s) => ({ ...s, kind: 'logo' }));
    } catch {
      /* ignore unreadable logo */
    }
  }, []);

  /** Draws the watermark onto a canvas already containing the source image. */
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, s: Settings, logoBitmap: ImageBitmap | null) => {
      const minSide = Math.min(w, h);
      const marginPx = (s.margin / 100) * minSide;

      ctx.save();
      ctx.globalAlpha = s.opacity / 100;

      if (s.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = minSide * 0.008;
        ctx.shadowOffsetY = minSide * 0.002;
      }

      let markW: number;
      let markH: number;
      let draw: (x: number, y: number) => void;

      if (s.kind === 'logo' && logoBitmap) {
        markW = (s.scale / 100) * w * 3;
        markH = (markW / logoBitmap.width) * logoBitmap.height;
        draw = (x, y) => ctx.drawImage(logoBitmap, x, y, markW, markH);
      } else {
        const fontSize = Math.max(8, (s.scale / 100) * minSide);
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = s.color;
        ctx.textBaseline = 'top';
        const metrics = ctx.measureText(s.text || ' ');
        markW = metrics.width;
        markH = fontSize * 1.2;
        draw = (x, y) => ctx.fillText(s.text, x, y);
      }

      if (s.tile) {
        // Rotate the whole plane, then cover an oversized area so the tiling
        // still reaches the corners after rotation.
        ctx.translate(w / 2, h / 2);
        ctx.rotate((s.rotation * Math.PI) / 180);
        const stepX = markW + minSide * 0.08;
        const stepY = markH + minSide * 0.08;
        const reach = Math.hypot(w, h) / 2 + Math.max(stepX, stepY);
        for (let y = -reach; y < reach; y += stepY) {
          for (let x = -reach; x < reach; x += stepX) {
            draw(x, y);
          }
        }
      } else {
        const [vertical, horizontal] = s.position.split('-');
        const x =
          horizontal === 'left'
            ? marginPx
            : horizontal === 'right'
              ? w - markW - marginPx
              : (w - markW) / 2;
        const y =
          vertical === 'top'
            ? marginPx
            : vertical === 'bottom'
              ? h - markH - marginPx
              : (h - markH) / 2;

        // Rotate about the watermark's own centre so it stays where it was put.
        ctx.translate(x + markW / 2, y + markH / 2);
        ctx.rotate((s.rotation * Math.PI) / 180);
        draw(-markW / 2, -markH / 2);
      }

      ctx.restore();
    },
    [],
  );

  const runRef = useRef(0);
  const process = useCallback(async () => {
    const run = ++runRef.current;
    const current = itemsRef.current;
    if (current.length === 0) return;

    setBusy(true);
    const s = settingsRef.current;
    const logoBitmap = logoRef.current;
    const pool = getImagePool();

    const results = await Promise.all(
      current.map(async (item) => {
        try {
          const bitmap = await createImageBitmap(item.file, { imageOrientation: 'from-image' });
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not create a drawing context.');

          ctx.drawImage(bitmap, 0, 0);
          paint(ctx, bitmap.width, bitmap.height, s, logoBitmap);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          bitmap.close();

          const isPng = item.file.name.toLowerCase().endsWith('.png');
          const format: ImageFormat = isPng ? 'png' : 'jpeg';

          const result = await pool.run(
            {
              kind: 'raw',
              data: imageData.data.buffer as ArrayBuffer,
              width: canvas.width,
              height: canvas.height,
            },
            [],
            { format, quality: 90, optimiseLevel: 2 },
          );

          const bytes = new Uint8Array(result.bytes!);
          const url = URL.createObjectURL(
            new Blob([bytes as unknown as BlobPart], { type: `image/${format}` }),
          );
          urls.current.add(url);
          return { ...item, output: bytes, previewUrl: url, error: undefined };
        } catch (e) {
          return {
            ...item,
            error: e instanceof Error ? e.message : 'Could not watermark this image.',
          };
        }
      }),
    );

    if (run !== runRef.current) return;
    setItems(results);
    setBusy(false);
  }, [paint]);

  // Re-render on any change, debounced so dragging a slider is not 40 encodes.
  const settingsKey = JSON.stringify(settings) + (logoName ?? '') + items.map((i) => i.id).join(',');
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(() => void process(), 320);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);

  const downloadAll = async () => {
    const ready = items.filter((i) => i.output);
    if (ready.length === 0) return;
    if (ready.length === 1) {
      downloadBytes(ready[0].output!, ready[0].outputName, 'image/jpeg');
      return;
    }
    const zipBlob = await createZip(
      ready.map((i) => ({ name: safeFileName(i.outputName), data: i.output! })),
    );
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'watermarked.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <ToolFrame busy={busy} progress={1} busyLabel="Applying watermark…">
      <Dropzone
        multiple
        accept="image/*"
        onFiles={addFiles}
        label={items.length ? 'Add more images' : 'Drop images here'}
        compact={items.length > 0}
      />

      <ToolControls title="Watermark">
        <ControlGrid>
          <Segmented<Kind>
            label="Type"
            value={settings.kind}
            onChange={(kind) => setSettings((s) => ({ ...s, kind }))}
            options={[
              { value: 'text', label: 'Text' },
              { value: 'logo', label: 'Logo' },
            ]}
          />

          {settings.kind === 'text' ? (
            <>
              <TextField
                label="Watermark text"
                value={settings.text}
                onChange={(text) => setSettings((s) => ({ ...s, text }))}
              />
              <ColorField
                label="Colour"
                value={settings.color}
                onChange={(color) => setSettings((s) => ({ ...s, color }))}
                presets={['#ffffff', '#000000', '#0f6e60']}
              />
            </>
          ) : (
            <div class="field">
              <span class="label">Logo image</span>
              <Dropzone
                compact
                accept="image/png,image/svg+xml,image/webp,.png,.webp"
                onFiles={addLogo}
                label={logoName ?? 'Choose a logo'}
              />
              <span class="field__hint">A PNG with a transparent background works best.</span>
            </div>
          )}

          <Slider
            label="Size"
            value={settings.scale}
            min={1}
            max={20}
            suffix="%"
            onChange={(scale) => setSettings((s) => ({ ...s, scale }))}
          />
          <Slider
            label="Opacity"
            value={settings.opacity}
            min={5}
            max={100}
            suffix="%"
            onChange={(opacity) => setSettings((s) => ({ ...s, opacity }))}
            hint="25-50% suits most photographs."
          />
          <Slider
            label="Rotation"
            value={settings.rotation}
            min={-90}
            max={90}
            suffix="°"
            onChange={(rotation) => setSettings((s) => ({ ...s, rotation }))}
          />

          {!settings.tile && (
            <div class="field">
              <span class="label">Position</span>
              <div class="position-grid" role="group" aria-label="Watermark position">
                {POSITIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-label={p.replace('-', ' ')}
                    aria-pressed={settings.position === p}
                    onClick={() => setSettings((s) => ({ ...s, position: p }))}
                  />
                ))}
              </div>
            </div>
          )}

          {!settings.tile && (
            <Slider
              label="Margin"
              value={settings.margin}
              min={0}
              max={20}
              suffix="%"
              onChange={(margin) => setSettings((s) => ({ ...s, margin }))}
            />
          )}

          <Checkbox
            label="Tile across the whole image"
            checked={settings.tile}
            onChange={(tile) => setSettings((s) => ({ ...s, tile }))}
            hint="Much harder to crop out, much more intrusive."
          />
          <Checkbox
            label="Drop shadow"
            checked={settings.shadow}
            onChange={(shadow) => setSettings((s) => ({ ...s, shadow }))}
            hint="Keeps a light watermark readable over light areas."
          />
        </ControlGrid>

        <ToolNotice>
          A watermark is a deterrent, not protection. It can be cropped or painted out, and
          automated tools have got good at removing corner marks. Place it over something
          important if that genuinely matters to you — and keep your unwatermarked originals.
        </ToolNotice>
      </ToolControls>

      {items.length > 0 && (
        <>
          <ul class="result-list" style="margin-top: var(--space-5)">
            {items.map((item) => (
              <li key={item.id} class="result-row">
                <div class="result-row__thumb">
                  {item.previewUrl && <img src={item.previewUrl} alt="" loading="lazy" />}
                </div>
                <div class="result-row__body">
                  <p class="result-row__name">{item.outputName}</p>
                  {item.error ? (
                    <p class="result-row__error">{item.error}</p>
                  ) : (
                    item.output && (
                      <p class="result-row__meta mono">{formatBytes(item.output.length)}</p>
                    )
                  )}
                </div>
                <div class="result-row__actions">
                  {item.output && (
                    <button
                      type="button"
                      class="btn btn--secondary btn--sm"
                      onClick={() => downloadBytes(item.output!, item.outputName, 'image/jpeg')}
                    >
                      Download
                    </button>
                  )}
                  <button
                    type="button"
                    class="btn btn--ghost btn--sm"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div class="results__footer">
            <div class="results__summary" />
            <div class="results__actions">
              <button type="button" class="btn btn--ghost btn--sm" onClick={() => setItems([])}>
                Clear all
              </button>
              <button type="button" class="btn btn--primary" onClick={() => void downloadAll()}>
                {items.length > 1 ? 'Download all as ZIP' : 'Download'}
              </button>
            </div>
          </div>
        </>
      )}
    </ToolFrame>
  );
}
