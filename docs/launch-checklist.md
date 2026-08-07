# Launch checklist

## Before deploying

- [x] `src/config.ts` — `The Image Prep` / `https://theimageprep.com` / `hello@theimageprep.com`
- [x] `npm run assets` — favicons and 20 OG cards redrawn with the brand name
- [x] Canonical hostname chosen: **apex, no `www`** (`www` gets a 301, see deploy.md)
- [x] `npm run verify:all` — 73 unit + 35-page SEO audit + 33 browser + 91 output checks
- [ ] Cloudflare **Email Routing** for `hello@theimageprep.com` — it is printed on four
      pages and in the Organization schema, and bounces until a mailbox exists

## Manual checks the automated tests cannot cover

The automated suite now covers all 14 tools and verifies the actual downloaded bytes,
including orientation, losslessness, DPI fields, the ICO structure and ZIP contents.
What is left genuinely needs a human, a real device, or a real network.

- [ ] **A genuine iPhone photo through HEIC → JPG.** The automated fixture comes from
      macOS `sips`, which produces a valid HEIC but not the quirks of a real capture —
      Live Photos, HDR gain maps, depth data. Check it is **upright**, and that a batch
      of 10+ downloads as a ZIP.
- [ ] **A real portrait phone photo through the compressor.** Must come out portrait.
      This is verified automatically with a synthetic fixture, but real cameras use
      orientations 3, 6 and 8 in the wild and it is worth one real confirmation.
- [ ] **300 DPI output opened in Preview or Photoshop.** Verified via `sharp`, but
      confirming in the actual application people complain about is worth the minute.
- [ ] **Offline test.** Load a tool, disconnect from the network, process an image. It
      must still work — this is the privacy claim, and nothing else proves it.
- [ ] **Mobile at 375px on a real touch device.** Especially crop and watermark:
      one-finger drag and pinch-zoom behave differently from synthetic pointer events.
- [ ] **A large batch** (30+ files) through the HEIC or JPG tool, to see how the worker
      pool behaves under real memory pressure.
Dark mode has been checked (the palette and accent adapt correctly), so it is not on
this list — but glance at it if you change any colours.

## After deploying

Live since **7 Aug 2026** at https://theimageprep.com (Cloudflare Pages project
`theimageprep`). All of the following were verified against the live domain:

- [x] Valid TLS certificate on apex and `www`
- [x] `/does-not-exist` returns a genuine **404**, not a soft 404
- [x] `robots.txt` and both sitemaps carry the real domain; 34 URLs, no 404 leaked in
- [x] `favicon.ico`, `site.webmanifest`, all tool and guide routes return 200
- [x] `.wasm` served as `application/wasm` with a 1-year immutable cache — a wrong MIME
      type here breaks every codec, and it is invisible until someone drops an image
- [x] Indexable pages carry `index, follow`; the 404 carries `noindex, nofollow`
- [x] `www` → apex **301**, path and query string preserved; `http://` → `https://`
- [x] Search Console **Domain** property verified by DNS TXT; `sitemap-index.xml`
      submitted. A domain property was chosen over URL-prefix so apex, `www`, `http`
      and `https` all report into one place.
- [x] Email routing live — `hello@theimageprep.com` forwards to Gmail. MX ×3, exactly
      one SPF record, DKIM present, and the Search Console TXT survived the change.
- [ ] Bing Webmaster Tools (import from Search Console)
- [ ] PageSpeed Insights on the homepage, a tool page and a guide
- [ ] Share a page on any social platform and confirm the OG card renders

> **Sitemap said "Couldn't fetch" on submission day.** Expected — `Type: Unknown` and a
> blank `Last read` mean Google never fetched it, not that it fetched and failed. The
> file was confirmed serving 200 as `application/xml`, with Googlebot getting 200 and no
> Cloudflare challenge. Re-check after 48 hours before treating it as a fault.

> The `www` redirect is a **zone Redirect Rule**, not a file in this repo. A `_redirects`
> file cannot do it — Cloudflare Pages matches that file on path only and silently
> ignores an absolute-URL source. See [deploy.md](deploy.md).

## First 30 days

- [ ] Check Search Console **Pages** for indexing problems
- [ ] Publish one more guide or tool per week
- [ ] Share individual tools where self-promotion is welcome, answering a real question
      first rather than dropping a link
- [ ] Contact a handful of genuinely relevant small sites — creator resource lists,
      seller blogs — one at a time, not in bulk
- [ ] Do **not** apply for AdSense yet

## Month 2 onward

- [ ] Apply for AdSense once there is content and some traffic —
      see [adsense-setup.md](adsense-setup.md)
- [ ] Set up the Google-certified CMP at the same time if you have EEA/UK/Swiss traffic
- [ ] Start the weekly Search Console workflow: improve pages sitting at positions 8–30
      before building anything new

## Ongoing maintenance

**Platform sizes go stale.** `src/data/presets.ts` carries `VERIFIED_ON`, which is
displayed to visitors. Re-check the numbers periodically and update the date — and do
not update the date when you have not checked. A visibly stale figure is more useful
than one pretending to be current.

The YouTube entry is the live example: the near-universal "1280×720, max 2 MB" advice is
wrong on both counts, and being right about it is exactly the kind of detail that earns
links.
