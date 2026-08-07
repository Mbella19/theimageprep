import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import Dropzone from './shared/Dropzone';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { TextField, ColorField, ControlGrid, Checkbox } from './shared/Controls';
import { getImagePool } from '../lib/workerPool';
import { buildIco } from '../lib/ico';
import { createZip } from '../lib/zip';
import { formatBytes } from '../lib/targetSize';
import { FAVICON_SIZES, ICO_SIZES } from '../data/presets';
import { hexToRgba } from '../lib/color';
import type { Operation } from '../lib/imageTypes';

interface Generated {
  name: string;
  size: number;
  purpose: string;
  bytes: Uint8Array;
  url: string;
}

export default function FaviconGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [icons, setIcons] = useState<Generated[]>([]);
  const [ico, setIco] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState('My site');
  const [themeColor, setThemeColor] = useState('#0f6e60');
  const [padBackground, setPadBackground] = useState(false);
  const [background, setBackground] = useState('#ffffff');
  const [copied, setCopied] = useState(false);

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
      setError('That image could not be opened. Try a PNG, JPG or WebP.');
    }
  }, []);

  const runRef = useRef(0);
  useEffect(() => {
    if (!file || !bitmap) return;
    const run = ++runRef.current;

    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const pool = getImagePool();

        const generated = await Promise.all(
          FAVICON_SIZES.map(async (spec) => {
            const ops: Operation[] = [
              {
                type: 'resize',
                width: spec.size,
                height: spec.size,
                // 'fit' keeps the whole logo visible and squares it off, which
                // is what you want for an icon — 'fill' would crop a wide logo.
                fit: 'fit',
                background: padBackground
                  ? hexToRgba(background)
                  : { r: 0, g: 0, b: 0, a: 0 },
              },
            ];
            if (padBackground) {
              ops.push({ type: 'flatten', background: hexToRgba(background) });
            }

            const result = await pool.run(
              { kind: 'encoded', bytes: await file.arrayBuffer(), mime: file.type },
              ops,
              { format: 'png', optimiseLevel: 3 },
            );
            const bytes = new Uint8Array(result.bytes!);
            const url = URL.createObjectURL(
              new Blob([bytes as unknown as BlobPart], { type: 'image/png' }),
            );
            urls.current.add(url);
            return { name: spec.file, size: spec.size, purpose: spec.purpose, bytes, url };
          }),
        );

        if (run !== runRef.current) return;

        // A real multi-resolution .ico, holding 16/32/48 in one file — which is
        // the entire reason the format exists.
        const icoEntries = ICO_SIZES.map((size) => {
          const match = generated.find((g) => g.size === size);
          return match ? { size, png: match.bytes } : null;
        }).filter((e): e is { size: number; png: Uint8Array } => e !== null);

        setIcons(generated);
        setIco(icoEntries.length ? buildIco(icoEntries) : null);
      } catch (e) {
        if (run !== runRef.current) return;
        setError(e instanceof Error ? e.message : 'The favicons could not be generated.');
      } finally {
        if (run === runRef.current) setBusy(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [file, bitmap, padBackground, background]);

  const manifest = JSON.stringify(
    {
      name: appName,
      short_name: appName,
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
      theme_color: themeColor,
      background_color: background,
      display: 'standalone',
    },
    null,
    2,
  );

  const snippet = `<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">
<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${themeColor}">`;

  const downloadZip = async () => {
    if (!icons.length) return;
    const entries = icons.map((icon) => ({ name: icon.name, data: icon.bytes }));
    if (ico) entries.push({ name: 'favicon.ico', data: ico });
    entries.push({ name: 'site.webmanifest', data: new TextEncoder().encode(manifest) });
    entries.push({
      name: 'README.txt',
      data: new TextEncoder().encode(
        `FAVICON PACK\n\n` +
          `1. Copy every file except this README into the ROOT folder of your website,\n` +
          `   so they are reachable at yoursite.com/favicon.ico and so on.\n\n` +
          `2. Paste the following into the <head> of your pages:\n\n${snippet}\n\n` +
          `Note: browsers cache favicons aggressively. After replacing one you may need\n` +
          `a hard refresh, or to visit the icon URL directly, before the change shows.\n`,
      ),
    });

    const zipBlob = await createZip(entries);
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'favicons.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const notSquare = bitmap && Math.abs(bitmap.width - bitmap.height) > bitmap.width * 0.05;

  return (
    <ToolFrame busy={busy} progress={1} busyLabel="Generating icons…">
      <Dropzone
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        onFiles={addFiles}
        label={file ? 'Choose a different image' : 'Drop a square image here'}
        hint="A simple, high-contrast logo works far better than a photograph"
        compact={Boolean(file)}
      />

      {error && <ToolNotice variant="warn">{error}</ToolNotice>}

      {notSquare && (
        <ToolNotice variant="warn">
          This image is not square ({bitmap!.width} x {bitmap!.height}). It will be fitted inside
          a square, leaving space at the sides. <a href="/crop-image/">Crop it to 1:1</a> first
          for a tighter result.
        </ToolNotice>
      )}

      {icons.length > 0 && (
        <>
          <ToolControls title="Preview at real size">
            <div style="display:flex;align-items:flex-end;gap:var(--space-5);flex-wrap:wrap">
              {icons
                .filter((i) => i.size <= 48)
                .map((icon) => (
                  <figure key={icon.name} style="text-align:center;margin:0">
                    <img
                      src={icon.url}
                      width={icon.size}
                      height={icon.size}
                      alt={`Favicon at ${icon.size} by ${icon.size} pixels`}
                      style={`width:${icon.size}px;height:${icon.size}px;image-rendering:auto`}
                    />
                    <figcaption class="text-sm text-muted" style="margin-top:var(--space-2)">
                      {icon.size}px
                    </figcaption>
                  </figure>
                ))}
            </div>
            <p class="text-sm text-muted" style="margin-top:var(--space-3)">
              These are shown at actual size. If the 16px version is an unreadable blob, simplify
              the artwork — a single letter or symbol usually survives where a full logo cannot.
            </p>
          </ToolControls>

          <ToolControls title="Manifest">
            <ControlGrid>
              <TextField label="Site name" value={appName} onChange={setAppName} />
              <ColorField
                label="Theme colour"
                value={themeColor}
                onChange={setThemeColor}
                hint="Tints the browser UI on mobile."
              />
              <Checkbox
                label="Fill transparency with a background colour"
                checked={padBackground}
                onChange={setPadBackground}
                hint="Leave off to keep transparent icons transparent."
              />
              {padBackground && (
                <ColorField
                  label="Background"
                  value={background}
                  onChange={setBackground}
                  presets={['#ffffff', '#000000', '#0f6e60']}
                />
              )}
            </ControlGrid>
          </ToolControls>

          <ul class="output-list">
            {icons.map((icon) => (
              <li key={icon.name} class="output-item">
                <img class="output-item__preview" src={icon.url} alt="" />
                <span class="output-item__name">{icon.name}</span>
                <span class="output-item__meta">
                  {icon.purpose} · {formatBytes(icon.bytes.length)}
                </span>
              </li>
            ))}
            {ico && (
              <li class="output-item">
                <span class="output-item__preview" style="display:grid;place-items:center">📦</span>
                <span class="output-item__name">favicon.ico</span>
                <span class="output-item__meta">
                  {ICO_SIZES.join(', ')}px in one file · {formatBytes(ico.length)}
                </span>
              </li>
            )}
            <li class="output-item">
              <span class="output-item__preview" style="display:grid;place-items:center">📄</span>
              <span class="output-item__name">site.webmanifest</span>
              <span class="output-item__meta">Android and PWA</span>
            </li>
          </ul>

          <div class="snippet">
            <p class="label">Paste this into your &lt;head&gt;</p>
            <pre><code>{snippet}</code></pre>
            <button
              type="button"
              class="btn btn--secondary btn--sm snippet__copy"
              onClick={() => {
                void navigator.clipboard?.writeText(snippet).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                });
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div class="results__footer">
            <div class="results__summary">
              <p>{icons.length + (ico ? 2 : 1)} files ready</p>
            </div>
            <div class="results__actions">
              <button type="button" class="btn btn--primary" onClick={() => void downloadZip()}>
                Download favicon pack
              </button>
            </div>
          </div>
        </>
      )}
    </ToolFrame>
  );
}
