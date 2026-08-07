import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  /** `accept` attribute for the file input. */
  accept?: string;
  label?: string;
  hint?: string;
  compact?: boolean;
  disabled?: boolean;
}

export default function Dropzone({
  onFiles,
  multiple = false,
  accept = 'image/*',
  label,
  hint,
  compact = false,
  disabled = false,
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  // Pasting a screenshot straight in is how a lot of people actually arrive at
  // a tool like this, and it costs almost nothing to support.
  useEffect(() => {
    if (disabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.files;
      if (items && items.length > 0) {
        event.preventDefault();
        handleFiles(items);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFiles, disabled]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer?.files ?? null);
  };

  return (
    <div
      class={`dropzone ${dragging ? 'is-dragging' : ''} ${compact ? 'dropzone--compact' : ''} ${
        disabled ? 'is-disabled' : ''
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current++;
        if (!disabled) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        // Entering a child element fires dragleave on the parent, so count
        // depth rather than clearing on the first leave — otherwise the
        // highlight flickers as the cursor moves across the zone.
        dragDepth.current--;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        class="visually-hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const input = e.currentTarget as HTMLInputElement;
          handleFiles(input.files);
          // Reset so choosing the same file twice still fires a change event.
          input.value = '';
        }}
      />

      <button
        type="button"
        class="dropzone__button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <svg
          class="dropzone__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 16V4m0 0L8 8m4-4l4 4" />
          <path d="M3 15v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-3" />
        </svg>
        <span class="dropzone__label">
          {label ?? (multiple ? 'Drop images here' : 'Drop an image here')}
        </span>
        <span class="dropzone__hint">
          {hint ?? 'or click to browse — you can also paste from the clipboard'}
        </span>
      </button>
    </div>
  );
}
