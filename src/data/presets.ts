/**
 * PLATFORM SIZE PRESETS
 *
 * Powers the social-media-image-sizes tool, the resize tool's preset menu, and
 * the marketplace guides.
 *
 * ─── MAINTENANCE ──────────────────────────────────────────────────────────────
 * Platforms change these without announcement. `VERIFIED_ON` is surfaced in the
 * UI so visitors know how fresh the data is — update the date when you re-check,
 * and do not update it when you have not. Being visibly honest about staleness
 * is worth more than pretending the numbers are eternal.
 *
 * Sources checked 2026-08-07:
 *   YouTube  support.google.com/youtube/answer/72431  (official)
 *   Amazon   Seller Central image standards           (consistent across sources)
 *   Etsy     2000px shortest side                     (consistent across sources)
 *
 * NOTE ON YOUTUBE: the near-universal advice of "1280x720, max 2MB" is out of
 * date on both counts. YouTube's own documentation now says 3840x2160 with a
 * 640px minimum width, and the 2MB ceiling applies only to uploads from mobile
 * — desktop allows 50MB. Both sizes are offered below.
 */

export const VERIFIED_ON = '2026-08-07';

export type PresetGroup = 'social' | 'marketplace' | 'web';

export interface SizePreset {
  id: string;
  platform: string;
  placement: string;
  width: number;
  height: number;
  group: PresetGroup;
  /** Hard upload ceiling in bytes, where the platform publishes one. */
  maxBytes?: number;
  /** Format the platform expects or handles best. */
  format?: 'jpeg' | 'png';
  /** Shown beneath the preset in the UI. Keep it short and factual. */
  note?: string;
  /** Selected by default in the multi-export tool. */
  popular?: boolean;
}

export const PRESETS: SizePreset[] = [
  // ─────────────────────────────── INSTAGRAM ───────────────────────────────
  {
    id: 'ig-square',
    platform: 'Instagram',
    placement: 'Square post',
    width: 1080,
    height: 1080,
    group: 'social',
    format: 'jpeg',
    popular: true,
  },
  {
    id: 'ig-portrait',
    platform: 'Instagram',
    placement: 'Portrait post',
    width: 1080,
    height: 1350,
    group: 'social',
    format: 'jpeg',
    note: 'Takes the most vertical space in the feed, so it is the best-performing feed format.',
    popular: true,
  },
  {
    id: 'ig-landscape',
    platform: 'Instagram',
    placement: 'Landscape post',
    width: 1080,
    height: 566,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'ig-story',
    platform: 'Instagram',
    placement: 'Story or Reel',
    width: 1080,
    height: 1920,
    group: 'social',
    format: 'jpeg',
    note: 'Keep text away from the top and bottom 250px, where the interface sits.',
    popular: true,
  },
  {
    id: 'ig-profile',
    platform: 'Instagram',
    placement: 'Profile picture',
    width: 320,
    height: 320,
    group: 'social',
    format: 'jpeg',
  },

  // ──────────────────────────────── YOUTUBE ────────────────────────────────
  {
    id: 'yt-thumbnail',
    platform: 'YouTube',
    placement: 'Thumbnail',
    width: 3840,
    height: 2160,
    group: 'social',
    format: 'jpeg',
    maxBytes: 2 * 1024 * 1024,
    note: 'YouTube now recommends 3840x2160. The 2MB cap shown here applies to mobile uploads; desktop allows 50MB.',
    popular: true,
  },
  {
    id: 'yt-thumbnail-hd',
    platform: 'YouTube',
    placement: 'Thumbnail (720p)',
    width: 1280,
    height: 720,
    group: 'social',
    format: 'jpeg',
    maxBytes: 2 * 1024 * 1024,
    note: 'The classic size. Still accepted and still fine, but no longer what YouTube recommends.',
  },
  {
    id: 'yt-shorts',
    platform: 'YouTube',
    placement: 'Shorts cover',
    width: 1080,
    height: 1920,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'yt-banner',
    platform: 'YouTube',
    placement: 'Channel banner',
    width: 2560,
    height: 1440,
    group: 'social',
    format: 'jpeg',
    note: 'Only the central 1546x423 is guaranteed visible on every device. Keep logos and text inside it.',
  },
  {
    id: 'yt-profile',
    platform: 'YouTube',
    placement: 'Profile picture',
    width: 800,
    height: 800,
    group: 'social',
    format: 'png',
  },

  // ───────────────────────────────── TIKTOK ────────────────────────────────
  {
    id: 'tiktok-post',
    platform: 'TikTok',
    placement: 'Video cover',
    width: 1080,
    height: 1920,
    group: 'social',
    format: 'jpeg',
    popular: true,
  },
  {
    id: 'tiktok-profile',
    platform: 'TikTok',
    placement: 'Profile picture',
    width: 200,
    height: 200,
    group: 'social',
    format: 'png',
  },

  // ──────────────────────────────── PINTEREST ──────────────────────────────
  {
    id: 'pin-standard',
    platform: 'Pinterest',
    placement: 'Standard pin',
    width: 1000,
    height: 1500,
    group: 'social',
    format: 'jpeg',
    note: '2:3 is the ratio Pinterest displays without cropping. Taller pins get truncated.',
    popular: true,
  },
  {
    id: 'pin-square',
    platform: 'Pinterest',
    placement: 'Square pin',
    width: 1000,
    height: 1000,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'pin-idea',
    platform: 'Pinterest',
    placement: 'Idea pin',
    width: 1080,
    height: 1920,
    group: 'social',
    format: 'jpeg',
  },

  // ──────────────────────────────── FACEBOOK ───────────────────────────────
  {
    id: 'fb-post',
    platform: 'Facebook',
    placement: 'Feed post',
    width: 1200,
    height: 630,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'fb-cover',
    platform: 'Facebook',
    placement: 'Page cover',
    width: 1640,
    height: 856,
    group: 'social',
    format: 'jpeg',
    note: 'Displays differently on mobile and desktop. Keep anything important well inside the centre.',
  },
  {
    id: 'fb-story',
    platform: 'Facebook',
    placement: 'Story',
    width: 1080,
    height: 1920,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'fb-profile',
    platform: 'Facebook',
    placement: 'Profile picture',
    width: 512,
    height: 512,
    group: 'social',
    format: 'png',
  },

  // ───────────────────────────────── X ─────────────────────────────────────
  {
    id: 'x-post',
    platform: 'X',
    placement: 'Post image',
    width: 1600,
    height: 900,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'x-header',
    platform: 'X',
    placement: 'Header',
    width: 1500,
    height: 500,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'x-profile',
    platform: 'X',
    placement: 'Profile picture',
    width: 400,
    height: 400,
    group: 'social',
    format: 'png',
  },

  // ──────────────────────────────── LINKEDIN ───────────────────────────────
  {
    id: 'li-post',
    platform: 'LinkedIn',
    placement: 'Post image',
    width: 1200,
    height: 627,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'li-banner',
    platform: 'LinkedIn',
    placement: 'Profile banner',
    width: 1584,
    height: 396,
    group: 'social',
    format: 'jpeg',
  },
  {
    id: 'li-profile',
    platform: 'LinkedIn',
    placement: 'Profile picture',
    width: 400,
    height: 400,
    group: 'social',
    format: 'png',
  },

  // ─────────────────────────────── MARKETPLACES ────────────────────────────
  {
    id: 'etsy-listing',
    platform: 'Etsy',
    placement: 'Listing photo',
    width: 2000,
    height: 2000,
    group: 'marketplace',
    format: 'jpeg',
    note: 'Etsy asks for at least 2000px on the shortest side. Below that it upscales for you, and it looks it.',
    popular: true,
  },
  {
    id: 'etsy-banner',
    platform: 'Etsy',
    placement: 'Shop banner',
    width: 1600,
    height: 400,
    group: 'marketplace',
    format: 'jpeg',
  },
  {
    id: 'etsy-icon',
    platform: 'Etsy',
    placement: 'Shop icon',
    width: 500,
    height: 500,
    group: 'marketplace',
    format: 'jpeg',
  },
  {
    id: 'amazon-main',
    platform: 'Amazon',
    placement: 'Main product image',
    width: 1600,
    height: 1600,
    group: 'marketplace',
    format: 'jpeg',
    note: 'Needs 1000px minimum on the longest side to enable zoom; 1600px is recommended. Pure white background, product filling about 85% of the frame, and no text, logos or watermarks.',
    popular: true,
  },
  {
    id: 'ebay-listing',
    platform: 'eBay',
    placement: 'Listing photo',
    width: 1600,
    height: 1600,
    group: 'marketplace',
    format: 'jpeg',
    note: 'eBay requires at least 500px on the longest side; 1600px unlocks the zoom viewer.',
  },
  {
    id: 'shopify-product',
    platform: 'Shopify',
    placement: 'Product image',
    width: 2048,
    height: 2048,
    group: 'marketplace',
    format: 'jpeg',
  },

  // ─────────────────────────────────── WEB ─────────────────────────────────
  {
    id: 'og-image',
    platform: 'Web',
    placement: 'Open Graph / link preview',
    width: 1200,
    height: 630,
    group: 'web',
    format: 'jpeg',
    note: 'The image shown when your page is shared on social platforms or in messaging apps.',
    popular: true,
  },
  {
    id: 'blog-hero',
    platform: 'Web',
    placement: 'Blog hero',
    width: 1600,
    height: 900,
    group: 'web',
    format: 'jpeg',
  },
  {
    id: 'favicon-source',
    platform: 'Web',
    placement: 'Favicon source',
    width: 512,
    height: 512,
    group: 'web',
    format: 'png',
    note: 'Feed this into the favicon generator to produce the full icon set.',
  },
];

/** Common aspect ratios offered in the crop tool. */
export const ASPECT_RATIOS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1-1', label: '1:1 Square', ratio: 1 },
  { id: '4-5', label: '4:5 Portrait', ratio: 4 / 5 },
  { id: '3-2', label: '3:2', ratio: 3 / 2 },
  { id: '2-3', label: '2:3 Pin', ratio: 2 / 3 },
  { id: '4-3', label: '4:3', ratio: 4 / 3 },
  { id: '16-9', label: '16:9 Video', ratio: 16 / 9 },
  { id: '9-16', label: '9:16 Story', ratio: 9 / 16 },
] as const;

/** DPI values offered in the DPI tool. */
export const DPI_PRESETS = [
  { value: 72, label: '72 — legacy screen' },
  { value: 96, label: '96 — Windows screen' },
  { value: 150, label: '150 — draft print' },
  { value: 300, label: '300 — standard print' },
  { value: 600, label: '600 — fine art print' },
] as const;

/** Favicon sizes produced by the generator. */
export const FAVICON_SIZES = [
  { size: 16, file: 'favicon-16x16.png', purpose: 'Browser tab' },
  { size: 32, file: 'favicon-32x32.png', purpose: 'Browser tab, retina' },
  { size: 48, file: 'favicon-48x48.png', purpose: 'Windows taskbar' },
  { size: 180, file: 'apple-touch-icon.png', purpose: 'iOS home screen' },
  { size: 192, file: 'android-chrome-192x192.png', purpose: 'Android home screen' },
  { size: 512, file: 'android-chrome-512x512.png', purpose: 'PWA splash screen' },
] as const;

/** Sizes embedded inside the generated multi-resolution favicon.ico. */
export const ICO_SIZES = [16, 32, 48] as const;

export function presetsByPlatform(group?: PresetGroup): Map<string, SizePreset[]> {
  const map = new Map<string, SizePreset[]>();
  for (const p of PRESETS) {
    if (group && p.group !== group) continue;
    const list = map.get(p.platform) ?? [];
    list.push(p);
    map.set(p.platform, list);
  }
  return map;
}
