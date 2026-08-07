import type { Rgba } from './imageTypes';

/** "#ff8800" -> { r: 255, g: 136, b: 0, a: 255 }. Falls back to white. */
export function hexToRgba(hex: string, alpha = 255): Rgba {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return { r: 255, g: 255, b: 255, a: alpha };

  let value = match[1];
  if (value.length === 3) {
    value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
  }

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
    a: alpha,
  };
}

export function rgbaToHex({ r, g, b }: Rgba): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * Picks black or white text for a given background, using the relative
 * luminance formula so the choice is based on perceived brightness rather than
 * a naive average of the channels.
 */
export function contrastingText(background: Rgba): '#000000' | '#ffffff' {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(background.r) + 0.7152 * channel(background.g) + 0.0722 * channel(background.b);
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
