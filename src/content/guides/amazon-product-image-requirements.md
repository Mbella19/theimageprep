---
title: 'Amazon Product Image Requirements Explained'
description: 'The 1000px zoom threshold, the pure white background rule, the 85% frame rule, and what gets a listing suppressed.'
h1: 'Amazon Product Image Requirements'
blurb: 'Amazon enforces its image rules more strictly than any other marketplace. Here is what they are and which ones will get a listing suppressed.'
published: '2026-08-07'
relatedTools:
  - resize-image
  - crop-image
  - png-to-jpg
  - compress-jpg
order: 20
---

## The rules that actually matter

Amazon's image guidelines run to several pages, but a handful of rules account for nearly every rejected listing.

| Requirement | Value |
| --- | --- |
| Minimum for zoom | 1000 px on the longest side |
| Recommended | 1600 px or more on the longest side |
| Maximum | 10,000 px on the longest side |
| Main image background | Pure white — RGB 255, 255, 255 |
| Product fills | About 85% of the frame |
| Formats | JPEG preferred; PNG, TIFF and non-animated GIF accepted |
| Main image must not contain | Text, logos, watermarks, borders, props, inset images |

## The 1000 pixel threshold is the important one

Below 1000 pixels on the longest side, Amazon simply does not enable the zoom function on your listing. There is no warning and no error — the feature is quietly absent, and buyers cannot inspect your product closely.

That matters commercially. For anything where material, texture, stitching or finish influences the decision, zoom is doing a large part of your selling. A listing without it is competing at a disadvantage that is invisible from the seller dashboard.

Aim for **1600 pixels or more**. That comfortably clears the threshold and gives the zoom viewer enough detail to be worth using. Amazon accepts up to 10,000 pixels, but there is no benefit past about 2000 for most products.

Use the [image resizer](/resize-image/) to hit a specific size, and check the dimensions it reports before uploading.

## Pure white means exactly 255, 255, 255

This catches people out constantly. A white background photographed under normal lighting is not pure white — it is a very light grey, typically somewhere around RGB 245. It looks white to your eye, and Amazon's checks treat it as a coloured background.

The distinction only applies to the **main image**. Secondary images can have lifestyle backgrounds, context shots, people using the product, and so on. It is the first image that must be the product isolated on true white.

Getting there reliably means either shooting on a lightbox with enough light to blow the background out completely, or cutting the product out and placing it on white. If you already have a transparent PNG cutout, the [PNG to JPG converter](/png-to-jpg/) will flatten it onto pure white in one step — white is its default background for exactly this reason.

## No text, logos or watermarks on the main image

This is the rule that gets listings suppressed rather than merely looking unprofessional.

The main image may not contain added text, promotional badges ("Best Seller", "50% off"), logos that are not part of the physical product, watermarks, borders, or inset images showing another view. Nothing that is not the product itself.

If you watermark your product photography as a matter of habit, exclude the Amazon main image from that batch. The [watermark tool](/add-watermark/) works on whichever files you give it, so keep the main images separate. Watermarks on secondary images are also discouraged and are worth avoiding.

## The 85% rule

The product should occupy roughly 85% of the image frame. Too small and it looks lost in white space at thumbnail size; too large and it feels cropped and cramped.

This is where cropping matters more than resizing. Shoot with a margin, then use the [crop tool](/crop-image/) to bring the product up to size — set a square output and frame it so the product nearly fills it with a small consistent border.

Square (1:1) is the right ratio for the main image. Amazon's grid is square, and a non-square upload gets padded or cropped.

## A practical workflow

1. Shoot or source the product image with room around the edges.
2. Cut out or blow out the background to pure white.
3. [Crop](/crop-image/) to a square with the product filling about 85% of the frame.
4. [Resize](/resize-image/) to 1600 × 1600.
5. [Compress](/compress-jpg/) as JPG at quality 85 or above.

Do it in that order. Cropping and resizing before compressing means the compression works on the final pixels rather than on data you are about to throw away.

## Secondary images are where the selling happens

The main image is heavily constrained; the other six to eight are not. Use them for scale references, the product in use, close-ups of materials and finish, what is in the box, and dimensions. These may contain text, graphics and lifestyle backgrounds.

For a set of secondary images at consistent dimensions, the [social media sizer](/social-media-image-sizes/) includes an Amazon preset and will produce them all at once.

## Where to confirm

Amazon updates its image standards periodically, and requirements differ by category — clothing, for example, has additional rules about models and mannequins. Check Seller Central's Product Image Requirements for your specific category before a large upload. This guide is not affiliated with Amazon.
