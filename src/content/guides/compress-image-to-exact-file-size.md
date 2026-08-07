---
title: 'How to Compress an Image to an Exact File Size'
description: 'Getting a photo under 100KB, 500KB or 2MB without guessing at a quality slider — and what to do when the target is unreachable.'
h1: 'How to Compress an Image to an Exact File Size'
blurb: 'Upload limits are stated in megabytes, not quality units. Here is how to hit a specific number, and what to do when compression alone cannot get you there.'
published: '2026-08-07'
relatedTools:
  - compress-jpg
  - resize-image
  - compress-png
  - jpg-to-webp
order: 15
---

## The mismatch

Every upload limit you will ever meet is expressed in bytes. Under 2 MB for a YouTube thumbnail from mobile. Under 5 MB for an email attachment. Under 100 KB for an old forum avatar. Under 1 MB for a job application portal.

Every compression tool you will ever meet is controlled by a quality slider from 1 to 100.

There is no formula connecting the two. The quality setting that produces a 100 KB file depends entirely on the image — its dimensions, how much fine detail it contains, how much smooth area. Quality 60 might give you 40 KB on a simple portrait and 400 KB on a photo of a forest.

So the usual experience is a loop: pick a number, export, check the file size, adjust, repeat. Four or five rounds is normal.

## Let the computer do the searching

The loop is a search problem, and a computer does it faster and more accurately than a person.

The [JPG compressor](/compress-jpg/) has a **target size** mode. Type the limit — `100 KB`, `2 MB`, `500kb` — and it encodes the image repeatedly at different quality settings, narrowing in on the highest quality that still fits underneath your number. It normally settles in six to eight attempts and returns the best-quality version that fits, not merely one that fits.

The same mode is available in the [WebP compressor](/compress-webp/) and the [format converters](/jpg-to-webp/).

## When the target cannot be met

Sometimes there is no quality setting that will do it. A 6000 × 4000 photograph will not reach 100 KB at any quality worth using — long before you get there the image has collapsed into blocks.

When that happens the tool says so rather than handing you something unusable. The fix is not more compression. It is **fewer pixels**.

## Dimensions are the stronger lever

This is the single most useful thing to understand about file size.

File size scales roughly with the **number of pixels**, which is width × height. So halving both dimensions leaves a quarter of the pixels — and usually something close to a quarter of the file size.

| Change | Pixels remaining | Rough file size |
| --- | --- | --- |
| Original | 100% | 100% |
| 75% of each dimension | 56% | ~56% |
| 50% of each dimension | 25% | ~25% |
| 25% of each dimension | 6% | ~6% |

Compare that with quality: dropping from 85 to 60 might save 40% and introduces visible artefacts. Halving the dimensions saves 75% and, if the image was larger than it needed to be, costs nothing visible at all.

That last condition is the key one. A 4000 pixel wide photograph displayed in an 800 pixel wide column is carrying five times more data than anyone can see. Resizing it is not a compromise — it is removing waste.

## The right order

**Resize first, then compress.**

1. Work out the largest size the image will actually be displayed at.
2. [Resize](/resize-image/) to that.
3. [Compress](/compress-jpg/) with a target size.

Doing it the other way round wastes the compression work, because you then throw away pixels you just spent effort encoding — and the result is measurably worse than doing it in the correct order.

## Common targets and what they need

| Target | Realistic approach |
| --- | --- |
| Under 100 KB | Resize to ~800 px wide first, then target size |
| Under 500 KB | Resize to ~1600 px wide, quality will land around 75–85 |
| Under 1 MB | Most 2000 px photos fit at quality 80 |
| Under 2 MB | Almost any single photo fits; use target size directly |
| Under 5 MB | Rarely needs anything beyond ordinary compression |

## If it is a PNG, that is probably the problem

A photograph saved as PNG is typically five to ten times larger than the same photograph as a JPG, with no visible benefit. If you are struggling to compress a large PNG photo, the answer is not a better PNG compressor — it is [converting it to JPG](/png-to-jpg/).

PNG compression is lossless, so there is no quality dial to turn. Your options are lossless optimisation, which saves 10–30%, or colour reduction, which works beautifully on graphics and badly on photographs. The [PNG compressor](/compress-png/) offers both and labels which is which.

## Why the result is sometimes larger than the original

If you ask for quality 90 on a file that was originally saved at quality 60, re-encoding adds data without adding detail — it is faithfully reproducing the compression artefacts of the previous save.

The [JPG compressor](/compress-jpg/) detects this and keeps the smaller original rather than handing you a worse, larger file.

## Do not compress twice

JPEG loss accumulates. Each decode-and-re-encode cycle discards a little more, and the block boundaries can shift slightly, compounding the artefacts.

Always compress from the highest-quality original you have — not from a copy that has already been through a compressor, a messaging app, or a social platform's upload pipeline. If you need three different sizes, produce all three from the original rather than compressing the compressed.
