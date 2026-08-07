import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import Dropzone from './shared/Dropzone';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { SelectField, Checkbox, ControlGrid, ColorField, Slider } from './shared/Controls';
import FramedCropper, { type CropRect } from './shared/FramedCropper';
import { getImagePool } from '../lib/workerPool';
import { formatBytes } from '../lib/targetSize';
import { downloadBytes, stemOf } from '../lib/files';
import { hexToRgba } from '../lib/color';
import type { Operation } from '../lib/imageTypes';

const SIZES = [200, 320, 400, 512, 800, 1000];

export default function ProfilePicture() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [size, setSize] = useState(800);
  const [transparent, setTransparent] = useState(true);
  const [background, setBackground] = useState('#ffffff');
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [output, setOutput] = useState<Uint8Array | null>(null);
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
    } catch {
      setError('That image could not be opened. HEIC files need converting to JPG first.');
    }
  }, []);

  useEffect(() => () => bitmap?.close(), []);

  // Transparency needs PNG; a filled background can be either, and JPG is
  // smaller, so follow the transparency choice.
  const format = transparent ? 'png' : 'jpeg';

  const runRef = useRef(0);
  useEffect(() => {
    if (!file || !bitmap || !crop) return;
    const run = ++runRef.current;

    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const ops: Operation[] = [
          { type: 'crop', x: crop.x, y: crop.y, width: crop.width, height: crop.height },
          { type: 'resize', width: size, height: size, fit: 'stretch' },
          {
            type: 'circle',
            borderWidth: borderWidth > 0 ? (borderWidth / 100) * (size / 2) : 0,
            borderColor: hexToRgba(borderColor),
          },
        ];

        // JPG has no alpha, so the corners outside the circle must be filled.
        if (!transparent) {
          ops.push({ type: 'flatten', background: hexToRgba(background) });
        }

        const result = await getImagePool().run(
          { kind: 'encoded', bytes: await file.arrayBuffer(), mime: file.type },
          ops,
          { format, quality: 92, optimiseLevel: 3 },
        );
        if (run !== runRef.current) return;
        setOutput(new Uint8Array(result.bytes!));
      } catch (e) {
        if (run !== runRef.current) return;
        setError(e instanceof Error ? e.message : 'The profile picture could not be made.');
      } finally {
        if (run === runRef.current) setBusy(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [file, bitmap, crop, size, transparent, background, borderWidth, borderColor, format]);

  const previewUrl = useRef<string | null>(null);
  useEffect(() => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = output
      ? URL.createObjectURL(new Blob([output as unknown as BlobPart], { type: `image/${format}` }))
      : null;
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, [output, format]);

  const tooSmall = Boolean(crop && crop.width < size * 0.9);

  return (
    <ToolFrame busy={busy} progress={1} busyLabel="Building…">
      <Dropzone
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onFiles={addFiles}
        label={file ? 'Choose a different photo' : 'Drop a photo here'}
        compact={Boolean(file)}
      />

      {error && <ToolNotice variant="warn">{error}</ToolNotice>}

      {bitmap && (
        <>
          <FramedCropper image={bitmap} aspect={1} circle onChange={setCrop} />

          <ToolControls title="Output">
            <ControlGrid>
              <SelectField
                label="Size"
                value={String(size)}
                onChange={(value) => setSize(Number(value))}
                options={SIZES.map((s) => ({
                  value: String(s),
                  label: `${s} x ${s}${s === 800 ? ' — covers most platforms' : ''}`,
                }))}
              />
              <Checkbox
                label="Transparent outside the circle"
                checked={transparent}
                onChange={setTransparent}
                hint="Exports a PNG that sits correctly on any background colour."
              />
              {!transparent && (
                <ColorField
                  label="Background"
                  value={background}
                  onChange={setBackground}
                  presets={['#ffffff', '#000000', '#0f6e60', '#f5f5f5']}
                />
              )}
              <Slider
                label="Border"
                value={borderWidth}
                min={0}
                max={12}
                suffix="%"
                onChange={setBorderWidth}
                hint="A ring around the edge of the circle. Zero for none."
              />
              {borderWidth > 0 && (
                <ColorField
                  label="Border colour"
                  value={borderColor}
                  onChange={setBorderColor}
                  presets={['#ffffff', '#000000', '#0f6e60']}
                />
              )}
            </ControlGrid>

            {tooSmall && (
              <ToolNotice variant="warn">
                The framed area is smaller than the output size, so it is being enlarged and will
                look soft. Choose a smaller output size, or start from a larger photo.
              </ToolNotice>
            )}
          </ToolControls>

          {previewUrl.current && (
            <div class="preview-pane">
              <img
                src={previewUrl.current}
                alt="Preview of the circular profile picture"
                width={Math.min(size, 260)}
                height={Math.min(size, 260)}
                style={`width:${Math.min(size, 260)}px;height:auto`}
              />
            </div>
          )}

          <div class="results__footer">
            <div class="results__summary">
              {output && (
                <p>
                  <strong>{size} x {size}</strong> {format === 'png' ? 'PNG' : 'JPG'} ·{' '}
                  <span class="mono">{formatBytes(output.length)}</span>
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
                    output,
                    `${stemOf(file.name)}-profile-${size}.${format === 'png' ? 'png' : 'jpg'}`,
                    `image/${format}`,
                  )
                }
              >
                Download profile picture
              </button>
            </div>
          </div>
        </>
      )}
    </ToolFrame>
  );
}
