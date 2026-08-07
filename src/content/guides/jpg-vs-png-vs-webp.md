---
title: 'JPG vs PNG vs WebP: Which to Use and When'
description: 'A decision you can make in ten seconds once you know the rule. Plus why a photograph saved as PNG costs you ten times the file size.'
h1: 'JPG vs PNG vs WebP'
blurb: 'One rule decides it almost every time. Here is the rule, the exceptions, and what each format is actually doing to your image.'
kicker: 'Formats'
published: '2026-08-07'
relatedTools:
  - png-to-jpg
  - jpg-to-webp
  - compress-png
  - compress-jpg
order: 70
---

## The rule

**Photographs → JPG. Graphics → PNG. Your own website → WebP for both.**

That covers the overwhelming majority of decisions. The reasoning is worth understanding, because it also explains the mistakes.

## Why the rule works

JPEG was designed for photographs. It discards fine, high-frequency detail on the assumption that the eye will not miss it — true of foliage, skin and fabric, and badly false of hard edges. Put text or a logo through JPEG and you get faint coloured halos around every sharp boundary.

PNG was designed for graphics. It compresses by finding repetition — runs of identical pixels, repeated patterns — which is exactly what a logo or screenshot contains and exactly what a photograph does not. It is also lossless, so nothing degrades, and it supports transparency.

WebP does both jobs, better, in one format. Lossy WebP beats JPEG on photographs; lossless WebP beats PNG on graphics. Its only real limitation is that some platforms still will not accept it.

## The expensive mistake

**A photograph saved as PNG.** It happens constantly — a screenshot of a photo, an export from a design tool that defaults to PNG, a "save image as" that picked the wrong format.

The result is typically five to ten times larger than the same photograph as a JPG at quality 85, with no visible benefit whatsoever. PNG's compression finds nothing to work with in a photograph, because there is no repetition to exploit. There is no upside — just a file several times heavier.

If you have these, [convert them to JPG](/png-to-jpg/). It is often the single largest file-size saving available on a website.

The mirror-image mistake — a screenshot saved as JPG — costs less in bytes but is more visible: soft, haloed text.

## Side by side

| | JPG | PNG | WebP |
| --- | --- | --- | --- |
| Best for | Photographs | Logos, screenshots, graphics | Both, on the web |
| Transparency | No | Yes | Yes |
| Lossy | Always | Never | Optional |
| Animation | No | Yes (APNG) | Yes |
| Typical photo size | Baseline | 5–10× larger | 25–35% smaller |
| Typical graphic size | Poor quality | Baseline | ~25% smaller |
| Marketplace uploads | Yes | Yes | Usually rejected |
| Stores DPI | Yes | Yes | No |

## Where WebP fits

Use WebP on **your own website, blog or portfolio**. Every current browser has supported it for years, and on an image-heavy page it is usually the single largest speed improvement available for the least effort. Faster pages feed into Core Web Vitals, which is part of how Google assesses page experience.

Do not use it for **marketplace listings**. Etsy, Amazon, eBay and Shopify expect JPG or PNG, and an upload form that rejects your file is worse than a slightly larger one. The same applies to anything a client or printer will open in desktop software, where support is still patchy.

Also note WebP does not store DPI. If a print resolution matters, use JPG or PNG — see the [DPI guide](/guides/300-dpi-explained/).

Converting is straightforward with the [JPG to WebP converter](/jpg-to-webp/).

## Quality numbers are not comparable

WebP at quality 80 looks roughly like JPEG at 85–90, and produces a smaller file than either. Do not try to match the number when converting — start WebP at 80 and judge by eye.

For JPEG on photographs: 85–94 is invisible to almost anyone, 75–84 is the sweet spot for the web, and below 60 shows visible blocking in skies and smooth gradients.

## Two PNG facts worth knowing

**Lossless PNG compression saves 10–30%, not 70%.** That is the honest ceiling for reorganising a file without changing pixels. Sites advertising far more are doing colour reduction and calling it compression.

**Colour reduction is a separate, legitimate technique.** Rebuilding an image from a palette of 256 colours or fewer typically cuts file size by 60–80%, and on logos, icons and screenshots it is visually indistinguishable. On photographs it produces visible banding. The [PNG compressor](/compress-png/) offers both and labels which is which, so you always know what you got.

## What about AVIF?

AVIF compresses better than WebP again — often around 20% smaller at matched quality — and browser support is now broad. It is a reasonable choice for a modern site.

Two caveats. Encoding is considerably slower, which matters for large batches. And support outside browsers is still thinner than WebP's, so it is less safe as your only copy. WebP remains the better default; AVIF is worth adding as an extra source where every kilobyte counts.

## Quick decision guide

- Photograph for a website → **WebP**, with a JPG fallback if you need one
- Photograph for a marketplace, client or printer → **JPG**, quality 85+
- Logo, icon, screenshot or diagram → **PNG**, or lossless WebP on your own site
- Anything needing transparency → **PNG** or **WebP**, never JPG
- Anything needing a print DPI → **JPG** or **PNG**, never WebP
- Photograph currently saved as PNG → [convert it](/png-to-jpg/) today
