import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import { SITE } from './src/config';

// https://astro.build/config
export default defineConfig({
  // `site` is REQUIRED for @astrojs/sitemap. Without it the integration
  // silently generates nothing — the single most common Astro sitemap failure.
  site: SITE.url,

  // One canonical shape for every URL. Prevents /compress-jpg and
  // /compress-jpg/ being crawled as two separate pages.
  trailingSlash: 'always',
  output: 'static',

  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },

  integrations: [
    preact(),
    mdx(),
    sitemap({
      // 404 must never appear in the sitemap.
      filter: (page) => !page.includes('/404'),
      changefreq: 'weekly',
      lastmod: new Date(),
      serialize(item) {
        // Tool pages are the money pages; hint that to crawlers.
        const path = new URL(item.url).pathname;
        const depth = path.split('/').filter(Boolean).length;
        if (path === '/') item.priority = 1.0;
        else if (depth === 1) item.priority = 0.9;
        else item.priority = 0.7;
        return item;
      },
    }),
  ],

  vite: {
    // jSquash ships pre-built WASM; letting Vite pre-bundle it breaks the
    // wasm URL resolution. This is the documented workaround.
    optimizeDeps: {
      exclude: [
        '@jsquash/jpeg',
        '@jsquash/png',
        '@jsquash/webp',
        '@jsquash/oxipng',
        '@jsquash/resize',
        'heic-to',
      ],
    },
    worker: {
      format: 'es',
    },
  },
});
