import { useMemo } from 'preact/hooks';
import { useImageTool, type JobPlan } from './shared/useImageTool';
import Dropzone from './shared/Dropzone';
import ResultList from './shared/ResultList';
import BeforeAfter from './shared/BeforeAfter';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { Segmented, Slider, ControlGrid, TextField } from './shared/Controls';
import { parseSizeInput, formatBytes } from '../lib/targetSize';
import { withExtension, withSuffix } from '../lib/files';
import type { ImageFormat } from '../lib/imageTypes';

type Mode = 'quality' | 'target';

interface Settings {
  mode: Mode;
  quality: number;
  targetInput: string;
  lossless: boolean;
}

export interface CompressImageProps {
  format: ImageFormat;
  accept?: string;
  defaultQuality?: number;
  /** WebP can do lossless; JPEG cannot. */
  allowLossless?: boolean;
}

/**
 * The JPEG and WebP compressor.
 *
 * The Target size mode is the reason this tool exists. Requirements arrive as
 * "under 2 MB", never as "quality 74", and searching for the quality that fits
 * is something the computer should be doing rather than the person.
 */
export default function CompressImage({
  format,
  accept = 'image/jpeg,image/jpg',
  defaultQuality = 80,
  allowLossless = false,
}: CompressImageProps) {
  const tool = useImageTool<Settings>(
    { mode: 'quality', quality: defaultQuality, targetInput: '500 KB', lossless: false },
    {
      multiple: true,
      autoReprocess: true,
      keepSourcePreview: true,
      plan: (file, settings): JobPlan => {
        const targetBytes =
          settings.mode === 'target' ? parseSizeInput(settings.targetInput) : undefined;

        return {
          ops: [],
          output: {
            format,
            quality: settings.quality,
            targetBytes: targetBytes ?? undefined,
            lossless: allowLossless ? settings.lossless : undefined,
            minQuality: 20,
          },
          name: withSuffix(withExtension(file.name, format), '-compressed'),
        };
      },
    },
  );

  const { settings, setSettings } = tool;

  const targetBytes = useMemo(
    () => parseSizeInput(settings.targetInput),
    [settings.targetInput],
  );

  const targetInvalid = settings.mode === 'target' && targetBytes === null;

  // Only worth showing the slider comparison for a single image; on a batch it
  // is unclear which file it refers to.
  const single = tool.files.length === 1 ? tool.files[0] : null;

  return (
    <ToolFrame busy={tool.isWorking} progress={tool.progress} busyLabel="Compressing…">
      <Dropzone
        multiple
        accept={accept}
        onFiles={tool.addFiles}
        label={tool.files.length ? 'Add more images' : 'Drop images here'}
        compact={tool.files.length > 0}
      />

      <ToolControls title="Compression">
        <ControlGrid>
          <Segmented<Mode>
            label="How should the size be decided?"
            value={settings.mode}
            onChange={(mode) => setSettings((s) => ({ ...s, mode }))}
            options={[
              { value: 'quality', label: 'By quality' },
              { value: 'target', label: 'By target size' },
            ]}
          />

          {settings.mode === 'quality' ? (
            <Slider
              label="Quality"
              value={settings.quality}
              min={10}
              max={100}
              onChange={(quality) => setSettings((s) => ({ ...s, quality }))}
              hint={
                settings.quality >= 85
                  ? 'Very close to the original. Larger files.'
                  : settings.quality >= 70
                    ? 'The sweet spot for photographs.'
                    : 'Visible artefacts in skies and smooth gradients.'
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
                  ? `Searching for the best quality under ${formatBytes(targetBytes)}.`
                  : 'Try "500 KB", "2 MB" or "150kb".'
              }
            />
          )}
        </ControlGrid>

        {targetInvalid && (
          <ToolNotice variant="warn">
            That size could not be understood. Use something like <code>500 KB</code> or{' '}
            <code>2 MB</code>.
          </ToolNotice>
        )}
      </ToolControls>

      <ResultList tool={tool} downloadLabel="Download all as ZIP" />

      {single?.result && single.sourcePreviewUrl && (
        <>
          <BeforeAfter
            beforeUrl={single.sourcePreviewUrl}
            afterUrl={single.result.previewUrl}
            beforeLabel={`Original · ${formatBytes(single.originalSize)}`}
            afterLabel={`Compressed · ${formatBytes(single.result.bytes.length)}`}
            alt="The original image beside the compressed version"
          />
          <p class="text-sm text-muted" style="margin-top: var(--space-3)">
            Drag the divider to compare. Both sides are shown at the same size, so any
            difference you can see here is a real difference in the file.
          </p>
        </>
      )}
    </ToolFrame>
  );
}
