# The Image Prep — image tools for creators and online sellers

**[theimageprep.com](https://theimageprep.com)**

A static site with 14 browser-based image tools. Every operation runs client-side
via WebAssembly, so there is no server, no upload, and effectively no hosting cost.

> Brand and domain live in [`src/config.ts`](src/config.ts) and everything follows from
> there — titles, canonicals, sitemap, robots.txt, Open Graph tags, structured data,
> nav, footer and legal pages. Change `name` and you must also run `npm run assets`,
> because the favicons and OG cards have the name rendered into the pixels.
>
> `url` is the single canonical origin: **apex, no `www`**. Cloudflare Pages redirects
> `www` to it. Never serve both — see [docs/deploy.md](docs/deploy.md).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
```

```bash
npm run build        # builds to dist/ AND runs the SEO audit
npm test             # unit tests (metadata surgery, quantiser, ICO, target-size search)
npm run verify       # drives a real browser through every tool
npm run assets       # regenerates favicons and Open Graph cards
```

`npm run build` fails if the SEO audit fails. That is deliberate — see below.

---

## What is here

| | |
|---|---|
| **14 tools** | compress JPG/PNG/WebP · PNG→JPG · JPG→WebP · HEIC→JPG · resize · crop · remove EXIF · change DPI · watermark · profile picture · favicon generator · social media sizes |
| **5 category hubs** | `/compress/` `/convert/` `/resize/` `/metadata/` `/generate/` |
| **8 guides** | Etsy, Amazon, eBay, YouTube, Instagram, EXIF, 300 DPI, format choice |
| **Support pages** | about, contact, privacy policy, terms, 404 |
| **35 pages total** | all statically generated, all in the sitemap |

---

## The three things this does better than the competition

These are the reasons to prefer this site over the many alternatives, and they are
worth protecting when changing code.

**1. Target file size, not just a quality slider.**
Real limits are stated in megabytes. [`src/lib/targetSize.ts`](src/lib/targetSize.ts)
binary-searches encoder quality to find the best result under a byte budget, in ≤8
encodes. Most free compressors leave the user guessing.

**2. Metadata editing that never re-encodes.**
[`src/lib/metadata/`](src/lib/metadata/) walks the JPEG/PNG/WebP container and rewrites
only the metadata blocks, copying compressed picture data across byte-for-byte. The
test suite proves the output is **pixel-identical** by decoding both files with `sharp`
and comparing raw buffers. Most tools decode and re-save, silently costing a generation
of quality.

**3. DPI that actually sticks.**
A JPEG stores resolution in *two* places — JFIF density and EXIF `XResolution`. Nearly
every online DPI tool writes only JFIF; Photoshop and Word read EXIF, see the old value,
and the change appears to do nothing. [`src/lib/metadata/jpeg.ts`](src/lib/metadata/jpeg.ts)
writes both and forces the EXIF unit to inches.

Plus one that is not a differentiator so much as a bug most competitors have:
`imageOrientation: 'from-image'` is set on every decode, so phone photos do not come
back sideways.

---

## Architecture

```
src/
  config.ts              ← the only file to edit for rebranding
  data/tools.ts          ← tool registry: drives pages, nav, footer, schema, sitemap
  data/presets.ts        ← platform sizes, with the date they were last verified
  lib/
    worker/imageWorker.ts  all decode/encode/transform work
    workerPool.ts          up to 4 workers for batch jobs
    metadata/{jpeg,png,webp}.ts   lossless container surgery
    quantize.ts            median cut + Floyd-Steinberg (no maintained WASM alternative)
    targetSize.ts  ico.ts  zip.ts  exifRead.ts  sniff.ts
  tools/                 one Preact island per tool + shared/ UI
  layouts/               Base · ToolPage · Category · Guide · Page
  content/guides/        Markdown articles
  pages/                 35 routes
scripts/
  audit-seo.mjs          post-build gate (see below)
  verify-browser.mjs     Playwright end-to-end checks
  make-assets.mjs        favicons + OG cards
  make-fixtures.mjs      test images
```

**Adding a tool** = add an entry to `src/data/tools.ts`, add a component in `src/tools/`,
add a page in `src/pages/`. Nav, footer, category hub, related links, breadcrumbs,
structured data and the sitemap all update automatically.

### Codecs

| Package | Used for |
|---|---|
| `@jsquash/jpeg` | MozJPEG — smaller than the browser's own encoder at the same quality |
| `@jsquash/webp` | libwebp, lossy and lossless |
| `@jsquash/oxipng` | lossless PNG optimisation |
| `@jsquash/resize` | Lanczos3 resampling |
| `heic-to` | libheif — lazy-loaded, ~3 MB, only fetched when a HEIC is dropped |

All are dynamically imported so a page downloads only the WASM it actually uses.

---

## Two constraints that must not be broken

**Never add COOP/COEP headers.** Cross-origin isolation would enable multi-threaded
WASM, which is tempting — but it also blocks third-party iframes, which breaks AdSense
completely. The codecs here are single-threaded and do not need it. See the comments in
[`public/_headers`](public/_headers).

**Never put an ad slot next to the tool controls.** Google's ad placement policy
prohibits ads adjacent to action items because they cause accidental clicks, and the
penalty lands on the whole account. `AdSlot` placements live below the explanatory
content — see [`src/components/AdSlot.astro`](src/components/AdSlot.astro).

---

## The SEO audit

`scripts/audit-seo.mjs` runs after every build and **fails the build** on:

- missing or duplicate `<title>` / meta description, or a title over 65 chars
- missing, relative, or mismatched canonical
- `<h1>` count ≠ 1
- missing Open Graph tags, or invalid JSON-LD
- **broken internal links** (any `<a href>` that resolves to no file in `dist/`)
- **missing referenced assets** (favicons, OG images — otherwise silent 404s)
- an indexable page absent from the sitemap, or the 404 page present in it
- robots.txt missing, lacking an absolute `Sitemap:` line, or disallowing everything

SEO faults are invisible while browsing. Without this check they accumulate silently
for months, which is exactly what happens to sites like this one.

---

## Testing

Three tiers, each catching what the one below cannot. `npm run verify:all` runs them all.

**`npm test`** — 73 unit tests over the pure logic: container surgery, the quantiser,
the ICO writer, the target-size search, orientation transforms and path handling. The
important ones prove the lossless claims by decoding with `sharp` and comparing raw
pixel buffers.

**`npm run verify`** — 33 structural checks. Launches Chromium against the built site
and pushes real files through every tool, confirming hydration, workers and WASM
actually function and that nothing errors. A green build proves none of that.

**`npm run verify:outputs`** — 91 checks that the output is *correct*, not merely
present. It captures the actual downloaded files and inspects the bytes:

- a photo tagged EXIF orientation 6 comes back **480×640, not 640×480**
- target-size mode lands **under** the budget while still using most of it
- EXIF removal is **pixel-identical** and leaves **no APP1 segment**
- DPI is read back as 300 by `sharp` *and* from the **EXIF** field specifically
- `favicon.ico` is a real 3-entry ICO whose entries contain valid PNG data
- the circle mask has **transparent corners, an opaque centre and a feathered rim**
- every file in the social-sizes ZIP matches the dimensions in its own filename
- flattening puts the chosen background colour in a formerly transparent corner

### Three real bugs this tier caught

Worth recording, because none were visible in the UI and all three passed the
structural checks:

1. **Every image was decoding through the wrong path.** `bitmap.close()` ran *before*
   `getImageData` read `bitmap.width` — and `close()` sets dimensions to 0 per spec. The
   call threw, a bare `catch {}` swallowed it, and every decode silently fell back to the
   WASM decoder, which ignores EXIF orientation. Portrait phone photos came out sideways,
   which is precisely the bug the site claims to fix. The catch now logs, and the fallback
   applies orientation itself.
2. **Colour reduction could return a file 12× larger than lossless.** On a smooth
   gradient, dithering turns compressible data into incompressible noise. The PNG encoder
   now computes the alternatives and keeps the smallest, telling the user when colour
   reduction lost.
3. **ZIP subfolders were being flattened.** `safeFileName` replaces `/` with `-`, so
   `instagram/photo.jpg` became `instagram-photo.jpg`. Added `safeZipPath`, which
   sanitises each segment and preserves separators.

> **HEIC is now covered too.** `sharp` cannot write HEIC, but macOS `sips` can, so
> `npm run fixtures` generates a real one. A genuine iPhone photo is still worth a manual
> pass — Live Photos and HDR gain maps have quirks a `sips` file does not reproduce.

---

## Deploying

The site is static — `dist/` **is** the website. No Node process runs in production.

**Cloudflare Pages** (what runs live today):

```bash
npm run build
npx wrangler pages deploy dist --project-name=theimageprep
```

**A VPS** — clone, build, serve:

```bash
git clone https://github.com/Mbella19/theimageprep.git
cd theimageprep && npm ci && npm run build
sudo ln -s "$PWD/deploy/Caddyfile" /etc/caddy/Caddyfile && sudo systemctl restart caddy
```

Updates after that are one command: `./scripts/deploy-vps.sh`.

[`deploy/Caddyfile`](deploy/Caddyfile) handles TLS automatically and restates
everything [`public/_headers`](public/_headers) does — **only Cloudflare Pages reads
that file**, so on any other host it is inert. Full walkthrough and the four things
that break a static deploy of this site:
**[docs/vps-deploy.md](docs/vps-deploy.md)**.

## Next steps

1. **[docs/deploy.md](docs/deploy.md)** — Cloudflare Pages, custom domain, headers
2. **[docs/vps-deploy.md](docs/vps-deploy.md)** — self-hosting on a plain Linux box
3. **[docs/search-console.md](docs/search-console.md)** — verification, sitemap, and the
   ongoing keyword workflow
4. **[docs/adsense-setup.md](docs/adsense-setup.md)** — when to apply, and the mandatory
   consent management platform for EEA/UK traffic
5. **[docs/launch-checklist.md](docs/launch-checklist.md)** — what to check before and
   after going live
