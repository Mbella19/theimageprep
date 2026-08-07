import { useRef, useState, useCallback } from 'preact/hooks';

export interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt?: string;
}

/**
 * Drag-to-compare slider.
 *
 * Compression arguments are unwinnable in the abstract — "quality 80" means
 * nothing until you can see it. Both images are stacked at identical size and
 * the top one is clipped, so the comparison is honest rather than two
 * differently-scaled thumbnails side by side.
 */
export default function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Original',
  afterLabel = 'Compressed',
  alt = 'Comparison of the original and processed image',
}: BeforeAfterProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, ratio)));
  }, []);

  const onPointerDown = (event: PointerEvent) => {
    dragging.current = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging.current) return;
    updateFromClientX(event.clientX);
  };

  const onPointerUp = (event: PointerEvent) => {
    dragging.current = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  };

  return (
    <div
      class="compare"
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img class="compare__img" src={afterUrl} alt={alt} draggable={false} />
      {/*
        clip-path rather than a width-constrained wrapper: both images stay at
        the container's full width and stay perfectly registered, so the halves
        line up on the very first frame instead of after a measure-and-reflow.
      */}
      <div
        class="compare__clip"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img class="compare__img" src={beforeUrl} alt="" draggable={false} />
      </div>

      <span class="compare__badge compare__badge--left">{beforeLabel}</span>
      <span class="compare__badge compare__badge--right">{afterLabel}</span>

      <div class="compare__handle" style={{ left: `${position}%` }} aria-hidden="true">
        <span class="compare__grip" />
      </div>

      <input
        class="compare__range"
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label="Comparison position"
        onInput={(e) => setPosition(Number((e.currentTarget as HTMLInputElement).value))}
      />
    </div>
  );
}
