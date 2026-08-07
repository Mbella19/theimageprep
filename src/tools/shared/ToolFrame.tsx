import type { ComponentChildren } from 'preact';

export interface ToolFrameProps {
  children: ComponentChildren;
  busy?: boolean;
  /** 0-1 */
  progress?: number;
  busyLabel?: string;
}

/**
 * The card every tool sits inside.
 *
 * Keeping the frame identical across all fourteen tools means someone who has
 * used one already knows where the controls and the download button are on the
 * next one.
 */
export default function ToolFrame({
  children,
  busy = false,
  progress = 0,
  busyLabel = 'Working…',
}: ToolFrameProps) {
  return (
    <section class="tool" aria-busy={busy}>
      {busy && (
        <div class="tool__progress" role="status">
          <div class="tool__progress-bar">
            <div
              class="tool__progress-fill"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span class="tool__progress-label">{busyLabel}</span>
        </div>
      )}
      {children}
    </section>
  );
}

/** Grouped settings below the dropzone. */
export function ToolControls({
  children,
  title,
}: {
  children: ComponentChildren;
  title?: string;
}) {
  return (
    <div class="tool__controls">
      {title && <h2 class="tool__controls-title">{title}</h2>}
      {children}
    </div>
  );
}

/** Non-fatal guidance, e.g. "this format cannot store DPI". */
export function ToolNotice({
  children,
  variant = 'info',
}: {
  children: ComponentChildren;
  variant?: 'info' | 'warn';
}) {
  return <div class={`tool__notice tool__notice--${variant}`}>{children}</div>;
}
