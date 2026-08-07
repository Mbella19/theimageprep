import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import Dropzone from './shared/Dropzone';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { NumberField, SelectField, Checkbox, ControlGrid, Slider } from './shared/Controls';
import FramedCropper, { type CropRect } from './shared/FramedCropper';
import { ASPECT_RATIOS } from '../data/presets';
import { getImagePool } from '../lib/workerPool';
import { formatBytes } from '../lib/targetSize';
import { downloadBytes, withSuffix, aspectRatioLabel } from '../lib/files';
import type { ImageFormat } from '../lib/imageTypes';

export default function CropImage() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [ratioId, setRatioId] = useState<string>('1-1');
  const [resizeOutput, setResizeOutput] = useState(true);
  const [quality, setQuality] = useState(90);
  const [output, setOutput] = useState<{ bytes: Uint8Array; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setError(null);
    setOutput(null);
    try {
      const bmp = await createImageBitmap(next, { imageOrientation: 'from-image' });
      setFile(next);
      setBitmap((prev) => {
        prev?.close();
        return bmp;
      });
      // Default the output box to the largest square that fits.
      const side = Math.min(bmp.width, bmp.height);
      setWidth(side);
      setHeight(side);
      setRatioId('1-1');
    } catch {
      setError('That image could not be opened. HEIC files need converting to JPG first.');
    }
  }, []);

  useEffect(() => () => bitmap?.close(), []);

  const aspect = width > 0 && height > 0 ? width / height : 1;

  const applyRatio = (id: string) => {
    setRatioId(id);
    const preset = ASPECT_RATIOS.find((r) => r.id === id);
    if (!preset?.ratio || !bitmap) return;
    // Fit the largest box of this ratio inside the source.
    const byWidth = { w: bitmap.width, h: Math.round(bitmap.width / preset.ratio) };
    const byHeight = { w: Math.round(bitmap.height * preset.ratio), h: bitmap.height };
    const best = byWidth.h <= bitmap.height ? byWidth : byHeight;
    setWidth(best.w);
    setHeight(best.h);
  };

  const outputFormat: ImageFormat =
    file?.name.toLowerCase().endsWith('.png') ? 'png' : file?.name.toLowerCase().endsWith('.webp') ? 'webp' : 'jpeg';

  const runRef = useRef(0);
  useEffect(() => {
    if (!file || !bitmap || !crop) return;
    const run = ++runRef.current;

    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const ops: Parameters<ReturnType<typeof getImagePool>['run']>[1] = [
          { type: 'crop', x: crop.x, y: crop.y, width: crop.width, height: crop.height },
        ];
        if (resizeOutput) {
          ops.push({ type: 'resize', width, height, fit: 'stretch' });
        }

        const result = await getImagePool().run(
          { kind: 'encoded', bytes: await file.arrayBuffer(), mime: file.type },
          ops,
          { format: outputFormat, quality, optimiseLevel: 2 },
        );
        if (run !== runRef.current) return;
        setOutput({
          bytes: new Uint8Array(result.bytes!),
          w: result.width,
          h: result.height,
        });
      } catch (e) {
        if (run !== runRef.current) return;
        setError(e instanceof Error ? e.message : 'The crop could not be applied.');
      } finally {
        if (run === runRef.current) setBusy(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [file, bitmap, crop, width, height, resizeOutput, quality, outputFormat]);

  const cropTooSmall = Boolean(
    crop && resizeOutput && (crop.width < width * 0.95 || crop.height < height * 0.95),
  );

  return (
    <ToolFrame busy={busy} progress={1} busyLabel="Cropping…">
      <Dropzone
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onFiles={addFiles}
        label={file ? 'Choose a different image' : 'Drop an image here'}
        compact={Boolean(file)}
      />

      {error && <ToolNotice variant="warn">{error}</ToolNotice>}

      {bitmap && (
        <>
          <ToolControls title="Output size">
            <ControlGrid>
              <SelectField
                label="Aspect ratio"
                value={ratioId}
                onChange={applyRatio}
                options={ASPECT_RATIOS.map((r) => ({ value: r.id, label: r.label }))}
              />
              <NumberField
                label="Width"
                value={width}
                min={1}
                suffix="px"
                onChange={(w) => {
                  setWidth(w);
                  setRatioId('free');
                }}
              />
              <NumberField
                label="Height"
                value={height}
                min={1}
                suffix="px"
                onChange={(h) => {
                  setHeight(h);
                  setRatioId('free');
                }}
              />
              <Checkbox
                label="Scale to these exact dimensions"
                checked={resizeOutput}
                onChange={setResizeOutput}
                hint="On: the output is exactly the size above. Off: the output keeps the cropped area at its original pixel size."
              />
              <Slider
                label="Quality"
                value={quality}
                min={50}
                max={100}
                onChange={setQuality}
                hint="Ignored for PNG, which is always lossless."
              />
            </ControlGrid>

            <p class="text-sm text-muted" style="margin-top: var(--space-3)">
              Source: <span class="mono">{bitmap.width} x {bitmap.height}</span> (
              {aspectRatioLabel(bitmap.width, bitmap.height)}) · target ratio{' '}
              {aspectRatioLabel(width, height)}
            </p>

            {cropTooSmall && (
              <ToolNotice variant="warn">
                The area you have framed is smaller than the output size, so it will be enlarged
                and will look soft. Zoom out, or reduce the output dimensions.
              </ToolNotice>
            )}
          </ToolControls>

          <FramedCropper image={bitmap} aspect={aspect} onChange={setCrop} />

          <div class="results__footer">
            <div class="results__summary">
              {output && (
                <p>
                  Result: <strong>{output.w} x {output.h}</strong> ·{' '}
                  <span class="mono">{formatBytes(output.bytes.length)}</span>
                </p>
              )}
            </div>
            <div class="results__actions">
              <button
                type="button"
                class="btn btn--primary"
                disabled={!output}
                onClick={() =>
                  output &&
                  file &&
                  downloadBytes(
                    output.bytes,
                    withSuffix(file.name, `-${output.w}x${output.h}`),
                    outputFormat === 'png'
                      ? 'image/png'
                      : outputFormat === 'webp'
                        ? 'image/webp'
                        : 'image/jpeg',
                  )
                }
              >
                Download cropped image
              </button>
            </div>
          </div>
        </>
      )}
    </ToolFrame>
  );
}
