import { useMemo } from 'preact/hooks';
import { useImageTool, type JobPlan } from './shared/useImageTool';
import Dropzone from './shared/Dropzone';
import ResultList from './shared/ResultList';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { Segmented, Slider, ControlGrid, ColorField, TextField, Checkbox } from './shared/Controls';
import { parseSizeInput, formatBytes } from '../lib/targetSize';
import { withExtension } from '../lib/files';
import type { ImageFormat, Operation } from '../lib/imageTypes';
import { hexToRgba } from '../lib/color';

type Mode = 'quality' | 'target';

interface Settings {
  mode: Mode;
  quality: number;
  targetInput: string;
  background: string;
  lossless: boolean;
}

export interface ConvertImageProps {
  to: ImageFormat;
  accept: string;
  defaultQuality?: number;
  /** Show a background colour picker — needed when the source may have alpha. */
  needsBackground?: boolean;
  /** WebP only. */
  allowLossless?: boolean;
  /**
   * Explains what happens to metadata for this conversion. Shown as a notice.
   * Used where the answer is not obvious — HEIC in particular.
   */
  metadataNote?: string;
  dropLabel?: string;
  /** Shown while the first file of a heavy format is decoding. */
  slowFirstLoadNote?: string;
}

/**
 * Shared converter behind PNG to JPG, JPG to WebP and HEIC to JPG.
 *
 * One component rather than three because the differences are genuinely just
 * options: which output codec, whether transparency has to be flattened onto a
 * colour first, and whether the source carries metadata worth asking about.
 */
export default function ConvertImage({
  to,
  accept,
  defaultQuality = 82,
  needsBackground = false,
  allowLossless = false,
  metadataNote,
  dropLabel,
  slowFirstLoadNote,
}: ConvertImageProps) {
  const tool = useImageTool<Settings>(
    {
      mode: 'quality',
      quality: defaultQuality,
      targetInput: '500 KB',
      background: '#ffffff',
      lossless: false,
    },
    {
      multiple: true,
      autoReprocess: true,
      plan: (file, settings): JobPlan => {
        const ops: Operation[] = [];

        // JPEG has no alpha channel. Transparent areas must be composited onto
        // something, and that choice cannot be undone later.
        if (needsBackground && to === 'jpeg') {
          ops.push({ type: 'flatten', background: hexToRgba(settings.background) });
        }

        const targetBytes =
          settings.mode === 'target' ? parseSizeInput(settings.targetInput) : undefined;

        return {
          ops,
          output: {
            format: to,
            quality: settings.quality,
            targetBytes: targetBytes ?? undefined,
            lossless: allowLossless ? settings.lossless : undefined,
          },
          name: withExtension(file.name, to),
        };
      },
    },
  );

  const { settings, setSettings } = tool;
  const targetBytes = useMemo(
    () => parseSizeInput(settings.targetInput),
    [settings.targetInput],
  );

  const showQuality = !(allowLossless && settings.lossless);

  return (
    <ToolFrame busy={tool.isWorking} progress={tool.progress} busyLabel="Converting…">
      <Dropzone
        multiple
        accept={accept}
        onFiles={tool.addFiles}
        label={tool.files.length ? 'Add more images' : (dropLabel ?? 'Drop images here')}
        compact={tool.files.length > 0}
      />

      {slowFirstLoadNote && tool.files.length === 0 && (
        <ToolNotice>{slowFirstLoadNote}</ToolNotice>
      )}

      <ToolControls title="Output">
        <ControlGrid>
          {allowLossless && (
            <Checkbox
              label="Lossless"
              checked={settings.lossless}
              onChange={(lossless) => setSettings((s) => ({ ...s, lossless }))}
              hint="Best for logos, screenshots and anything with text or hard edges."
            />
          )}

          {showQuality && (
            <Segmented<Mode>
              label="How should the size be decided?"
              value={settings.mode}
              onChange={(mode) => setSettings((s) => ({ ...s, mode }))}
              options={[
                { value: 'quality', label: 'By quality' },
                { value: 'target', label: 'By target size' },
              ]}
            />
          )}

          {showQuality &&
            (settings.mode === 'quality' ? (
              <Slider
                label="Quality"
                value={settings.quality}
                min={10}
                max={100}
                onChange={(quality) => setSettings((s) => ({ ...s, quality }))}
                hint={
                  to === 'webp'
                    ? 'WebP quality is not the same scale as JPEG. 80 here looks like JPEG 85-90.'
                    : '80-85 is indistinguishable from the original for most photographs.'
                }
              />
            ) : (
              <TextField
                label="Target file size"
                value={settings.targetInput}
                placeholder="500 KB"
                onChange={(targetInput) => setSettings((s) => ({ ...s, targetInput }))}
                hint={
                  targetBytes
                    ? `Best quality that fits under ${formatBytes(targetBytes)}.`
                    : 'Try "500 KB" or "2 MB".'
                }
              />
            ))}

          {needsBackground && to === 'jpeg' && (
            <ColorField
              label="Background for transparent areas"
              value={settings.background}
              onChange={(background) => setSettings((s) => ({ ...s, background }))}
              presets={['#ffffff', '#000000', '#f5f5f5', '#0f6e60']}
              hint="White is what Amazon, eBay and most print services expect."
            />
          )}

        </ControlGrid>

        {needsBackground && to === 'jpeg' && (
          <ToolNotice variant="warn">
            JPG cannot store transparency. Any transparent area will be filled with the colour
            above, permanently. If you need transparency, convert to{' '}
            <a href="/compress-webp/">WebP</a> or keep the PNG.
          </ToolNotice>
        )}

        {metadataNote && <ToolNotice>{metadataNote}</ToolNotice>}
      </ToolControls>

      <ResultList tool={tool} downloadLabel="Download all as ZIP" />
    </ToolFrame>
  );
}
