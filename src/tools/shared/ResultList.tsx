import type { ImageTool, ToolFile } from './useImageTool';
import { formatBytes, savingsPercent } from '../../lib/targetSize';
import { formatDimensions } from '../../lib/files';

export interface ResultListProps {
  tool: ImageTool<any>;
  /** Hide the size-saving column for tools where shrinking is not the point. */
  showSavings?: boolean;
  /** Verb for the download button, e.g. "Download converted". */
  downloadLabel?: string;
}

function SavingsBadge({ before, after }: { before: number; after: number }) {
  const percent = savingsPercent(before, after);
  if (percent > 0) {
    return <span class="badge badge--good">{percent}% smaller</span>;
  }
  if (percent === 0) {
    return <span class="badge">no change</span>;
  }
  return <span class="badge badge--warn">{Math.abs(percent)}% larger</span>;
}

function FileRow({
  entry,
  tool,
  showSavings,
}: {
  entry: ToolFile;
  tool: ImageTool<any>;
  showSavings: boolean;
}) {
  return (
    <li class="result-row">
      <div class="result-row__thumb">
        {entry.result ? (
          <img src={entry.result.previewUrl} alt="" loading="lazy" />
        ) : entry.sourcePreviewUrl ? (
          <img src={entry.sourcePreviewUrl} alt="" loading="lazy" />
        ) : (
          <div class="result-row__placeholder" />
        )}
      </div>

      <div class="result-row__body">
        <p class="result-row__name" title={entry.file.name}>
          {entry.result?.outputName ?? entry.file.name}
        </p>

        {entry.status === 'working' && <p class="result-row__meta">Processing…</p>}

        {entry.status === 'error' && <p class="result-row__error">{entry.error}</p>}

        {entry.status === 'done' && entry.result && (
          <p class="result-row__meta">
            <span class="mono">{formatBytes(entry.originalSize)}</span>
            {' → '}
            <span class="mono">{formatBytes(entry.result.bytes.length)}</span>
            {' · '}
            <span class="mono">
              {formatDimensions(entry.result.width, entry.result.height)}
            </span>
            {entry.result.quality !== undefined && (
              <>
                {' · '}quality {entry.result.quality}
              </>
            )}
            {entry.result.paletteSize !== undefined && (
              <>
                {' · '}
                {entry.result.paletteSize} colours
              </>
            )}
          </p>
        )}

        {entry.result?.reachedTarget === false && (
          <p class="result-row__warn">
            Could not reach the target size at usable quality. Reducing the pixel dimensions
            shrinks a file far faster than quality does.
          </p>
        )}

        {entry.result?.usedQuantization === false && (
          <p class="result-row__warn">
            Colour reduction made this file larger than lossless optimisation did, so the
            lossless version was kept. That happens on smooth gradients, where dithering adds
            noise that PNG cannot compress.
          </p>
        )}
      </div>

      <div class="result-row__actions">
        {entry.status === 'done' && showSavings && entry.result && (
          <SavingsBadge before={entry.originalSize} after={entry.result.bytes.length} />
        )}
        {entry.status === 'done' && (
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            onClick={() => tool.downloadOne(entry.id)}
          >
            Download
          </button>
        )}
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          aria-label={`Remove ${entry.file.name}`}
          onClick={() => tool.removeFile(entry.id)}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

export default function ResultList({
  tool,
  showSavings = true,
  downloadLabel = 'Download all as ZIP',
}: ResultListProps) {
  if (tool.files.length === 0) return null;

  const multiple = tool.files.length > 1;
  const allDone = tool.doneCount > 0;
  const totalSaving = savingsPercent(tool.totalOriginalBytes, tool.totalOutputBytes);

  return (
    <div class="results">
      <ul class="result-list">
        {tool.files.map((entry) => (
          <FileRow key={entry.id} entry={entry} tool={tool} showSavings={showSavings} />
        ))}
      </ul>

      {allDone && (
        <div class="results__footer">
          <div class="results__summary">
            {multiple && showSavings && tool.totalOutputBytes > 0 && (
              <p>
                <strong>
                  {tool.doneCount} file{tool.doneCount === 1 ? '' : 's'}
                </strong>
                {' · '}
                <span class="mono">{formatBytes(tool.totalOriginalBytes)}</span>
                {' → '}
                <span class="mono">{formatBytes(tool.totalOutputBytes)}</span>
                {totalSaving > 0 && <> · saved {totalSaving}% overall</>}
              </p>
            )}
          </div>

          <div class="results__actions">
            <button type="button" class="btn btn--ghost btn--sm" onClick={tool.reset}>
              Clear all
            </button>
            <button
              type="button"
              class="btn btn--primary"
              disabled={tool.zipping}
              onClick={() => void tool.downloadAll()}
            >
              {tool.zipping
                ? 'Building ZIP…'
                : multiple
                  ? downloadLabel
                  : 'Download'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
