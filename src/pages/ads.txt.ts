import type { APIRoute } from 'astro';
import { SITE } from '../config';

/**
 * ads.txt — the IAB authorised-sellers file.
 *
 * It declares which ad networks are allowed to sell this site's inventory.
 * Without it AdSense shows a persistent "Earnings at risk" warning, and some
 * buyers discount or skip unauthorised inventory outright.
 *
 * ─── Why this is generated rather than a static file in public/ ──────────────
 * An ads.txt that exists but does NOT list your publisher ID is actively worse
 * than no file at all: per the spec, a present file is exhaustive, so anything
 * unlisted is treated as unauthorised. Deriving it from the one place the
 * publisher ID lives means the two can never disagree.
 *
 * The trailing value is Google's own TAG certification ID. It is the same for
 * every AdSense publisher and is not a secret.
 */
export const GET: APIRoute = () => {
  const client = SITE.adsense.client.trim();

  if (!client) {
    // Nothing configured yet. Emit only a comment — no seller lines — so the
    // file cannot accidentally declare that nobody may sell this inventory.
    return new Response(
      '# No ad network configured yet. See src/config.ts and docs/adsense-setup.md.\n',
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  // ads.txt wants the bare publisher ID: "pub-123…", not "ca-pub-123…".
  const publisherId = client.replace(/^ca-/, '');

  const body = `# ${SITE.name} — authorised digital sellers
# https://iabtechlab.com/ads-txt/
google.com, ${publisherId}, DIRECT, f08c47fec0942fa0
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
