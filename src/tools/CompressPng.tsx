import { useImageTool, type JobPlan } from './shared/useImageTool';
import Dropzone from './shared/Dropzone';
import ResultList from './shared/ResultList';
import BeforeAfter from './shared/BeforeAfter';
import ToolFrame, { ToolControls, ToolNotice } from './shared/ToolFrame';
import { Segmented, Slider, Checkbox, ControlGrid } from './shared/Controls';
import { formatBytes } from '../lib/targetSize';
import { withExtension, withSuffix } from '../lib/files';

type Mode = 'lossless' | 'colors';

interface Settings {
  mode: Mode;
  colors: number;
  dither: boolean;
  level: number;
}

/**
 * The PNG compressor.
 *
 * Two modes, labelled honestly. Sites that advertise "70% smaller PNG" are
 * almost always doing colour reduction and calling it lossless compression.
 * Separating them means you always know which one you got, and lossless really
 * does mean pixel-for-pixel identical.
 */
export default function CompressPng() {
  const tool = useImageTool<Settings>(
    { mode: 'lossless', colors: 128, dither: true, level: 3 },
    {
      multiple: true,
      autoReprocess: true,
      keepSourcePreview: true,
      plan: (file, settings): JobPlan => ({
        // Lossless mode sends NO operations, which lets the worker take its
        // fast path: the original bytes go straight to oxipng without ever
        // being decoded, so an existing indexed palette survives untouched.
        ops:
          settings.mode === 'colors'
            ? [{ type: 'quantize', maxColors: settings.colors, dither: settings.dither }]
            : [],
        output: { format: 'png', optimiseLevel: settings.level },
        name: withSuffix(withExtension(file.name, 'png'), '-compressed'),
      }),
    },
  );

  const { settings, setSettings } = tool;
  const single = tool.files.length === 1 ? tool.files[0] : null;

  return (
    <ToolFrame busy={tool.isWorking} progress={tool.progress} busyLabel="Compressing…">
      <Dropzone
        multiple
        accept="image/png,.png"
        onFiles={tool.addFiles}
        label={tool.files.length ? 'Add more images' : 'Drop PNG files here'}
        compact={tool.files.length > 0}
      />

      <ToolControls title="Compression">
        <ControlGrid>
          <Segmented<Mode>
            label="Compression type"
            value={settings.mode}
            onChange={(mode) => setSettings((s) => ({ ...s, mode }))}
            options={[
              { value: 'lossless', label: 'Lossless' },
              { value: 'colors', label: 'Reduce colours' },
            ]}
          />

          {settings.mode === 'lossless' ? (
            <Slider
              label="Effort"
              value={settings.level}
              min={1}
              max={6}
              onChange={(level) => setSettings((s) => ({ ...s, level }))}
              hint="Higher searches harder for a smaller encoding. Above 4 costs a lot of time for very little gain."
            />
          ) : (
            <>
              <Slider
                label="Colours"
                value={settings.colors}
                min={2}
                max={256}
                onChange={(colors) => setSettings((s) => ({ ...s, colors }))}
                hint={
                  settings.colors >= 200
                    ? 'Barely distinguishable from the original.'
                    : settings.colors >= 64
                      ? 'Good balance for logos and illustrations.'
                      : 'Strong reduction — check the preview carefully.'
                }
              />
              <Checkbox
                label="Dither"
                checked={settings.dither}
                onChange={(dither) => setSettings((s) => ({ ...s, dither }))}
                hint="Scatters pixels between nearby colours to hide banding. Leave on for gradients and soft shadows, off for flat graphics."
              />
            </>
          )}
        </ControlGrid>

        {settings.mode === 'lossless' ? (
          <ToolNotice>
            <strong>Lossless:</strong> every pixel comes out exactly as it went in. Expect a
            saving of roughly 10-30%. That is the honest ceiling for lossless PNG — anything
            advertising much more is reducing colours.
          </ToolNotice>
        ) : (
          <ToolNotice variant="warn">
            <strong>Colour reduction changes the image.</strong> Savings of 60-80% are normal, and
            the result is excellent for logos, icons, screenshots and flat illustrations. It is a
            poor fit for photographs — those belong in{' '}
            <a href="/compress-jpg/">JPG</a> or <a href="/compress-webp/">WebP</a>.
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
            alt="The original PNG beside the compressed version"
          />
          {settings.mode === 'lossless' && (
            <p class="text-sm text-muted" style="margin-top: var(--space-3)">
              In lossless mode the two halves are identical by design — the pixels have not
              changed, only how efficiently the file stores them.
            </p>
          )}
        </>
      )}
    </ToolFrame>
  );
}
