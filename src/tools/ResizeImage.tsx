import { useEffect } from 'preact/hooks';
import { useImageTool, type JobPlan } from './shared/useImageTool';
import Dropzone from './shared/Dropzone';
import ResultList from './shared/ResultList';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import {
  Segmented,
  NumberField,
  Checkbox,
  ControlGrid,
  SelectField,
  Slider,
} from './shared/Controls';
import { PRESETS } from '../data/presets';
import { withSuffix, aspectRatioLabel } from '../lib/files';
import { detectFormat } from '../lib/sniff';
import type { FitMode, ImageFormat } from '../lib/imageTypes';

type Mode = 'pixels' | 'percent' | 'preset';

interface Settings {
  mode: Mode;
  width: number;
  height: number;
  lockAspect: boolean;
  percent: number;
  presetId: string;
  fit: FitMode;
  quality: number;
}

/** The output format follows the input unless the input is something exotic. */
function outputFormatFor(file: File): ImageFormat {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'png';
  if (ext === 'webp') return 'webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  return 'jpeg';
}

export default function ResizeImage() {
  const tool = useImageTool<Settings>(
    {
      mode: 'pixels',
      width: 1080,
      height: 1080,
      lockAspect: true,
      percent: 50,
      presetId: 'ig-square',
      fit: 'fill',
      quality: 85,
    },
    {
      multiple: true,
      autoReprocess: true,
      plan: (file, settings): JobPlan => {
        const format = outputFormatFor(file);
        let width = settings.width;
        let height = settings.height;
        let fit = settings.fit;

        if (settings.mode === 'preset') {
          const preset = PRESETS.find((p) => p.id === settings.presetId);
          if (preset) {
            width = preset.width;
            height = preset.height;
          }
        }

        return {
          ops: [
            settings.mode === 'percent'
              ? // Percentage scaling is expressed as a stretch to the computed
                // size, which keeps the aspect ratio by construction.
                {
                  type: 'resize',
                  width: Math.max(1, Math.round((settings.percent / 100) * (width || 1))),
                  height: Math.max(1, Math.round((settings.percent / 100) * (height || 1))),
                  fit: 'stretch',
                }
              : { type: 'resize', width, height, fit },
          ],
          output: { format, quality: settings.quality, optimiseLevel: 2 },
          name: withSuffix(file.name, `-${width}x${height}`),
        };
      },
    },
  );

  const { settings, setSettings, files } = tool;
  const first = files[0];
  const sourceW = first?.sourceWidth;
  const sourceH = first?.sourceHeight;

  // Seed the fields from the first image so the defaults are never nonsense.
  useEffect(() => {
    if (!sourceW || !sourceH) return;
    setSettings((s) =>
      s.mode === 'pixels' && s.width === 1080 && s.height === 1080
        ? { ...s, width: sourceW, height: sourceH }
        : s,
    );
  }, [sourceW, sourceH, setSettings]);

  const aspect = sourceW && sourceH ? sourceW / sourceH : null;

  const setWidth = (width: number) =>
    setSettings((s) => ({
      ...s,
      width,
      height: s.lockAspect && aspect ? Math.max(1, Math.round(width / aspect)) : s.height,
    }));

  const setHeight = (height: number) =>
    setSettings((s) => ({
      ...s,
      height,
      width: s.lockAspect && aspect ? Math.max(1, Math.round(height * aspect)) : s.width,
    }));

  const percentTarget =
    sourceW && sourceH
      ? `${Math.round((settings.percent / 100) * sourceW)} x ${Math.round(
          (settings.percent / 100) * sourceH,
        )}`
      : null;

  // Percentage mode needs a base size, which comes from the first image.
  const effectiveWidth = settings.mode === 'percent' && sourceW ? sourceW : settings.width;
  const effectiveHeight = settings.mode === 'percent' && sourceH ? sourceH : settings.height;

  const enlarging = Boolean(
    sourceW && sourceH && (effectiveWidth > sourceW * 1.05 || effectiveHeight > sourceH * 1.05),
  );

  return (
    <ToolFrame busy={tool.isWorking} progress={tool.progress} busyLabel="Resizing…">
      <Dropzone
        multiple
        accept="image/*"
        onFiles={tool.addFiles}
        label={files.length ? 'Add more images' : 'Drop images here'}
        compact={files.length > 0}
      />

      {first && sourceW && sourceH && (
        <p class="text-sm text-muted" style="margin-top: var(--space-3)">
          Original: <span class="mono">{sourceW} x {sourceH}</span> ({aspectRatioLabel(sourceW, sourceH)})
        </p>
      )}

      <ToolControls title="Size">
        <ControlGrid>
          <Segmented<Mode>
            label="Resize by"
            value={settings.mode}
            onChange={(mode) => setSettings((s) => ({ ...s, mode }))}
            options={[
              { value: 'pixels', label: 'Pixels' },
              { value: 'percent', label: 'Percent' },
              { value: 'preset', label: 'Preset' },
            ]}
          />

          {settings.mode === 'pixels' && (
            <>
              <NumberField label="Width" value={settings.width} min={1} suffix="px" onChange={setWidth} />
              <NumberField label="Height" value={settings.height} min={1} suffix="px" onChange={setHeight} />
              <Checkbox
                label="Keep proportions"
                checked={settings.lockAspect}
                onChange={(lockAspect) => setSettings((s) => ({ ...s, lockAspect }))}
                hint="Changing one dimension updates the other."
              />
            </>
          )}

          {settings.mode === 'percent' && (
            <Slider
              label="Scale"
              value={settings.percent}
              min={5}
              max={300}
              suffix="%"
              onChange={(percent) => setSettings((s) => ({ ...s, percent }))}
              hint={percentTarget ? `Result: ${percentTarget}` : 'Add an image to see the result size.'}
            />
          )}

          {settings.mode === 'preset' && (
            <SelectField
              label="Platform preset"
              value={settings.presetId}
              onChange={(presetId) => setSettings((s) => ({ ...s, presetId }))}
              options={PRESETS.map((p) => ({
                value: p.id,
                label: `${p.platform} — ${p.placement} (${p.width}x${p.height})`,
              }))}
            />
          )}

          {settings.mode !== 'percent' && (
            <SelectField
              label="If the shape does not match"
              value={settings.fit}
              onChange={(fit) => setSettings((s) => ({ ...s, fit: fit as FitMode }))}
              options={[
                { value: 'fill', label: 'Fill and crop the overflow' },
                { value: 'fit', label: 'Fit inside, leaving space' },
                { value: 'stretch', label: 'Stretch to fit exactly' },
              ]}
              hint={
                settings.fit === 'fill'
                  ? 'Nothing is distorted, but the edges are trimmed.'
                  : settings.fit === 'fit'
                    ? 'The whole image is kept; empty space is left transparent or white.'
                    : 'Forces the exact size. This distorts the picture.'
              }
            />
          )}

          <Slider
            label="Quality"
            value={settings.quality}
            min={40}
            max={100}
            onChange={(quality) => setSettings((s) => ({ ...s, quality }))}
            hint="Applies to JPG and WebP output. PNG is always lossless."
          />
        </ControlGrid>

        {enlarging && (
          <ToolNotice variant="warn">
            You are enlarging this image. Scaling up cannot create detail that was never
            captured, so the result will look soft no matter how good the algorithm is. Start
            from a larger original where you can.
          </ToolNotice>
        )}

        {settings.fit === 'stretch' && (
          <ToolNotice variant="warn">
            Stretch mode distorts the image. Unless you specifically want that, Fill or Fit will
            give a better result.
          </ToolNotice>
        )}
      </ToolControls>

      <ResultList tool={tool} showSavings={false} downloadLabel="Download all as ZIP" />
    </ToolFrame>
  );
}
