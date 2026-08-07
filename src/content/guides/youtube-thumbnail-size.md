---
title: 'YouTube Thumbnail Size: The Advice You Read Is Old'
description: 'YouTube now recommends 3840x2160, not 1280x720. And the famous 2MB limit only applies to mobile uploads — desktop allows 50MB.'
h1: 'YouTube Thumbnail Size and the 2MB Limit'
blurb: 'Almost every guide online repeats numbers YouTube has moved on from. Here are the current specifications, and why the 2MB wall only affects some people.'
published: '2026-08-07'
relatedTools:
  - compress-jpg
  - resize-image
  - crop-image
  - social-media-image-sizes
order: 30
---

## What YouTube actually says now

| Specification | Current value |
| --- | --- |
| Recommended resolution | 3840 × 2160 |
| Minimum width | 640 px |
| Aspect ratio | 16:9 |
| File size limit — mobile upload | 2 MB |
| File size limit — desktop upload | 50 MB |
| Formats | JPG, GIF, PNG |

Two of those numbers contradict what nearly every article on this subject still says.

## The 1280 × 720 advice is out of date

For years the standard recommendation was 1280 × 720, and it propagated into essentially every blog post, course and checklist about YouTube. YouTube's own documentation now recommends **3840 × 2160** — four times the linear resolution — with 640 pixels as the bare minimum width.

1280 × 720 still works. It is still accepted, and on a phone you will not see the difference. But thumbnails are increasingly viewed on large displays and TVs, where they are rendered far larger than they were when that advice was written, and a 720p thumbnail visibly softens.

If you already have a 1280 × 720 template you like, there is no urgency to rebuild it. Just do not *start* a new one at that size — build at 3840 × 2160 and you are covered either way. Both sizes are available as presets in the [social media sizer](/social-media-image-sizes/).

## The 2MB limit is a mobile limit

This is the one that wastes the most time.

The famous 2 MB ceiling is real, but it applies to **uploads from the YouTube mobile app**. Uploading from a desktop browser, the limit is **50 MB** — twenty-five times higher, and impossible to hit with a normal thumbnail.

So if you have been repeatedly compressing a thumbnail to squeeze under 2 MB, check where you are uploading from. The same file that gets rejected on your phone goes up untouched from a computer.

If you genuinely need to upload from mobile, the [JPG compressor](/compress-jpg/) has a target size mode: type `2 MB` and it searches for the highest quality that fits underneath. A 3840 × 2160 thumbnail at quality 80 is usually well under it already.

## Why thumbnails look blurry

Almost always one of three things.

**The source was too small.** Scaling a 640 pixel image up to 1280 does not add detail. Design at the size you intend to export, not smaller.

**It was compressed too hard.** Below about quality 60, JPEG produces visible blocks in flat areas — and thumbnails are full of flat areas: solid colour backgrounds, large text, blocks of brand colour. These are exactly what JPEG handles worst. If your thumbnail has large flat regions, stay at quality 80 or above, or export as PNG.

**YouTube re-compressed it.** This is unavoidable. YouTube re-encodes every thumbnail for its own delivery. You cannot control that, but a clean high-quality upload gives its encoder better material than an already-degraded one. Do not pre-compress "to help" — it does the opposite.

## Text needs to survive a 168-pixel-wide thumbnail

In a phone feed, your thumbnail is often rendered around 168 pixels wide. A 3840 pixel design shown at 168 pixels is a 4% scale.

That has direct consequences:

- Three to five words maximum. Long headlines become texture.
- Very large, very heavy type. If it looks oversized while designing, it is probably right.
- Strong contrast — a bright outline or a solid block behind the text, not a subtle drop shadow.
- Keep text away from the bottom right corner, where the video duration badge sits.

The practical test: shrink your thumbnail to about 170 pixels wide and look at it. The [image resizer](/resize-image/) will do that in a couple of seconds, and it is a more honest preview than zooming out in a design tool.

## A workflow that works

1. Design or shoot at **3840 × 2160**, or 1920 × 1080 if that is easier to work with.
2. If your source is the wrong shape, [crop to 16:9](/crop-image/) rather than stretching.
3. Export as JPG at quality 85, or PNG if the design is mostly flat colour and text.
4. Only if uploading from mobile, [compress to under 2 MB](/compress-jpg/).
5. Shrink a copy to ~170px wide and check it still reads.

## What about Shorts?

Shorts use a 9:16 vertical cover at 1080 × 1920. Note that a 16:9 custom thumbnail on a vertical video gets replaced by an auto-generated frame in some places in the app, so a horizontal thumbnail is not a reliable choice for vertical content.

## Where to confirm

YouTube changes these specifications without announcement — the two corrections in this guide exist because it already has. For anything critical, check YouTube Help directly. This guide is not affiliated with YouTube.
