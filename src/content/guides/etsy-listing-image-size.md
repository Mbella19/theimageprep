---
title: 'Etsy Listing Photo Size: What to Upload in 2026'
description: 'Etsy wants 2000px on the shortest side. Here is why that number matters, which ratio to use, and how to prepare listing photos properly.'
h1: 'Etsy Listing Photo Size and Requirements'
blurb: 'The dimensions Etsy asks for, why undersized photos look blurry in the listing grid, and how to prepare a full set without an image editor.'
kicker: 'Etsy'
sourceNote: 'Checked against Etsy Seller Handbook'
published: '2026-08-07'
relatedTools:
  - resize-image
  - crop-image
  - compress-jpg
  - social-media-image-sizes
order: 10
---

## The short answer

Upload listing photos at **2000 pixels on the shortest side**, in a **square (1:1)** or **landscape (4:3)** ratio, as JPG or PNG.

A 2000 × 2000 square is the safest single choice. It fills the listing grid without cropping, it satisfies the zoom viewer, and it works for every placement Etsy generates from your upload.

## Why 2000 pixels specifically

Etsy does not display your photo at one size. From a single upload it generates a thumbnail for the search grid, a larger version for the listing page, a zoom view, and versions for its mobile apps — each at different pixel dimensions, and each regenerated whenever Etsy redesigns something.

Giving it 2000 pixels means every one of those is produced by scaling *down*, which always looks good. Upload something smaller and Etsy scales *up* to fill the larger placements, which never does. That is the actual mechanism behind "my Etsy photos look blurry": the image was fine, there just were not enough pixels for the size Etsy wanted to show it at.

There is no benefit to going far beyond 2000. A 6000 pixel photo is scaled down to the same displayed sizes; you have just uploaded a much larger file for no visible gain.

## Aspect ratio, and what gets cropped

Etsy's listing grid is square. Whatever ratio you upload, the thumbnail people see in search results is a **centre crop to 1:1**.

That has a practical consequence worth internalising: anything near the left or right edge of a landscape photo is invisible in search results, which is where buyers decide whether to click at all. If your product is off-centre, it will be cropped out of the only image most people ever see.

- **Square (1:1)** — what you see is what appears in the grid. The safest choice, and the reason most established shops shoot square.
- **Landscape (4:3)** — fine for the listing page itself, but assume the sides will be cut in search. Keep the product centred.
- **Portrait** — Etsy accepts it, but the crop is aggressive and it wastes vertical space. Avoid it for the first photo.

The first photo is the one that matters most. The remaining nine can be any ratio you like, since they are only seen by someone already on your listing.

## Preparing a set without an editor

For a typical listing of ten photos:

1. **Crop the first photo to a square** with the product centred, using the [crop tool](/crop-image/). Set the output to 2000 × 2000 and frame it by eye.
2. **Resize the rest** to 2000 pixels on the shortest side with the [image resizer](/resize-image/). Batch them all at once.
3. **Compress** with the [JPG compressor](/compress-jpg/) at quality 85 or above. Etsy re-compresses your upload anyway, so giving its encoder clean material to work from produces a better final result than uploading something already degraded.

If you want the shop banner and icon at the same time, the [social media sizer](/social-media-image-sizes/) has Etsy presets for all three and will hand you a ZIP.

## File size

Etsy publishes a maximum file size per image, and it is generous enough that a correctly prepared listing photo will not come close to it. A 2000 × 2000 JPG at quality 85 is typically well under a megabyte.

If you are hitting a limit, the cause is almost always an uncompressed PNG export of a photograph. Convert it with the [PNG to JPG converter](/png-to-jpg/) — a photograph has no business being a PNG, and the file will shrink dramatically with no visible difference.

## Photos taken on a phone

Two things to check before uploading.

**HEIC files.** iPhones save photos as HEIC by default and Etsy will not accept them. Convert them first with the [HEIC to JPG converter](/heic-to-jpg/), or change the capture format in Settings → Camera → Formats → Most Compatible.

**Location data.** A photograph taken at home records your home's coordinates in its metadata, accurate to within a few metres, and that travels with the file. Etsy strips metadata on upload, but the same photo emailed to a customer or posted elsewhere does not get that treatment. The [EXIF viewer](/remove-exif-data/) shows you exactly what a file is carrying before you share it.

## Common mistakes

- **Uploading straight from a phone gallery.** Modern phone photos are often 4000 pixels wide and several megabytes. They work, but they are slow to upload and the first one sets the tone for the shop — crop it deliberately.
- **Assuming the grid shows your whole photo.** It shows a centre square. Check what that square contains.
- **Editing a photo repeatedly.** Every JPG save discards a little more detail. Work from your original each time rather than re-editing an export.
- **Using a white background inconsistently.** Etsy does not require white, but a shop where every listing has a different background looks unplanned in the search grid.

## Where to confirm

Etsy occasionally adjusts its recommendations. The numbers here reflect Etsy's published guidance as of the date on this page, but for anything critical check the Seller Handbook directly — this guide is not affiliated with Etsy.
