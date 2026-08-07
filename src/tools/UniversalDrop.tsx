import { useCallback, useRef, useState } from 'preact/hooks';
import { detectFormat } from '../lib/sniff';
import { pickToolForFormat, reasonForFormat } from '../lib/pickTool';
import { stashFile, handoffUrl } from '../lib/handoff';

/**
 * The homepage dropzone. Takes any image, works out which tool the visitor
 * actually needs, and sends them there with the file already loaded.
 *
 * The format is read from the file's own magic bytes rather than its name or
 * its reported MIME type. Both of those lie constantly: macOS and Windows hand
 * over an empty type for .heic, screenshots get renamed, and a file called
 * .jpg is frequently a PNG.
 *
 * Only the first 32 bytes are read, so this stays instant on a 50 MB file.
 */
export default function UniversalDrop() {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const handle = useCallback(async (file: File | undefined) => {
    if (!file) return;

    const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const format = detectFormat(header);
    const slug = pickToolForFormat(format);

    setStatus(reasonForFormat(format));

    // If the handoff cannot be stored — private browsing, a full disk, an old
    // browser — still navigate. The tool page opens with an empty dropzone,
    // which is a smaller failure than swallowing the click entirely.
    await stashFile(file);
    window.location.href = handoffUrl(slug);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void handle(event.dataTransfer?.files?.[0]);
    },
    [handle],
  );

  return (
    <div
      class={`udrop${dragging ? ' is-dragging' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <span class="udrop__icon" aria-hidden="true" />
      <p class="udrop__title">{status ?? 'Drop any image to begin'}</p>
      <p class="udrop__hint">
        JPG · PNG · WebP · HEIC · AVIF — or paste from the clipboard
      </p>

      <button
        type="button"
        class="btn btn--primary udrop__cta"
        onClick={() => inputRef.current?.click()}
        disabled={status !== null}
      >
        {status ? 'Opening…' : 'Choose a file'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        class="visually-hidden"
        onChange={(e) => {
          const input = e.currentTarget as HTMLInputElement;
          void handle(input.files?.[0]);
          input.value = '';
        }}
      />

      <p class="udrop__note mono">We pick the right tool for what you drop</p>
    </div>
  );
}
