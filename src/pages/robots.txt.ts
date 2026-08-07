import type { APIRoute } from 'astro';
import { SITE } from '../config';

/**
 * robots.txt is generated rather than static so the Sitemap line always matches
 * whatever domain is configured. A hard-coded sitemap URL pointing at the wrong
 * host is a silent, invisible failure.
 *
 * @astrojs/sitemap emits sitemap-index.xml, which in turn references
 * sitemap-0.xml. Point crawlers at the index.
 */
export const GET: APIRoute = () => {
  const origin = SITE.url.replace(/\/+$/, '');

  const body = `# ${SITE.name} — ${SITE.tagline}
# All image processing happens client-side. There is no upload endpoint.

User-agent: *
Allow: /

Sitemap: ${origin}/sitemap-index.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
