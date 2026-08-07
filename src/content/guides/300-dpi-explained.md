---
title: '300 DPI Explained: What Printers Actually Want'
description: 'DPI is a label, not a quality setting. Here is what 300 DPI means, how many pixels you really need, and why DPI changes often appear to fail.'
h1: '300 DPI for Print, Explained'
blurb: 'The most misunderstood number in digital imaging. What it means, how many pixels you actually need, and why changing it sometimes appears to do nothing.'
published: '2026-08-07'
relatedTools:
  - change-image-dpi
  - resize-image
  - crop-image
  - compress-jpg
order: 60
---

## DPI does not affect image quality

Start here, because everything else follows from it.

An image file contains a grid of pixels. That is all it contains. A photo of 3000 × 2000 pixels holds exactly the same information whether it is labelled 72 DPI or 300 DPI. Changing the label adds nothing and removes nothing.

What DPI records is an **instruction about physical size** — how many pixels to pack into each inch of paper.

- 3000 pixels at **300 DPI** prints **10 inches** wide.
- The same 3000 pixels at **150 DPI** prints **20 inches** wide.
- The same 3000 pixels at **72 DPI** prints about **41.7 inches** wide.

Same file. Same pixels. Different instructions about how large to print them, and therefore different apparent sharpness on paper — because the same detail is being spread over more or less area.

So when a printer asks for 300 DPI, they are asking for two things at once: enough pixels for the size you want, and a label telling their software how to place them. Only the first has anything to do with quality.

## How many pixels you actually need

Multiply the print size in inches by the DPI.

| Print size | At 150 DPI | At 300 DPI |
| --- | --- | --- |
| 4 × 6 in | 600 × 900 | 1200 × 1800 |
| 5 × 7 in | 750 × 1050 | 1500 × 2100 |
| 8 × 10 in | 1200 × 1500 | 2400 × 3000 |
| A5 | 874 × 1240 | 1748 × 2480 |
| A4 | 1240 × 1754 | 2480 × 3508 |
| A3 | 1754 × 2480 | 3508 × 4961 |
| Business card (3.5 × 2 in) | 525 × 300 | 1050 × 600 |

If your image has fewer pixels than the 300 DPI column, relabelling it will not help. Your options are to print smaller, accept a lower DPI, or find a higher-resolution original.

## 300 is a convention, not a law

300 DPI became standard because it is roughly the point at which a person holding a page at normal reading distance stops resolving individual dots. For things held in the hand — books, cards, flyers, photo prints — it is the right target.

It is frequently over-specified for anything viewed further away, because required resolution falls with viewing distance:

- **Handheld** (cards, books, photos): 300 DPI
- **Wall posters** viewed from a metre or two: 150 DPI is usually indistinguishable
- **Large-format banners** viewed from several metres: 72–100 DPI is common and normal
- **Billboards**: often under 20 DPI

A print shop asking for 300 DPI on a two-metre banner is applying a default, not a requirement. It is worth asking, because it can be the difference between a file that works and one you cannot produce.

## Why your DPI change appeared to do nothing

This is the most common complaint about DPI tools, and it has a precise cause.

A JPEG can record its resolution in **two entirely separate places**:

1. The **JFIF header** — an old, simple structure near the start of the file with density fields.
2. The **EXIF block** — the tags `XResolution`, `YResolution` and `ResolutionUnit`.

Most online DPI tools write only the JFIF fields. Photoshop, InDesign and Word read the EXIF tags. So the tool reports success, the file genuinely changed, and when you open it in the program that matters it still says 72 DPI — because the EXIF value was never touched and is still sitting there.

The [DPI tool here](/change-image-dpi/) writes both, and forces the EXIF resolution unit to inches so the number cannot be reinterpreted as dots per centimetre. If the file has no JFIF header, one is inserted.

PNG has a single field — the `pHYs` chunk, which stores pixels per metre — so it does not suffer from this. WebP has no resolution field at all, which is why setting DPI on a WebP is impossible rather than merely unreliable.

## Label only, or resample?

**Label only** changes the recorded resolution and leaves every pixel untouched. No quality is lost, because nothing is re-encoded. The physical print size changes. This is what a printer asking for "300 DPI" almost always means.

**Resample** adds or removes pixels so the image prints at the same physical size at the new resolution. Going from 72 to 300 DPI this way multiplies the pixel count by more than seventeen, all interpolated from data that was never captured. The file gets much larger and the image gets softer.

Choose label only unless you specifically want to change the pixel dimensions — and if you do, the [image resizer](/resize-image/) gives you more direct control.

## Bleed, and why your file needs to be bigger

If your artwork runs to the edge of the page, printers ask for **bleed** — usually 3 mm of extra image beyond the trim line on every side, because paper shifts fractionally during cutting.

At 300 DPI, 3 mm is about 35 pixels. So an A4 page needing bleed is 2551 × 3579 rather than 2480 × 3508. Keep important content well inside the trim line too; anything within about 5 mm of the edge risks being cut.

## DPI and PPI

Strictly, PPI (pixels per inch) describes a digital image and DPI (dots per inch) describes ink dots a printer physically places — and printers use several ink dots per image pixel.

In everyday use the terms are interchangeable, and every image editor labels the field one way or the other without meaning anything different. Whichever your printer asks for, it is the same number.

## A checklist before sending to print

1. Work out the required pixels: print size in inches × 300.
2. Check your image has at least that many. If not, print smaller or find a better original.
3. [Crop](/crop-image/) to the right aspect ratio for your paper size.
4. Set the DPI with [label only](/change-image-dpi/), and check the print size the tool reports.
5. Add bleed if artwork runs to the edge.
6. Export as high-quality JPG or PNG. Do not compress hard — print reveals compression artefacts that screens hide.
