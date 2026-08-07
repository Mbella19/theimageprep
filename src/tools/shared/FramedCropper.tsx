import { useEffect, useRef, useState, useCallback } from 'preact/hooks';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FramedCropperProps {
  image: ImageBitmap;
  /** Output aspect ratio, width / height. */
  aspect: number;
  /** Draw the frame as a circle. Purely visual; the crop is still a rectangle. */
  circle?: boolean;
  onChange: (rect: CropRect) => void;
  maxDisplayWidth?: number;
}

/**
 * Pan-and-zoom framing, rather than draggable crop handles.
 *
 * The frame is fixed at the requested aspect ratio and the image moves behind
 * it. Two reasons this beats resizable handles: the output dimensions are exact
 * by construction rather than by careful dragging, and one-finger pan plus
 * pinch works properly on a phone, where 8px corner handles are unusable.
 */
export default function FramedCropper({
  image,
  aspect,
  circle = false,
  onChange,
  maxDisplayWidth = 560,
}: FramedCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /** Display pixels per source pixel. */
  const [scale, setScale] = useState(1);
  /** Source coordinate shown at the centre of the frame. */
  const [centre, setCentre] = useState({ x: image.width / 2, y: image.height / 2 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  // Frame occupies most of the canvas, leaving a margin so the surrounding
  // image is visible — you need to see what you are cutting off.
  const MARGIN = 28;

  const layout = useCallback(() => {
    const wrapWidth = wrapRef.current?.clientWidth ?? maxDisplayWidth;
    const width = Math.min(maxDisplayWidth, Math.max(240, wrapWidth));
    // Keep the canvas a sensible shape whatever the target aspect is.
    const frameW = width - MARGIN * 2;
    const frameH = frameW / aspect;
    const height = Math.min(frameH + MARGIN * 2, 520);
    return {
      width,
      height,
      frameW: Math.min(frameW, (height - MARGIN * 2) * aspect),
      frameH: Math.min(frameH, height - MARGIN * 2),
    };
  }, [aspect, maxDisplayWidth]);

  const [frame, setFrame] = useState(() => layout());

  useEffect(() => {
    const next = layout();
    setFrame(next);
    setCanvasSize({ width: next.width, height: next.height });
  }, [layout, image]);

  /** The smallest scale at which the image still covers the whole frame. */
  const minScale = Math.max(frame.frameW / image.width, frame.frameH / image.height);

  // Reset the framing whenever the image or the target shape changes.
  useEffect(() => {
    setScale(minScale);
    setCentre({ x: image.width / 2, y: image.height / 2 });
  }, [image, aspect, minScale]);

  const clamp = useCallback(
    (nextScale: number, nextCentre: { x: number; y: number }) => {
      const s = Math.max(minScale, Math.min(nextScale, minScale * 12));
      const halfW = frame.frameW / s / 2;
      const halfH = frame.frameH / s / 2;
      return {
        scale: s,
        centre: {
          x: Math.max(halfW, Math.min(nextCentre.x, image.width - halfW)),
          y: Math.max(halfH, Math.min(nextCentre.y, image.height - halfH)),
        },
      };
    },
    [minScale, frame.frameW, frame.frameH, image.width, image.height],
  );

  /* ── Draw ──────────────────────────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize.width) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    const cx = canvasSize.width / 2;
    const cy = canvasSize.height / 2;

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      cx - centre.x * scale,
      cy - centre.y * scale,
      image.width * scale,
      image.height * scale,
    );

    // Dim everything outside the frame.
    const fx = cx - frame.frameW / 2;
    const fy = cy - frame.frameH / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, canvasSize.width, canvasSize.height);
    // Second subpath punches the hole. With the even-odd rule the winding
    // direction is irrelevant — only the crossing count matters.
    if (circle) {
      ctx.arc(cx, cy, Math.min(frame.frameW, frame.frameH) / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(fx, fy, frame.frameW, frame.frameH);
    }
    ctx.fill('evenodd');
    ctx.restore();

    // Frame outline
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (circle) {
      ctx.arc(cx, cy, Math.min(frame.frameW, frame.frameH) / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(fx, fy, frame.frameW, frame.frameH);
    }
    ctx.stroke();

    // Rule-of-thirds guides, only on rectangular crops
    if (!circle) {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(fx + (frame.frameW / 3) * i, fy);
        ctx.lineTo(fx + (frame.frameW / 3) * i, fy + frame.frameH);
        ctx.moveTo(fx, fy + (frame.frameH / 3) * i);
        ctx.lineTo(fx + frame.frameW, fy + (frame.frameH / 3) * i);
      }
      ctx.stroke();
    }
  }, [image, scale, centre, canvasSize, frame, circle]);

  /* ── Report the crop rectangle in SOURCE pixels ────────────────────────── */

  useEffect(() => {
    if (!frame.frameW) return;
    const width = frame.frameW / scale;
    const height = frame.frameH / scale;
    onChange({
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
    });
    // onChange identity is not stable across renders in callers; depending on
    // it would fire this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, centre, frame.frameW, frame.frameH]);

  /* ── Pointer interaction ───────────────────────────────────────────────── */

  const onPointerDown = (event: PointerEvent) => {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      // Pinch to zoom.
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinchStart.current) {
        pinchStart.current = { distance, scale };
        return;
      }
      const ratio = distance / pinchStart.current.distance;
      const next = clamp(pinchStart.current.scale * ratio, centre);
      setScale(next.scale);
      setCentre(next.centre);
      return;
    }

    // Dragging moves the image, so the frame appears to travel the other way.
    const dx = (event.clientX - previous.x) / scale;
    const dy = (event.clientY - previous.y) / scale;
    const next = clamp(scale, { x: centre.x - dx, y: centre.y - dy });
    setCentre(next.centre);
  };

  const onPointerUp = (event: PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const next = clamp(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), centre);
    setScale(next.scale);
    setCentre(next.centre);
  };

  const zoomPercent = Math.round((scale / minScale) * 100);

  return (
    <div ref={wrapRef} class="cropper">
      <div class="stage">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
      </div>

      <div class="cropper__controls">
        <label class="cropper__zoom">
          <span class="label">Zoom</span>
          <input
            type="range"
            min={100}
            max={600}
            value={zoomPercent}
            onInput={(e) => {
              const percent = Number((e.currentTarget as HTMLInputElement).value);
              const next = clamp((percent / 100) * minScale, centre);
              setScale(next.scale);
              setCentre(next.centre);
            }}
          />
          <output class="mono">{zoomPercent}%</output>
        </label>
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          onClick={() => {
            setScale(minScale);
            setCentre({ x: image.width / 2, y: image.height / 2 });
          }}
        >
          Reset
        </button>
      </div>

      <p class="text-sm text-muted">Drag to reposition. Scroll or pinch to zoom.</p>
    </div>
  );
}
